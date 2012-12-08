/// <reference path="node.d.ts"/>
var Stream = require('stream');
var WebsocketClient = require('websocket').client;
var WebsocketServer = require('websocket').server;
export import nodeStream = module('stream');
import http = module('http');
export import flightZ = module('./Flight');

var POSITION_DATA_STREAM = 'flightZ-position-data-stream';

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

    var endStream = () => stream.emit('end');

    var client = new WebsocketClient();

    client.on('connectFailed', error => {
        console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', connection => {
        console.log('WebSocket client connected');

        client.on('disconnect', endStream);
        client.on('disconnect', endStream);
        client.on('error', endStream);

        connection.on('message', message =>  {
            var plane = flightZ.Plane.parse(message);
            if (plane) {
                stream.emit('data', plane.toJson());
            }
        });

        if (config) {
            connection.sendUTF(JSON.stringify(config));
        }
    });

    client.connect(url, POSITION_DATA_STREAM);

    return stream;
}

// Returns a stream that serves an outgoing web socket connection 
export function createSinkStream(connection: any): nodeStream.WritableStream {

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            connection.sendUTF(message.utf8Data);
        }
    });
    connection.on('close', function(reasonCode, description) {
        () => stream.destroy();
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

    // Create a stream to read plane updates from
    var stream = new Stream();
    stream.destroy = () => stream.writable = false;
    stream.write = (plane: flightZ.Plane) => connection.sendUTF(plane.toJson());;

    stream.end = (plane: flightZ.Plane) => {
        if (arguments.length) connection.sendUTF(plane.toJson());
        stream.writable = false;
    };

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

    // ... and have a http server listen on that port.
    var server = http.createServer((request, response) => {
        response.writeHead(404, "Web sockets only");
        response.end();
    });

    server.listen(port, () => {
        console.log((new Date()) + ' Server is listening on port #' + port);
    });

    var server = new WebsocketServer({
        httpServer: server,
        autoAcceptConnections: true
    });

    var stream = createHubStream();

    var sinks = [];


    server.on('request', request => {
        var connection = request.accept(POSITION_DATA_STREAM, request.origin);

         // create sink stream for socket, pipe messages from hub stream into it
        var sinkStream = createSinkStream(connection);
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