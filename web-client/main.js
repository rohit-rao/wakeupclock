// Global variables.

var DISCONNECTED = 0;
var CONNECTING = 1;
var CONNECTED = 2;
var ERROR = 3;

var g_state = DISCONNECTED;
var g_device;
var g_characteristic;


function onLoad() {
  var connectionButton = document.getElementById("connection");
  connectionButton.addEventListener("click", function() {
      if (g_state == DISCONNECTED) {
        setState(CONNECTING);
      } else {
        setState(DISCONNECTED);
      }
    });

  document.getElementById("refresh").addEventListener("click", onRefresh);
  document.getElementById("off").addEventListener("click", onTurnLightOff);
  document.getElementById("on").addEventListener("click", onTurnLightOn);
  document.getElementById("morning_0730").addEventListener(
      "click", onSetMorningAlarm);
}

function setState(state) {
  if (g_state == state) {
    return;
  }

  // Test for valid state changes here and return early for invalid changes.
  if (g_state == ERROR) {
    if (state != DISCONNECTED) {
      return;
    }
  }

  var oldState = g_state;
  g_state = state;
  
  // Update the button for the new state.
  var connectionButton = document.getElementById("connection");
  if (g_state == DISCONNECTED) {
    connectionButton.value = "Connect";
  } else if (g_state == CONNECTING) {
    connectionButton.value = "Connecting...";
  } else if (g_state == ERROR) {
    connectionButton.value = "ERROR!";
  } else {
    connectionButton.value = "Disconnect";
  }

  if (g_state == CONNECTED) {
    document.getElementById("refresh").style.display = "inline";
  } else {
    document.getElementById("section_clock_state").style.display = "none";
    document.getElementById("section_clock_control").style.display = "none";
    document.getElementById("section_clock_control_morning").style.display =
        "none";
    document.getElementById("refresh").style.display = "none";
  }

  // If moving to the connecting state, trigger the bluetooth dialogs.
  if (g_state == CONNECTING) {
    startBTConnection();
  } else if (g_state == DISCONNECTED) {
    disconnectBT();
  }
}

function startBTConnection() {
  navigator.bluetooth.requestDevice({
   filters: [{
       services: [ 0xFFE0 ],
        }]
    })
      .then(device => {
          g_device = device;
          device.addEventListener('gattserverdisconnected', onBTDisconnected);
          return device.gatt.connect();
        })
      .then(server => { return server.getPrimaryService(0xFFE0); })
      .then(service => { return service.getCharacteristic(0xFFE1); })
      .then(characteristic => {
          onBTConnectionEstablished(characteristic);
          return true;
        })
      .catch(error => {
          console.log(error);
          setState(ERROR);
        });
}

function onBTConnectionEstablished(characteristic) {
  g_characteristic = characteristic;
  setState(CONNECTED);

  // Set up change event listeners.
  characteristic.addEventListener('characteristicvaluechanged',
                                  onClockStatusUpdated);
  characteristic.startNotifications();

  // Send the initial status update request.
  onRefresh();
}

function onBTDisconnected(event) {
  let device = event.target;
  console.log('Device ' + device.name + ' is disconnected.');
  setState(DISCONNECTED);
  g_device = undefined;
}

function onClockStatusUpdated() {
  document.getElementById("refresh").disabled = false;

  var response = event.target.value;
  if (response.byteLength != 10) {
    console.log("Improper response size");
    return;
  }

  var status = response.getUint8(0);
  if (status != 0) {
    console.log("Error response received");
    return;
  }

  var current_hours = response.getUint8(1);
  var current_minutes = response.getUint8(2);
  var current_seconds = response.getUint8(3);
  var morning_hours = response.getUint8(4);
  var morning_minutes = response.getUint8(5);
  var is_nap_enabled = response.getUint8(6);
  var nap_hours = response.getUint8(7);
  var nap_minutes = response.getUint8(8);

  document.getElementById("current_time").innerText =
      formatTime(current_hours, current_minutes);
  document.getElementById("morning_alarm").innerText =
      formatTime(morning_hours, morning_minutes);
  if (is_nap_enabled) {
    document.getElementById("nap_alarm").innerText =
        formatTime(nap_hours, nap_minutes);
  } else {
    document.getElementById("nap_alarm").innerText = "(disabled)";
  }

  document.getElementById("section_clock_state").style.display = "inline";
  document.getElementById("section_clock_control").style.display = "inline";
  document.getElementById("section_clock_control_morning").style.display =
      "inline";
}

function disconnectBT() {
  if (g_device) {
    g_device.gatt.disconnect();
  }
}

function onRefresh() {
  // Send a status update request.
  var getStateCommand = Uint8Array.of(0x79, 0x41, 15, 0x7A);
  g_characteristic.writeValue(getStateCommand)
      .then(v => {
          document.getElementById("refresh").disabled = true;
          return true;
        })
      .catch(error => {
          console.log(error);
          document.getElementById("refresh").disabled = false;
        });
}

function onTurnLightOff() {
  // Send a command to set the nap alarm duration to 0.  That should turn the
  // light off immediately.
  var command = Uint8Array.of(0x79, 0x44, 12, 0, 0, 15, 0x7A);
  g_characteristic.writeValue(command)
      .catch(error => { console.log(error); });
}

function onTurnLightOn() {
  // Send a command to set the nap alarm time to 2 minutes ago.  That should
  // turn the light on immediately.
  var currentTime = new Date();
  var enableTime = new Date(currentTime.getTime() - 120*1000);

  var command = Uint8Array.of(
      0x79, 0x44,
      enableTime.getHours(), enableTime.getMinutes(),
      30, 15, 0x7A);
  g_characteristic.writeValue(command)
      .catch(error => { console.log(error); });
}

function onSetMorningAlarm() {
  // Send a command to set the morning alarm time to 7:30am.
  var command = Uint8Array.of(
      0x79, 0x43,
      7, 30,
      0, 15, 0x7A);
  g_characteristic.writeValue(command)
      .catch(error => { logError(error); });
}

function formatTime(hours, minutes) {
  var ampm = "AM";
  if (hours > 12) {
    hours = hours - 12;
    ampm = "PM";
  }

  var time = hours.toString() + ":";
  if (minutes < 10) {
    time = time + "0";
  }
  time = time + minutes.toString();
  time = time + " " + ampm;
  return time;
}
