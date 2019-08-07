module.exports = class Time {
  constructor(hours, minutes, seconds) {
    this._hours = hours;
    this._minutes = minutes;
    this._seconds = seconds;
  }

  get hours() {
    return this._hours;
  }
  set hours(newHours) {
    this._hours = newHours;
  }

  get minutes() {
    return this._minutes;
  }
  set minutes(newMinutes) {
    this._minutes = newMinutes;
  }

  get seconds() {
    return this._seconds;
  }
  set seconds(newSeconds) {
    this._seconds = newSeconds;
  }

  get valid() {
    return this._hours < 24 && this._minutes < 60 && this._seconds < 60;
  }
};

