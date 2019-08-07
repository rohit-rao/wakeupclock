var Protocol = require('./protocol');
var Time = require('./time');
var WallClock = require('./wallClock');

module.exports = class AlarmController {
  constructor(wallClock, persistentStore, inactivityTimer, ledController) {
    this.wallClock = wallClock;
    this.persistentStore = persistentStore;
    this.inactivityTimer = inactivityTimer;
    this.ledController = ledController;

    this.morningAlarmTime = new Time(6, 20, 0);
    this.morningAlarmDuration = 120;
    this.napAlarmTime = new Time(0, 0, 0);
    this.napAlarmDuration = 0;

    this.isLitForNap = false;

    this.enableDebugging = false;
  }

  start() {
    this.token = setInterval(this._update.bind(this), 1000);
  }

  stop() {
    clearInterval(this.token);
    this.token = null;
  }

  getCurrentTime() {
    return this.wallClock.getCurrentTime();
  }

  getMorningAlarmTime() {
    return this.morningAlarmTime;
  }

  getNapAlarmTime() {
    return this.napAlarmTime;
  }

  getHasNapAlarm() {
    return this.napAlarmDuration > 0;
  }

  setMorningAlarmTime(newTime) {
    if (newTime.hours > 23 || newTime.minutes > 59) {
      return Protocol.INVALID_ARGUMENTS;
    }

    this.morningAlarmTime = newTime;
    //timer.registerInteraction();
    this._update();
    return Protocol.OK;
  }

  setNapAlarm(time, duration) {
    if (time.hours > 23 || time.minutes > 59) {
      return Protocol.INVALID_ARGUMENTS;
    }

    if (duration < 0) {
      return Protocol.INVALID_ARGUMENTS;
    }

    this.napAlarmTime = time;
    this.napAlarmDuration = duration;
    //timer.registerInteraction();
    this._update();
    return Protocol.OK;
  }

  _update() {
    var isLit = false;
    var currentTime = this.wallClock.getCurrentTime();

    if (WallClock.isTimeBetween(currentTime, this.morningAlarmTime,
      this.morningAlarmDuration)) {
      isLit = true;
    }

    if (WallClock.isTimeBetween(currentTime, this.napAlarmTime,
      this.napAlarmDuration)) {
      isLit = true;
      this.isLitForNap = true;
    } else if (this.isLitForNap) {
      this.napAlarmTime = new Time(0, 0, 0);
      this.napAlarmDuration = 0;
      this.isLitForNap = false;
    }

    if (isLit) {
      this.ledController.turnOn();
    } else {
      this.ledController.turnOff();
    }
  }

};
