var flightZ = require('./index')
var seaportHost = 'localhost';
var seaportPort = 9090;
var seaport = require('seaport').connect(seaportHost, seaportPort);
var pump = flightZ.pump({
    seaport: seaport,
    role: 'hub@1.0.0'
});
setTimeout(function () {
    var funnel = flightZ.funnel({
        seaport: seaport,
        role: 'sim'
    });
    funnel.pipe(pump);
    setInterval(function () {
        console.log(funnel.stats());
    }, 1000);
}, 2000);
