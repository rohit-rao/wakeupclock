#include <SoftwareSerial.h>
#include <Wire.h>

#define DEBUG 0

// Protocol Details:
//
// "GS": GetState
// Returns: OK{HHMMSS}{HHMM}[{HHMM}]
//   Required Current Time as {HHMMSS}
//   Required Permanent Trigger Time as {HHMM}
//   Optional Temporary Trigger Time as {HHMM}
//
// "SC": SetClock
// Arguments: SC{HHMMSS}
//   Required New Current Time as {HHMMSS}
// Returns: OK{HHMMSS}{HHMM}[{HHMM}]
//   Same response as for GetState
// 
// "SP": SetPermanentTrigger
// Arguments: SP{HHMM}
//   Required New Permanent Trigger Time as {HHMM}
// Returns: OK{HHMMSS}{HHMM}[{HHMM}]
//   Same response as for GetState
//
// "ST": SetTemporaryTrigger
// Arguments: ST{HHMM}
//   Required New Temporary Trigger Time as {HHMM}
// Returns: OK{HHMMSS}{HHMM}{HHMM}
//   Same response as for GetState, but the temporary
//   trigger time will always be present.
//
// "SD": SetDuration
//
// "CT": ClearTemporaryTrigger
//
// 
// Return error codes:
// 0x00 = Success
// 0x01 = Unknown command
// 0x02 = Invalid command size
// 0x03 = Invalid command arguments
// 0x04 = Clock malfunction

struct GetStateCommand {
  byte command;
  byte checksum;
};

struct SetClockCommand {
  byte command;
  byte hours;
  byte minutes;
  byte seconds;
  byte checksum;
};

struct SetTriggerCommand {
  byte command;
  byte hours;
  byte minutes;
  byte duration_min;  // Only used for temporary triggers.
  byte checksum;
};

struct Response {
  byte retcode;
  byte current_hours;
  byte current_minutes;
  byte current_seconds;
  byte permanent_hours;
  byte permanent_minutes;
  byte has_temporary_trigger;
  byte temporary_hours;
  byte temporary_minutes;
  byte checksum;
};

struct Time {
  int hours;
  int minutes;
  int seconds;
};

struct Duration {
  byte minutes;
};

// Command constants.
#define GET_STATE_COMMAND 0x41
#define SET_CLOCK_COMMAND 0x42
#define SET_PERMANENT_TRIGGER_COMMAND 0x43
#define SET_TEMPORARY_TRIGGER_COMMAND 0x44

// Response codes.
#define OK 0x00
#define UNKNOWN_COMMAND 0x01
#define INVALID_SIZE 0x02
#define INVALID_ARGUMENTS 0x03
#define CLOCK_MALFUNCTION 0x04

#define WAITING_FOR_START 0x00
#define READING_UNTIL_END 0x01
#define START_MARKER 0x79
#define END_MARKER 0x7A

const int kBlueLED = 9;
const int kLEDPin = 13;
const int kClockAddress = 0x68;

Time permanent_trigger;
Duration permanent_duration;

Time temporary_trigger;
Duration temporary_duration;

bool is_lit_for_temporary;

SoftwareSerial BTSerial = SoftwareSerial(11, 12);

int debugState = LOW;

////////////////////
// Code
////////////////////

void setup() {
  pinMode(kLEDPin, OUTPUT);
  pinMode(kBlueLED, OUTPUT);

  digitalWrite(kLEDPin, debugState);
  BTSerial.begin(9600);
  Serial.begin(9600);
  Wire.begin();

  memset(&permanent_trigger, 0, sizeof(permanent_trigger));
  memset(&permanent_duration, 0, sizeof(permanent_duration));
  memset(&temporary_trigger, 0, sizeof(temporary_trigger));
  memset(&temporary_duration, 0, sizeof(temporary_duration));

  permanent_trigger.hours = 6;
  permanent_trigger.minutes = 50;
  permanent_duration.minutes = 120;

  temporary_trigger.hours = 15;
  temporary_trigger.minutes = 30;

  is_lit_for_temporary = false;
}

void loop() {
  ProcessBLEBuffer();
  UpdateLED();
  
  delay(1000);
}

void UpdateLED() {
  // Default the LED to off, in cases of clock communication failure.
  int state = LOW;
  
  Time t;
  if (GetCurrentTimeFromClock(&t)) {
    if (IsTimeBetween(&t, &permanent_trigger, &permanent_duration)) {
      state = HIGH;
    }

    if (IsTimeBetween(&t, &temporary_trigger, &temporary_duration)) {
      state = HIGH;
      is_lit_for_temporary = true;
    } else if (is_lit_for_temporary) {
      // If the temporary trigger was previous lit but no longer is, disable it.
      memset(&temporary_duration, 0, sizeof(temporary_duration));
      is_lit_for_temporary = false;
    }
  }

  digitalWrite(kBlueLED, state);
}

// Reads all available data from the btserial port, handling commands as needed.
void ProcessBLEBuffer() {
  while (BTSerial.available()) {
    AppendSerialData((byte)(BTSerial.read() & 0xFF));
  }

#if DEBUG
  while(Serial.available()) {
    AppendSerialData((byte)(Serial.read() & 0xFF));
  }
 #endif
}

void AppendSerialData(byte data) {
#if DEBUG
  Serial.print("AppendSerialData: ");
  Serial.println(data);
#endif

  const int MAX_LENGTH = 16;
  static char command_buffer[MAX_LENGTH];
  static size_t buffer_length = 0;
  static int buffer_state = WAITING_FOR_START;

  if (buffer_length >= MAX_LENGTH) {
      // If the buffer is full, something has gone wrong.  Clear the buffer and reset.
      buffer_state = WAITING_FOR_START;
      buffer_length = 0; 
  } else if (data == START_MARKER) {
      // If this is a start marker, throw away anything in the existing buffer.
      buffer_state = READING_UNTIL_END;
      buffer_length = 0;
  } else if (data == END_MARKER) {
      // If this is an end marker, try to execute a command
      // based on what is currently in the buffer.
      ProcessCommand(command_buffer, buffer_length);
      buffer_state = WAITING_FOR_START;
      buffer_length = 0;
  } else if (buffer_state == READING_UNTIL_END) {
      // We're reading a command. Fill up the buffer.
      command_buffer[buffer_length++] = data;
  }
}

void ProcessCommand(byte* buffer, size_t length) {
  // Need at least one byte for the command.
  if (length < 1) {
    return;
  }
  
  const byte command_type = buffer[0];
  if (command_type == GET_STATE_COMMAND) {
    if (length != sizeof(GetStateCommand)) {
      SendResponse(INVALID_SIZE);
      return;
    }
    HandleGetState((GetStateCommand*)buffer);
  }

  if (command_type == SET_CLOCK_COMMAND) {
    if (length != sizeof(SetClockCommand)) {
      SendResponse(INVALID_SIZE);
      return;
    }
    HandleSetClock((SetClockCommand*)buffer);
  }

  if (command_type == SET_PERMANENT_TRIGGER_COMMAND) {
    if (length != sizeof(SetTriggerCommand)) {
      SendResponse(INVALID_SIZE);
      return;
    }
    HandleSetPermanentTrigger((SetTriggerCommand*)buffer);
  }
  
  if (command_type == SET_TEMPORARY_TRIGGER_COMMAND) {
    if (length != sizeof(SetTriggerCommand)) {
      SendResponse(INVALID_SIZE);
      return;
    }
    HandleSetTemporaryTrigger((SetTriggerCommand*)buffer);
  }
}

//////////////////////
// Command handlers
//////////////////////

bool HandleGetState(GetStateCommand* command) {
#if DEBUG
  Serial.println("HandleGetState");
#endif
  SendResponse(OK);
}

bool HandleSetClock(SetClockCommand* command) {
#if DEBUG
  Serial.println("HandleSetClock");
  Serial.print(command->hours);
  Serial.print(":");
  Serial.print(command->minutes);
  Serial.print(":");
  Serial.println(command->seconds);
#endif

  if (command->hours > 23 || command->minutes > 59 || command->seconds > 59) {
    SendResponse(INVALID_ARGUMENTS);
    return;
  }
  
  Time t;
  t.hours = command->hours;
  t.minutes = command->minutes;
  t.seconds = command ->seconds;
  SetClock(&t);
  SendResponse(OK);
}

bool HandleSetPermanentTrigger(SetTriggerCommand* command) {
#if DEBUG
  Serial.println("HandleSetPermanentTrigger");
  Serial.print(command->hours);
  Serial.print(":");
  Serial.println(command->minutes);
#endif

  if (command->hours > 23 || command->minutes > 59) {
    SendResponse(INVALID_ARGUMENTS);
    return;
  }

  permanent_trigger.hours = command->hours;
  permanent_trigger.minutes = command->minutes;
  SendResponse(OK);
}

bool HandleSetTemporaryTrigger(SetTriggerCommand* command) {
#if DEBUG
  Serial.println("HandleSetTemporaryTrigger");
  Serial.print(command->hours);
  Serial.print(":");
  Serial.print(command->minutes);
  Serial.print(", ");
  Serial.print(command->duration_min);
  Serial.println("m");
#endif

  if (command->hours > 23 || command->minutes > 59) {
    SendResponse(INVALID_ARGUMENTS);
    return;
  }

  temporary_trigger.hours = command->hours;
  temporary_trigger.minutes = command->minutes;
  temporary_duration.minutes = command->duration_min;

  // Reset the is_lit_for_temporary flag, because this change could
  // cause the light to turn off, but we don't want to delete the
  // trigger in that case.
  is_lit_for_temporary = false;
  
  SendResponse(OK);  
}

void SendResponse(byte retcode) {
#if DEBUG
    Serial.println("SendResponse");
#endif

  Response r;
  memset(&r, 0, sizeof(r));
  r.retcode = retcode;

  Time t;
  if (!GetCurrentTimeFromClock(&t)) {
    r.retcode = CLOCK_MALFUNCTION;
#if DEBUG
    Serial.print("Code: ");
    Serial.println(r.retcode);
#endif
    BTSerial.write((byte*)&r, sizeof(Response));
    return;
  }

  r.current_hours = t.hours;
  r.current_minutes = t.minutes;
  r.current_seconds = t.seconds;
  r.permanent_hours = permanent_trigger.hours;
  r.permanent_minutes = permanent_trigger.minutes;

  r.has_temporary_trigger =
    (temporary_duration.minutes > 0);
  r.temporary_hours = temporary_trigger.hours;
  r.temporary_minutes = temporary_trigger.minutes;

#if DEBUG
    Serial.print("Code: ");
    Serial.println(r.retcode);
    Serial.print("Time: ");
    Serial.print(r.current_hours);
    Serial.print(":");
    Serial.print(r.current_minutes);
    Serial.print(":");
    Serial.println(r.current_seconds);
    Serial.print("Triggers: ");
    Serial.print(r.permanent_hours);
    Serial.print(":");
    Serial.print(r.permanent_minutes);
    Serial.print(", ");
    Serial.print(r.temporary_hours);
    Serial.print(":");
    Serial.print(r.temporary_minutes);
    if (r.has_temporary_trigger) {
      Serial.println(" (Ena)");
    } else {
      Serial.println(" (Dis)");
    }
#endif
  BTSerial.write((byte*)&r, sizeof(Response));
}


//////////////////////
// Clock functions
//////////////////////

int DecodeBCD(int bcd) {
  int tens = (bcd & 0xF0) >> 4;
  int ones = (bcd & 0x0F);
  return tens * 10 + ones;
}

int DecodeHours(int bcd) {
  int tens = (bcd & 0x30) >> 4;
  int ones = (bcd & 0x0F);
  return tens * 10 + ones;
}

int EncodeBcd(int num) {
  int ones = num % 10;
  int tens = (num - ones) / 10;
  return ones | (tens << 4);
}

void SetClock(Time* newtime) {
  // Sanity check the input data.
  if (newtime->hours < 0 || newtime->hours > 23) {
    return;
  }
  if (newtime->minutes < 0 || newtime->minutes > 59) {
    return;
  }
  if (newtime->seconds < 0 || newtime->seconds > 59) {
    return;
  }
  
  // Set the clock.
  Wire.beginTransmission(kClockAddress);
  Wire.write(0);
  Wire.write(EncodeBcd(newtime->seconds));  // seconds
  Wire.write(EncodeBcd(newtime->minutes));  // minutes
  Wire.write(EncodeBcd(newtime->hours));  // hours
  Wire.endTransmission();
}

bool GetCurrentTimeFromClock(Time* curtime) {
  // Request 3 bytes of data starting at address 0.
  Wire.beginTransmission(kClockAddress);
  Wire.write(0);
  Wire.endTransmission();

  bool success = true;

  // Make sure all 3 bytes are read.
  Wire.requestFrom(kClockAddress, 3);
  if (Wire.available()) {
    curtime->seconds = DecodeBCD(Wire.read());
  } else {
    success = false;
  }

  if (success && Wire.available()) {
    curtime->minutes = DecodeBCD(Wire.read());
  } else {
    success = false;
  }

  if (success && Wire.available()) {
    curtime->hours = DecodeHours(Wire.read());
  } else {
    success = false;
  }

  return success;
}

//////////////////////
// Time utilities
//////////////////////

bool IsTimeBetween(Time* current, Time* start, Duration* duration) {
  int end_hours = start->hours;
  int end_minutes = start->minutes + duration->minutes;

  while (end_minutes >= 60) {
    end_minutes -= 60;
    end_hours += 1;
  }

  //bool after_start = false;
  //if (current->hours > start->hours) {
  //  after_start = true;
  //} else if (current->hours == start->hours) {
  //  if (current->minutes >= start->minutes) {
  //    after_start = true;
  //  }
  //}

  //bool before_end = false;
  //if (current->hours < end_hours) {
  //  before_end = true;
  //} else if (current->hours == end_hours) {
  //  if (current->minutes < end_minutes) {
  //    before_end = true;
  //  }
  //}

  bool after_start =
    (current->hours > start->hours) ||
    ((current->hours == start->hours) && (current->minutes >= start->minutes));
  bool before_end =
    (current->hours < end_hours) ||
    ((current->hours == end_hours) && (current->minutes < end_minutes));
    
  return after_start && before_end;
}

