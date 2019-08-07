var Time = require('./time');

// Commands.
var GET_STATE_COMMAND = 0x41;
var SET_CLOCK_COMMAND = 0x42;
var SET_MORNING_ALARM_COMMAND = 0x43;
var SET_NAP_ALARM_COMMAND = 0x44;


class GetStateCommand {
  constructor(data) {
    if (data[0] != GET_STATE_COMMAND) {
      this._valid = false;
      return;
    }

    if (data.length != 2) {
      this._valid = false;
      return;
    }

    this.data = data;
    this._valid = true;
  }

  get valid() {
    return this._valid;
  }
}

class SetClockCommand {
  constructor(data) {
    if (data[0] != SET_CLOCK_COMMAND) {
      this._valid = false;
      return;
    }

    if (data.length != 5) {
      this._valid = false;
      return;
    }

    this.data = data;
    this._valid = true;
  }

  get valid() {
    return this._valid;
  }

  get time() {
    return new Time(this.hours, this.minutes, this.seconds);
  }

  get hours() {
    return this.data[1];
  }

  get minutes() {
    return this.data[2];
  }

  get seconds() {
    return this.data[3];
  }

  static create(hours, minutes, seconds) {
    return new SetClockCommand(
      Uint8Array.of(SET_CLOCK_COMMAND, hours, minutes, seconds, 0x15));
  }
}

class SetMorningAlarmCommand {
  constructor(data) {
    if (data[0] != SET_MORNING_ALARM_COMMAND) {
      this._valid = false;
      return;
    }

    if (data.length != 5) {
      this._valid = false;
      return;
    }

    this.data = data;
    this._valid = true;
  }

  get valid() {
    return this._valid;
  }

  get alarmTime() {
    return new Time(this.hours, this.minutes, 0);
  }

  get hours() {
    return this.data[1];
  }

  get minutes() {
    return this.data[2];
  }

  static create(hours, minutes) {
    return new SetMorningAlarmCommand(
      Uint8Array.of(SET_MORNING_ALARM_COMMAND, hours, minutes, 0, 0x15));
  }
}

class SetNapAlarmCommand {
  constructor(data) {
    if (data[0] != SET_NAP_ALARM_COMMAND) {
      this._valid = false;
      return;
    }

    if (data.length != 5) {
      this._valid = false;
      return;
    }

    this.data = data;
    this._valid = true;
  }

  get valid() {
    return this._valid;
  }

  get alarmTime() {
    return new Time(this.hours, this.minutes, 0);
  }

  get hours() {
    return this.data[1];
  }

  get minutes() {
    return this.data[2];
  }

  get alarmDuration() {
    return this.data[3];
  }

  static create(hours, minutes, duration) {
    return new SetNapAlarmCommand(
      Uint8Array.of(SET_NAP_ALARM_COMMAND, hours, minutes, duration, 0x15));
  }
}

class Response {
  constructor(responseCode) {
    this.responseCode = responseCode;

    this.currentTime = new Time(0, 0, 0);
    this.morningAlarmTime = new Time(0, 0, 0);
    this.hasNapAlarm = 0;
    this.napAlarmTime = new Time(0, 0, 0);
  }

  setCurrentTime(newCurrentTime) {
    this.currentTime = newCurrentTime;
  }

  setMorningAlarmTime(newAlarmTime) {
    this.morningAlarmTime = newAlarmTime;
  }

  setHasNapAlarm(hasAlarm) {
    this.hasNapAlarm = hasAlarm;
  }

  setNapAlarmTime(newAlarmTime) {
    this.napAlarmTime = newAlarmTime;
  }

  asData() {
    return Uint8Array.of(
      this.responseCode,
      this.currentTime.hours,
      this.currentTime.minutes,
      this.currentTime.seconds,
      this.morningAlarmTime.hours,
      this.morningAlarmTime.minutes,
      this.hasNapAlarm,
      this.napAlarmTime.hours,
      this.napAlarmTime.minutes,
      0x15,
    );
  }

  static fromData(data) {
    var response = new Response(data[0]);
    response.setCurrentTime(new Time(data[1], data[2], data[3]));
    response.setMorningAlarmTime(new Time(data[4], data[5], 0));
    response.setHasNapAlarm(data[6]);
    response.setNapAlarmTime(new Time(data[7], data[8], 0));
    return response;
  }
}

module.exports = {
  // Command constants.
  GET_STATE_COMMAND: GET_STATE_COMMAND,
  SET_CLOCK_COMMAND: SET_CLOCK_COMMAND,
  SET_MORNING_ALARM_COMMAND: SET_MORNING_ALARM_COMMAND,
  SET_NAP_ALARM_COMMAND: SET_NAP_ALARM_COMMAND,

  // Response codes.
  OK: 0x00,
  UNKNOWN_COMMAND: 0x01,
  INVALID_SIZE: 0x02,
  INVALID_ARGUMENTS: 0x03,

  START_MARKER: 0x79,
  END_MARKER: 0x7A,

  GetStateCommand: GetStateCommand,
  SetClockCommand: SetClockCommand,
  SetMorningAlarmCommand: SetMorningAlarmCommand,
  SetNapAlarmCommand: SetNapAlarmCommand,
  Response: Response,
}
