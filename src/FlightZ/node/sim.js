
var pipeline = require('./Pipeline')
var simulator = require('./Simulator')
var seaportHost = 'localhost';
var seaportPort = 9090;
var seaport = require('seaport').connect(seaportHost, seaportPort);
var simServer = pipeline.createServer('flightZ-sim@1.0.0', seaport);
var planeCount = 0;
for(var index = 0; index < 1000; index++) {
    simServer.addSourceStream(simulator.createSimulationStream());
    planeCount++;
}
setInterval(function () {
    console.log(simServer.stats());
}, 1000);

