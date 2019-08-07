var fs = require('fs');

function exportFile() {
  return '/sys/class/gpio/export';
}

function pinFolder(pin) {
  return '/sys/class/gpio/gpio' + pin;
}

function pinDirectionFile(pin) {
  return '/sys/class/gpio/gpio' + pin + '/direction';
}

function pinValueFile(pin) {
  return '/sys/class/gpio/gpio' + pin + '/value';
}

class LEDController {
  constructor(pin) {
    this.pin = pin;

    if (!fs.existsSync(pinFolder(pin))) {
      fs.writeFileSync(exportFile(), pin);
    }

    // A newly-exported pin shows up in the filesystem with incorrect
    // permissions at first. Busy-loop until the permissions are set properly.
    var count = 0;
    var stats = fs.statSync(pinDirectionFile(pin));
    while (count < 1000 && ((stats.mode & 0o0110) != 0o0110)) {
      count = count + 1;
      stats = fs.statSync(pinDirectionFile(pin));
    }

    fs.writeFileSync(pinDirectionFile(pin), 'out');
    fs.writeFileSync(pinValueFile(pin), '0');
  }

  stop() {
    this.turnOff();
  }

  setValue(value) {
    fs.writeFileSync(pinValueFile(this.pin), value);
  }

  turnOn() {
    this.setValue('1');
  }

  turnOff() {
    this.setValue('0');
  }
}

module.exports = LEDController;
