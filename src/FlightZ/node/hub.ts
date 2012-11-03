/// <reference path="node.d.ts"/>
import flightZ = module('./index');

var seaportHost = 'localhost';
var seaportPort = 9090;
var seaport = require('seaport').connect(seaportHost, seaportPort);

var pump = flightZ.pump({
    seaport: seaport,
    role: 'hub@1.0.0'
});

// Can't connect a client at once, seaport resyncs after registering
// a port, querying for roles fails in this interval
setTimeout(() => {
    var funnel = flightZ.funnel({
        seaport: seaport,
        role: 'sim'});
    funnel.pipe(pump);

    setInterval(() => {
        console.log(funnel.stats());
    }, 1000);

}, 2000);