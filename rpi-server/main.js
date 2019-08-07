var process = require('process');
var AlarmController = require('./alarmController');
var BLEController = require('./bleController');
var CommandHandler = require('./commandHandler');
var LEDController = require('./ledController');
var WallClock = require('./wallClock');

var wallClock = new WallClock();
var ledController = new LEDController(12);
var alarmController = new AlarmController(wallClock, null, null, ledController);
alarmController.start();

var commandHandler = new CommandHandler(alarmController);

var bleController = new BLEController(commandHandler, null);
bleController.start();

process.on('SIGINT', function () {
    console.log("Caught interrupt signal");
    bleController.stop();
    alarmController.stop();
    ledController.stop();
    process.exit();
});
