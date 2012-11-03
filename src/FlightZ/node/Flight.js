var Position = (function () {
    function Position(longitude, latitude) {
        this.longitude = longitude;
        this.latitude = latitude;
    }
    Position.Copy = function Copy(position) {
        return new Position(position.longitude, position.latitude);
    }
    Position.prototype.distance = function (other, unit) {
        if (typeof unit === "undefined") { unit = "K"; }
        var radlat1 = Math.PI * this.latitude / 180;
        var radlat2 = Math.PI * other.latitude / 180;
        var radlon1 = Math.PI * this.longitude / 180;
        var radlon2 = Math.PI * other.longitude / 180;
        var theta = this.longitude - other.longitude;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        if(unit === "K") {
            dist = dist * 1.609344;
        }
        if(unit === "N") {
            dist = dist * 0.8684;
        }
        return dist;
    };
    Position.prototype.isInBoundary = function (boundary) {
        return (this.latitude <= boundary.north && this.latitude >= boundary.south && this.longitude <= boundary.east && this.longitude >= boundary.west);
    };
    return Position;
})();
exports.Position = Position;
var Plane = (function () {
    function Plane(flight, position, speed) {
        this.flight = flight;
        this.position = position;
        this.speed = speed;
    }
    Plane.prototype.isAtDestination = function () {
        var distanceToDestination = this.toPosition().distance(this.position);
        return distanceToDestination < 1;
    };
    Plane.prototype.toPosition = function () {
        return Position.Copy(Airport.ByKey(this.flight.to).location);
    };
    Plane.prototype.fromPosition = function () {
        return Position.Copy(Airport.ByKey(this.flight.from).location);
    };
    Plane.parse = function parse(data) {
        data = JSON.parse(data);
        if(!data.flight || !data.position) {
            return null;
        }
        var flight = {
            flightNumber: data.flight.flightNumber,
            airline: data.flight.airline,
            date: data.flight.date,
            from: data.flight.from,
            to: data.flight.to
        };
        var position = {
            longitude: data.position.longitude,
            latitude: data.position.latitude
        };
        return new Plane(flight, position, data.speed);
    }
    Plane.prototype.toJson = function () {
        return JSON.stringify({
            flight: this.flight,
            position: this.position,
            speed: this.speed
        });
    };
    return Plane;
})();
exports.Plane = Plane;
var Airport = (function () {
    function Airport(key, name, location) {
        this.key = key;
        this.name = name;
        this.location = location;
    }
    Airport.ByKey = function ByKey(key) {
        var found = null;
        exports.airports.forEach(function (value) {
            if(value.key === key) {
                found = value;
            }
        });
        return found;
    }
    return Airport;
})();
exports.Airport = Airport;
exports.airports = [
    new Airport('FRA', 'Frankfurt', new Position(50.03774, 8.56213)), 
    new Airport('MUC', 'München', new Position(48.34598, 11.78721)), 
    new Airport('TXL', 'Berlin', new Position(52.55898, 13.2896)), 
    new Airport('CGN', 'Köln/Bonn', new Position(50.87068, 7.13999)), 
    new Airport('NCE', 'Nizza', new Position(43.6596, 7.20585)), 
    new Airport('CDG', 'Paris Charles de Gaulle', new Position(48.99711, 2.57664)), 
    new Airport('LHR', 'London Heathrow', new Position(51.47155, -0.45723)), 
    new Airport('JFK', 'New York', new Position(40.64242, -73.7823)), 
    new Airport('IST', 'Istanbul', new Position(40.97667, 28.81528)), 
    new Airport('DME', 'Moskau', new Position(55.41457, 37.89949)), 
    new Airport('AMS', 'Amsterdam', new Position(52.3057, 4.77047)), 
    new Airport('SYD', 'Sydney', new Position(-33.942719, 151.168957)), 
    new Airport('ATL', 'Atlanta', new Position(33.638936, -84.44036)), 
    new Airport('BCN', 'Barcelona', new Position(41.297671, 2.081051)), 
    new Airport('ORD', 'Chicago', new Position(41.970467, -87.924185)), 
    new Airport('DXB', 'Dubai', new Position(25.252778, 55.364444)), 
    new Airport('HKG', 'Hongkong', new Position(22.313873, 113.919983)), 
    new Airport('BOM', 'Mumbai', new Position(19.092618, 72.864075)), 
    new Airport('HDN', 'Tokio', new Position(35.543611, 139.802656)), 
    new Airport('SIN', 'Singapur', new Position(1.355612, 103.99641))
];

