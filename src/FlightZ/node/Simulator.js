var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Stream = require('stream');
var flightZ = require('./Flight')
var SimulatedPlane = (function (_super) {
    __extends(SimulatedPlane, _super);
    function SimulatedPlane(flight) {
        _super.call(this, flight, new flightZ.Position(0, 0), 0);
        this.MAX_SPEED = 900;
        this.position = this.fromPosition();
        this.fromPositionFix = this.fromPosition();
        this.toPositionFix = this.toPosition();
        this.totalDistance = this.fromPosition().distance(this.toPosition());
    }
    SimulatedPlane.prototype.launch = function () {
        this.timeLaunched = Date.now();
        this.speed = this.MAX_SPEED;
    };
    SimulatedPlane.prototype.updatePosition = function () {
        if(this.totalDistance === 0) {
            return;
        }
        var now = Date.now();
        var timeInAir = (now - this.timeLaunched) / 1000;
        var kilometersMoved = this.speed / 3600 * timeInAir;
        var fractionOfDistanceMoved = kilometersMoved / this.totalDistance;
        var totalDistanceLongitude = this.toPositionFix.longitude - this.fromPositionFix.longitude;
        var totalDistanceLatitude = this.toPositionFix.latitude - this.fromPositionFix.latitude;
        this.position = new flightZ.Position(this.fromPositionFix.longitude + totalDistanceLongitude * fractionOfDistanceMoved, this.fromPositionFix.latitude + totalDistanceLatitude * fractionOfDistanceMoved);
    };
    return SimulatedPlane;
})(flightZ.Plane);
exports.SimulatedPlane = SimulatedPlane;
function randomAirport() {
    var index = Math.floor(Math.random() * flightZ.airports.length);
    return flightZ.airports[index];
}
function createSimulationStream(fromAirport, toAirport) {
    if (typeof fromAirport === "undefined") { fromAirport = null; }
    if (typeof toAirport === "undefined") { toAirport = null; }
    if(!fromAirport) {
        fromAirport = randomAirport();
    }
    if(!toAirport) {
        toAirport = randomAirport();
    }
    var stream = new Stream();
    stream.readable = true;
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var flightNumber = Math.floor(Math.random() * 1000000).toString();
    var plane = new SimulatedPlane({
        from: fromAirport.key,
        to: toAirport.key,
        flightNumber: flightNumber,
        airline: 'SIMAIR',
        date: today.toISOString()
    });
    plane.launch();
    var handle = setInterval(function () {
        plane.updatePosition();
        stream.emit('data', plane.toJson());
        if(plane.isAtDestination()) {
            clearInterval(handle);
            stream.emit('end');
        }
    }, 1000);
    return stream;
}
exports.createSimulationStream = createSimulationStream;
