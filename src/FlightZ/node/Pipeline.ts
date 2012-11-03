/// <reference path="node.d.ts"/>
var Stream = require('stream');
var ioClient = require('socket.io-client');
var ioServer = require('socket.io');
import nodeStream = module('stream');
import flightZ = module('./Flight');

var MESSAGE_PLANEUPDATE = "planeUpdate";

interface ISocket {
    on(messageType: string, callback: () => void);
    emit(messageType: string, message: any);
}

export function createSourceStream(url: string, config: any = null): nodeStream.ReadableStream {

    // Create a stream to write the received plane updates to
    var stream = new Stream();
    stream.readable = true;
    var client = ioClient.connect(url);    
    client.socket.reconnect();

    client.on('connect', () => {
        client.on(MESSAGE_PLANEUPDATE, data => {
            var plane = flightZ.Plane.parse(data);
            if (plane) {
                stream.emit('data', plane.toJson());
            }
        });

        client.on('disconnect', () => stream.emit('end'));

        if (config) {
            client.emit('config', config);
        }
    });

    return stream;
}

// Returns a stream that serves an outgoing web socket connection 
export function createSinkStream(socket: ISocket): nodeStream.WritableStream {

    // Create a stream to read plane updates from
    var stream = new Stream();

    stream.write = function(plane: flightZ.Plane) {
        socket.emit(MESSAGE_PLANEUPDATE, plane);
    };

    stream.end = function(plane: flightZ.Plane) {
        if (arguments.length) socket.emit(MESSAGE_PLANEUPDATE, plane);

        stream.writable = false;
    };

    stream.destroy = () => stream.writable = false;    

    socket.on('disconnect', () => stream.destroy());

    stream.writable = true;
    return stream;
}

// Returns a stream that allows multiple incoming and multiple outgoing streams.
// Incioming data is parsed and sanitized before it's passed to the outgoing streams.
export function createHubStream(): nodeStream.ReadWriteStream {
    var stream = new Stream();
    stream.setMaxListeners(0);

    function processData(data) {
        var plane = flightZ.Plane.parse(data);
        if (plane) {
            stream.emit('data', JSON.stringify(plane));
        }
    }

    stream.write = (data) => processData(data);

    stream.end = (data) => {
        // Do not end this stream when one of the source stream ends; 
        // there may be others.
        if (arguments.length) processData(data);
    };

    stream.destroy = () => stream.writable = false;

    stream.writable = true;
    stream.readable = true;
    return stream;
}

// Returns a server component that listens for web sockets connections,
// and allows incoming streams to connect.
export function createServer(role: string, seaport: any) {

    // Get a port from Seaport...
    var port: number = seaport.register(role);

    // ... and have socket.io listen on that port.
    var server = ioServer.listen(port);
    server.set('log level', 1);
    
    var hubStream = createHubStream();

    var sinks = [];
    var sources = [];

    server.sockets.on('connection', socket => {
        // create sink stream for socket, pipe messages from hub stream into it
        var sinkStream = createSinkStream(socket);
        hubStream.pipe(sinkStream);

        // Add sink stream to array so the GC does not scrap it
        sinks.push(sinkStream);
    });

    return {
        
        addSourceStream: function(sourceStream: nodeStream.ReadableStream) {
            sourceStream.pipe(hubStream);
            sources.push(sourceStream);
        },

        addSource: function (role: string) {
            // Get the ports that pumps with a specified role listen on,
            // and connect to them
            var sourcePorts = seaport.query(role);
            sourcePorts.forEach(function (sourcePort) { 
                var url = 'http://' + sourcePort.host + ':' + sourcePort.port;
                var sourceStream = createSourceStream(url);
                sourceStream.pipe(hubStream);
                // Add source stream to array so the GC does not scrap it
                sources.push(sourceStream);
            });                      
        },

        stats: function() {
            return {
                port: port,
                activeSinks: sinks.filter(x => x.writable).length,
                activeSources: sources.filter(x => x.readable).length,
            };
        }
    }
}