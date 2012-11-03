/// <reference path="node.d.ts"/>
import flightZ = module('./Flight');
import pipeline = module('./Pipeline');
import simulator = module('./Simulator');

var seaportHost = 'localhost';
var seaportPort = 9090;
var seaport = require('seaport').connect(seaportHost, seaportPort);

var hubServer = pipeline.createServer('flightZ-hub@1.0.0', seaport);
setTimeout(function () { hubServer.addSource('flightZ-sim') }, 2000);

setInterval(() => {
        console.log(hubServer.stats());
    }, 1000);