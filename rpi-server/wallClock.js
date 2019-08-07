var Time = require('./time');

module.exports = class WallClock {
  getCurrentTime() {
    var date = new Date();
    return new Time(date.getHours(), date.getMinutes(), date.getSeconds());
  }

  static isTimeBetween(currentTime, rangeStart, rangeDuration) {
    var endHours = rangeStart.hours;
    var endMinutes = rangeStart.minutes + rangeDuration;

    while (endMinutes >= 60) {
      endMinutes -= 60;
      endHours += 1;
    }

    var afterStart =
      (currentTime.hours > rangeStart.hours) ||
      ((currentTime.hours == rangeStart.hours) &&
        (currentTime.minutes >= rangeStart.minutes));
    var beforeEnd =
      (currentTime.hours < endHours) ||
      ((currentTime.hours == endHours) && (currentTime.minutes < endMinutes));

    return afterStart && beforeEnd;
  }
};
