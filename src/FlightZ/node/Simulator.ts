/// <reference path="node.d.ts"/>
var Stream = require('stream');
import flightZ = module('./Flight');

export class SimulatedPlane extends flightZ.Plane {

    MAX_SPEED = 900;

    timeLaunched: number;
    totalDistance: number;
    fromPositionFix: flightZ.Position;
    toPositionFix: flightZ.Position;

    constructor (flight: flightZ.IFlight) {
        super(flight, new flightZ.Position(0, 0), 0)
        this.position = this.fromPosition();
        this.fromPositionFix = this.fromPosition();
        this.toPositionFix = this.toPosition();

        this.totalDistance = this.fromPosition().distance(this.toPosition());
    }

    launch() {
        this.timeLaunched = Date.now();
        this.speed = this.MAX_SPEED;
    }

    updatePosition() {
        if (this.totalDistance === 0) {
            return;
        }

        var now = Date.now();
        var timeInAir = (now - this.timeLaunched) / 1000;
        var kilometersMoved = this.speed / 3600 * timeInAir;
        var fractionOfDistanceMoved = kilometersMoved / this.totalDistance;

        var totalDistanceLongitude = this.toPositionFix.longitude - this.fromPositionFix.longitude;
        var totalDistanceLatitude = this.toPositionFix.latitude - this.fromPositionFix.latitude;   

        this.position = new flightZ.Position(
            this.fromPositionFix.longitude + totalDistanceLongitude * fractionOfDistanceMoved,
            this.fromPositionFix.latitude + totalDistanceLatitude * fractionOfDistanceMoved);   
    }
}

function randomAirport {
    var index = Math.floor(Math.random() * flightZ.airports.length);
    return flightZ.airports[index];
}

export function createSimulationStream(fromAirport: flightZ.Airport = null, toAirport: flightZ.Airport = null) {

    if (!fromAirport) fromAirport = randomAirport();
    if (!toAirport) toAirport = randomAirport();

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

    var handle = setInterval(() => { 
            plane.updatePosition();
            stream.emit('data', plane.toJson());
            if (plane.isAtDestination()) {
                clearInterval(handle);
                stream.emit('end');
            }
        }, 1000);
    
    return stream;
}