/// <reference path="node.d.ts"/>
import flightZ = module('./index');

var seaportHost = 'localhost';
var seaportPort = 9090;

var pump = flightZ.pump({
    seaportHost: seaportHost,
    seaportPort: seaportPort,
    role: 'sim@1.0.0'
});

var planeCount = 0;
for (var index = 0; index < 1000; index++) {
    flightZ.simulatedPlane().pipe(pump);
    planeCount++;
}

setInterval(() => {
        console.log(pump.stats());
    }, 1000);