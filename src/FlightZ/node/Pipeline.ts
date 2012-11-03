/// <reference path="node.d.ts"/>
var Stream = require('stream');
var ioClient = require('socket.io-client');
var ioServer = require('socket.io');
import nodeStream = module('stream');
import flightZ = module('./Flight');

var MESSAGE_PLANEUPDATE = "planeUpdate";

interface ISocket {
    on(messageType: string, callback: () => void );
    emit(messageType: string, message: any);
}

export interface IPumpStream extends nodeStream.ReadWriteStream {
    stats(): any;
}

export function createSourceStream(config: any = null): nodeStream.ReadableStream {
    var url: string;

    // Parse the configuration: if there is a URL given, use it.
    // Else, resolve the URL from seaport.
    if (config.url) {
        url = config.url;
    }
    else {
        return null;
    }

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

    stream.write = (plane: flightZ.Plane) => socket.emit(MESSAGE_PLANEUPDATE, plane);

    stream.end = (plane: flightZ.Plane) => {
        if (arguments.length) socket.emit(MESSAGE_PLANEUPDATE, plane);
        stream.writable = false;
    };

    stream.destroy = () => stream.writable = false;

    socket.on('disconnect', () => stream.destroy());

    stream.writable = true;
    return stream;
}


// Returns a stream that allows multiple incoming and multiple outgoing streams.
// Incoming data is parsed and sanitized before it's passed to the outgoing streams.
export function createHubStream(): IPumpStream {
    var stream = new Stream();
    stream.setMaxListeners(0);

    var messageCount: number = 0;
    var lastMessageCountReset: number = Date.now();

    function processFlightData(data) {
        var plane = flightZ.Plane.parse(data);
        if (plane) {
            stream.emit('data', JSON.stringify(plane));
        }
    }

    stream.write = (data) => {
        processFlightData(data);
        messageCount++;
    }

    stream.end = (data) => {
        // Do not end this stream when one of the source stream ends; 
        // there may be others.
        if (arguments.length) processFlightData(data);
    };

    stream.destroy = () => stream.writable = false;

    stream.writable = true;
    stream.readable = true;

     stream.stats = () => {
         var now = Date.now();
         var messagesPerSecond = messageCount / (now - lastMessageCountReset) * 1000;
         lastMessageCountReset = now;
         messageCount = 0;

         return {
             messagesPerSecond: Math.floor(messagesPerSecond)
        };
    }

    return stream;
}

export function createFunnelStream(config: any): IPumpStream {
    var urls: string[] = [];
    var sources = [];
    var stream = createHubStream();
    var seaport = null;
    
    var addSource = url => {
        // See that we don't connect to the same source twice
        if (urls.indexOf(url) !== -1) return;
        urls.push(url);

        var sourceStream = createSourceStream({ url: url });
        sourceStream.pipe(stream);
        // Add source stream to array so the GC does not scrap it
        sources.push(sourceStream);
    };

    var registerSeaportSources = () => {
        // Get the ports that pumps with a specified role listen on,
        // and connect to them
        seaport.get(config.role, sourcePorts =>
            sourcePorts.forEach(sourcePort => addSource('http://' + sourcePort.host + ':' + sourcePort.port)));
    };
    
    // If a url is defined in the config directly, use it; otherwise,
    // resolve a role against seaport
    if (config.url) {
        addSource(config.url);
    }
    else if (config.seaport) {
        seaport = config.seaport;
    }
    else if (config.seaportHost && config.seaportPort) {
        seaport = require('seaport').connect(config.seaportHost, config.seaportPort);
    }
    if (urls.length === 0 && seaport && config.role) {
        registerSeaportSources();
        seaport.on('register', () => registerSeaportSources());
    }
        
    // Extend the statistics of the stream by the number of connections
    var stats = stream.stats;
    stream.stats = () => {
        var statistics = stats();
        statistics.activeConnections = sources.filter(x => x.readable).length
        return statistics;
    };

    return stream;
}

// Returns a server component that listens for web sockets connections,
// and allows incoming streams to connect.
export function createPumpStream(config: any): IPumpStream {
    var seaport = null;
    var port: number = 0;

    // If a port is defined in the config directly, use it; otherwise,
    // get a port from seaport...
    if (config.port) {
        port = config.port;
    }
    else if (config.seaport) {
        seaport = config.seaport;
    }
    else if (config.seaportHost && config.seaportPort) {
        seaport = require('seaport').connect(config.seaportHost, config.seaportPort);
    }
    if (port === 0 && seaport && config.role) {
        port = seaport.register(config.role);
    }

    // ... and have socket.io listen on that port.
    var server = ioServer.listen(port);
    server.set('log level', 1);

    var stream = createHubStream();

    var sinks = [];

    server.sockets.on('connection', socket => {
        // create sink stream for socket, pipe messages from hub stream into it
        var sinkStream = createSinkStream(socket);
        stream.pipe(sinkStream);

        // Add sink stream to array so the GC does not scrap it
        sinks.push(sinkStream);
    });

    // Extend the statistics of the stream by the number of connections
    var stats = stream.stats;
    stream.stats = () => {
        var statistics = stats();
        statistics.activeConnections = sinks.filter(x => x.writable).length
        return statistics;
    };

    return stream;
}