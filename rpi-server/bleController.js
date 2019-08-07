var util = require('util');
var bleno = require('bleno');

var Characteristic = function (commandHandler) {
  Characteristic.super_.call(this, {
    uuid: 'ffe1',
    properties: ['read', 'write', 'notify'],
    value: null
  });

  this._updateValueCallback = null;
  this._commandHandler = commandHandler;
};
util.inherits(Characteristic, bleno.Characteristic);

Characteristic.prototype.onReadRequest = function (offset, callback) {
  var response = Uint8Array.of('H', 'e', 'l', 'o');
  console.log('Characteristic - onReadRequest: value = ' +
    this._value.toString('hex'));
  callback(this.RESULT_SUCCESS, this._value);
};

Characteristic.prototype.onWriteRequest =
  function (data, offset, withoutResponse, callback) {
    var response = this._commandHandler.onAppendCommandChunk(data);
    if (this._updateValueCallback) {
      this._updateValueCallback(response);
    }
    callback(this.RESULT_SUCCESS);
  };

Characteristic.prototype.onSubscribe = function (maxValueSize, updateValueCallback) {
  console.log('Characteristic - onSubscribe');
  this._updateValueCallback = updateValueCallback;
};

Characteristic.prototype.onUnsubscribe = function () {
  console.log('Characteristic - onUnsubscribe');
  this._updateValueCallback = null;
};



class BLEController {
  constructor(commandHandler, inactivityTimer) {
    this.commandHandler = commandHandler;
    this.inactivityTimer = inactivityTimer;
  }

  start() {
    console.log('Starting up BLE');
    var capturedThis = this;

    bleno.on('stateChange', function (state) {
      console.log('on -> stateChange: ' + state);

      if (state === 'poweredOn') {
        bleno.startAdvertising('wakeuppi', ['ffe0']);
      } else {
        bleno.stopAdvertising();
      }
    });

    bleno.on('advertisingStart', function (error) {
      console.log('on -> advertisingStart: ' +
        (error ? 'error ' + error : 'success'));

      if (!error) {
        bleno.setServices([
          new bleno.PrimaryService({
            uuid: 'ffe0',
            characteristics: [
              new Characteristic(capturedThis.commandHandler),
            ]
          })
        ]);
      }
    });
  }

  stop() {
    console.log('Stopping BLE');
    bleno.disconnect();
    bleno.stopAdvertising();
  }
}

module.exports = BLEController;
