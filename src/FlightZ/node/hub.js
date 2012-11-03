
var pipeline = require('./Pipeline')

var seaportHost = 'localhost';
var seaportPort = 9090;
var seaport = require('seaport').connect(seaportHost, seaportPort);
var hubServer = pipeline.createServer('flightZ-hub@1.0.0', seaport);
setTimeout(function () {
    hubServer.addSource('flightZ-sim');
}, 2000);
setInterval(function () {
    console.log(hubServer.stats());
}, 1000);

