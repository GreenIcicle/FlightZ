var Stream = require('stream');
var WebsocketClient = require('websocket').client;
var WebsocketServer = require('websocket').server;
var nodeStream = require('stream')
var http = require('http')
var flightZ = require('./Flight')
var POSITION_DATA_STREAM = 'flightZ-position-data-stream';
function createSourceStream(config) {
    if (typeof config === "undefined") { config = null; }
    var url;
    if(config.url) {
        url = config.url;
    } else {
        return null;
    }
    var stream = new Stream();
    stream.readable = true;
    var endStream = function () {
        return stream.emit('end');
    };
    var client = new WebsocketClient();
    client.on('connectFailed', function (error) {
        console.log('Connect Error: ' + error.toString());
    });
    client.on('connect', function (connection) {
        console.log('WebSocket client connected');
        client.on('disconnect', endStream);
        client.on('disconnect', endStream);
        client.on('error', endStream);
        connection.on('message', function (message) {
            var plane = flightZ.Plane.parse(message);
            if(plane) {
                stream.emit('data', plane.toJson());
            }
        });
        if(config) {
            connection.sendUTF(JSON.stringify(config));
        }
    });
    client.connect(url, POSITION_DATA_STREAM);
    return stream;
}
exports.createSourceStream = createSourceStream;
function createSinkStream(connection) {
    connection.on('message', function (message) {
        if(message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            connection.sendUTF(message.utf8Data);
        }
    });
    connection.on('close', function (reasonCode, description) {
        function () {
            return stream.destroy();
        }        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
    var stream = new Stream();
    stream.destroy = function () {
        return stream.writable = false;
    };
    stream.write = function (plane) {
        return connection.sendUTF(plane.toJson());
    };
    ; ;
    stream.end = function (plane) {
        if(arguments.length) {
            connection.sendUTF(plane.toJson());
        }
        stream.writable = false;
    };
    stream.writable = true;
    return stream;
}
exports.createSinkStream = createSinkStream;
function createHubStream() {
    var stream = new Stream();
    stream.setMaxListeners(0);
    var messageCount = 0;
    var lastMessageCountReset = Date.now();
    function processFlightData(data) {
        var plane = flightZ.Plane.parse(data);
        if(plane) {
            stream.emit('data', JSON.stringify(plane));
        }
    }
    stream.write = function (data) {
        processFlightData(data);
        messageCount++;
    };
    stream.end = function (data) {
        if(arguments.length) {
            processFlightData(data);
        }
    };
    stream.destroy = function () {
        return stream.writable = false;
    };
    stream.writable = true;
    stream.readable = true;
    stream.stats = function () {
        var now = Date.now();
        var messagesPerSecond = messageCount / (now - lastMessageCountReset) * 1000;
        lastMessageCountReset = now;
        messageCount = 0;
        return {
            messagesPerSecond: Math.floor(messagesPerSecond)
        };
    };
    return stream;
}
exports.createHubStream = createHubStream;
function createFunnelStream(config) {
    var urls = [];
    var sources = [];
    var stream = createHubStream();
    var seaport = null;
    var addSource = function (url) {
        if(urls.indexOf(url) !== -1) {
            return;
        }
        urls.push(url);
        var sourceStream = createSourceStream({
            url: url
        });
        sourceStream.pipe(stream);
        sources.push(sourceStream);
    };
    var registerSeaportSources = function () {
        seaport.get(config.role, function (sourcePorts) {
            return sourcePorts.forEach(function (sourcePort) {
                return addSource('http://' + sourcePort.host + ':' + sourcePort.port);
            });
        });
    };
    if(config.url) {
        addSource(config.url);
    } else {
        if(config.seaport) {
            seaport = config.seaport;
        } else {
            if(config.seaportHost && config.seaportPort) {
                seaport = require('seaport').connect(config.seaportHost, config.seaportPort);
            }
        }
    }
    if(urls.length === 0 && seaport && config.role) {
        registerSeaportSources();
        seaport.on('register', function () {
            return registerSeaportSources();
        });
    }
    var stats = stream.stats;
    stream.stats = function () {
        var statistics = stats();
        statistics.activeConnections = sources.filter(function (x) {
            return x.readable;
        }).length;
        return statistics;
    };
    return stream;
}
exports.createFunnelStream = createFunnelStream;
function createPumpStream(config) {
    var seaport = null;
    var port = 0;
    if(config.port) {
        port = config.port;
    } else {
        if(config.seaport) {
            seaport = config.seaport;
        } else {
            if(config.seaportHost && config.seaportPort) {
                seaport = require('seaport').connect(config.seaportHost, config.seaportPort);
            }
        }
    }
    if(port === 0 && seaport && config.role) {
        port = seaport.register(config.role);
    }
    var server = http.createServer(function (request, response) {
        response.writeHead(404, "Web sockets only");
        response.end();
    });
    server.listen(port, function () {
        console.log((new Date()) + ' Server is listening on port #' + port);
    });
    var server = new WebsocketServer({
        httpServer: server,
        autoAcceptConnections: true
    });
    var stream = createHubStream();
    var sinks = [];
    server.on('request', function (request) {
        var connection = request.accept(POSITION_DATA_STREAM, request.origin);
        var sinkStream = createSinkStream(connection);
        stream.pipe(sinkStream);
        sinks.push(sinkStream);
    });
    var stats = stream.stats;
    stream.stats = function () {
        var statistics = stats();
        statistics.activeConnections = sinks.filter(function (x) {
            return x.writable;
        }).length;
        return statistics;
    };
    return stream;
}
exports.createPumpStream = createPumpStream;
