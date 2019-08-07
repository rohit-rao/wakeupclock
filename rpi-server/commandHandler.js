var Protocol = require('./protocol.js');

class CommandHandler {
  constructor(alarmController) {
    this.alarmController = alarmController;
  }

  onAppendCommandChunk(chunk) {
    console.log('onAppendCommandChunk: chunk = ' + chunk.toString('hex'));

    // For now, assume that the entire command comes across as a
    // single chunks.  If commands someday end up split across chunks, then
    // copy the logic from the Arduino server.

    // The first and last bytes must be START and END markers.
    if (chunk[0] != 0x79 ||
      chunk[chunk.length - 1] != 0x7A) {
      return this.generateError(0x01);
    }

    return this.processCommand(chunk.slice(1, -1));
  }

  // Returns the response that should be sent back.
  processCommand(data) {
    var command = data[0];

    if (command == Protocol.GET_STATE_COMMAND) {
      return this.processGetStateCommand(data);
    } else if (command == Protocol.SET_CLOCK_COMMAND) {
      return this.processSetClockCommand(data);
    } else if (command == Protocol.SET_MORNING_ALARM_COMMAND) {
      return this.processSetMorningAlarmCommand(data);
    } else if (command == Protocol.SET_NAP_ALARM_COMMAND) {
      return this.processSetNapAlarmCommand(data);
    }

    return this._generateResponseData(Protocol.UNKNOWN_COMMAND);
  }

  processGetStateCommand(data) {
    var command = new Protocol.GetStateCommand(data);
    if (!command.valid) {
      return this._generateResponseData(Protocol.INVALID_SIZE);
    }

    return this._generateResponseData(Protocol.OK);
  }

  processSetClockCommand(data) {
    var command = new Protocol.SetClockCommand(data);
    if (!command.valid) {
      return this._generateResponseData(Protocol.INVALID_SIZE);
    }

    return this._generateResponseData(Protocol.OK);
  }

  processSetMorningAlarmCommand(data) {
    var command = new Protocol.SetMorningAlarmCommand(data);
    if (!command.valid) {
      return this._generateResponseData(Protocol.INVALID_SIZE);
    }

    this.alarmController.setMorningAlarmTime(command.alarmTime);
    return this._generateResponseData(Protocol.OK);
  }

  processSetNapAlarmCommand(data) {
    var command = new Protocol.SetNapAlarmCommand(data);
    if (!command.valid) {
      return this._generateResponseData(Protocol.INVALID_SIZE);
    }

    this.alarmController.setNapAlarm(command.alarmTime, command.alarmDuration);
    return this._generateResponseData(Protocol.OK);
  }

  _generateResponseData(responseCode) {
    var response = new Protocol.Response(responseCode);
    if (responseCode == Protocol.OK) {
      response.setCurrentTime(this.alarmController.getCurrentTime());
      response.setMorningAlarmTime(this.alarmController.getMorningAlarmTime());
      response.setHasNapAlarm(this.alarmController.getHasNapAlarm());
      response.setNapAlarmTime(this.alarmController.getNapAlarmTime());
    }
    return response.asData();
  }
}

module.exports = CommandHandler;
