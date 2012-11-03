/// <reference path="node.d.ts"/>
export interface IPosition {
    longitude: number;
    latitude: number;
}

export interface IBoundary {
    north: number;
    east: number;
    south: number;
    west: number;
}

export interface IFlight {
    flightNumber: string;
    airline: string;
    date: string;
    from: string;
    to: string;
}

export class Position implements IPosition {
    constructor (public longitude: number, public latitude: number) { }

    static Copy(position: IPosition) {
        return new Position(position.longitude, position.latitude);
    }

    distance(other: IPosition, unit: string = "K") {
        var radlat1 = Math.PI * this.latitude / 180;
        var radlat2 = Math.PI * other.latitude / 180;
        var radlon1 = Math.PI * this.longitude / 180;
        var radlon2 = Math.PI * other.longitude / 180;
        var theta = this.longitude - other.longitude;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2)
                 + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        if (unit === "K") { dist = dist * 1.609344 }
        if (unit === "N") { dist = dist * 0.8684 }
        return dist;
    }

    // Returns if the plane is within a given geographic boundary
    isInBoundary(boundary: IBoundary) {

        // OK, this is not correct when you're flying over the Pacific or the poles.
        return (this.latitude <= boundary.north
            && this.latitude >= boundary.south
            && this.longitude <= boundary.east
            && this.longitude >= boundary.west);
    }
}

export class Plane {
       
    constructor (public flight: IFlight, public position: IPosition, public speed: number) {
    }

    isAtDestination() {
        var distanceToDestination = this.toPosition().distance(this.position);
        return distanceToDestination < 1;
    }

    toPosition(): Position {
        return Position.Copy(Airport.ByKey(this.flight.to).location);
    }

    fromPosition(): Position {
        return Position.Copy(Airport.ByKey(this.flight.from).location);
    }

    static parse(data: any) {
        data = JSON.parse(data);

        if (!data.flight || !data.position) {
            return null;
        }

        var flight: IFlight = {
            flightNumber: data.flight.flightNumber,
            airline: data.flight.airline,
            date: data.flight.date,
            from: data.flight.from,
            to: data.flight.to
        };

        var position: IPosition = {
            longitude: data.position.longitude,
            latitude: data.position.latitude,
        };

        return new Plane(flight, position, data.speed);
    }

    toJson() {
        return JSON.stringify({
            flight: this.flight,
            position: this.position,
            speed: this.speed
        });
    }
}

export class Airport {
    constructor (public key: string, public name: string, public location: IPosition) { }

    static ByKey(key: string) {
        var found: Airport = null;
        airports.forEach(value => {
            if (value.key === key) { found = value; }
        });
        return found;
    }
}

export var airports: Airport[] = [
    new Airport('FRA', 'Frankfurt', new Position(50.03774, 8.56213)),
    new Airport('MUC', 'München', new Position(48.34598, 11.78721)),
    new Airport('TXL', 'Berlin', new Position(52.55898, 13.28960)),
    new Airport('CGN', 'Köln/Bonn', new Position(50.87068, 7.13999)),
    new Airport('NCE', 'Nizza', new Position(43.65960, 7.20585)),
    new Airport('CDG', 'Paris Charles de Gaulle', new Position(48.99711, 2.57664)),
    new Airport('LHR', 'London Heathrow', new Position(51.47155, -0.45723)),
    new Airport('JFK', 'New York', new Position(40.64242, -73.78230)),
    new Airport('IST', 'Istanbul', new Position(40.97667, 28.81528)),
    new Airport('DME', 'Moskau', new Position(55.41457, 37.89949)),
    new Airport('AMS', 'Amsterdam', new Position(52.30570, 4.77047)),
    new Airport('SYD', 'Sydney', new Position(-33.942719, 151.168957)),
    new Airport('ATL', 'Atlanta', new Position(33.638936, -84.440360)),
    new Airport('BCN', 'Barcelona', new Position(41.297671, 2.081051)),
    new Airport('ORD', 'Chicago', new Position(41.970467, -87.924185)),
    new Airport('DXB', 'Dubai', new Position(25.252778, 55.364444)),
    new Airport('HKG', 'Hongkong', new Position(22.313873, 113.919983)),
    new Airport('BOM', 'Mumbai', new Position(19.092618, 72.864075)),
    new Airport('HDN', 'Tokio', new Position(35.543611, 139.802656)),
    new Airport('SIN', 'Singapur', new Position(1.355612, 103.996410))
];
