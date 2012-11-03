var Stream = require('stream');
var ioClient = require('socket.io-client');
var ioServer = require('socket.io');
var nodeStream = require('stream')
var flightZ = require('./Flight')
var MESSAGE_PLANEUPDATE = "planeUpdate";
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
    var client = ioClient.connect(url);
    client.socket.reconnect();
    client.on('connect', function () {
        client.on(MESSAGE_PLANEUPDATE, function (data) {
            var plane = flightZ.Plane.parse(data);
            if(plane) {
                stream.emit('data', plane.toJson());
            }
        });
        client.on('disconnect', function () {
            return stream.emit('end');
        });
        if(config) {
            client.emit('config', config);
        }
    });
    return stream;
}
exports.createSourceStream = createSourceStream;
function createSinkStream(socket) {
    var stream = new Stream();
    stream.write = function (plane) {
        return socket.emit(MESSAGE_PLANEUPDATE, plane);
    };
    stream.end = function (plane) {
        if(arguments.length) {
            socket.emit(MESSAGE_PLANEUPDATE, plane);
        }
        stream.writable = false;
    };
    stream.destroy = function () {
        return stream.writable = false;
    };
    socket.on('disconnect', function () {
        return stream.destroy();
    });
    stream.writable = true;
    return stream;
}
exports.createSinkStream = createSinkStream;
function createHubStream() {
    var stream = new Stream();
    stream.setMaxListeners(0);
    var messageCount = 0;
    var lastMessageCountReset = Date.now();
    function processData(data) {
        var plane = flightZ.Plane.parse(data);
        if(plane) {
            stream.emit('data', JSON.stringify(plane));
        }
    }
    stream.write = function (data) {
        processData(data);
        messageCount++;
    };
    stream.end = function (data) {
        if(arguments.length) {
            processData(data);
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
    var server = ioServer.listen(port);
    server.set('log level', 1);
    var stream = createHubStream();
    var sinks = [];
    server.sockets.on('connection', function (socket) {
        var sinkStream = createSinkStream(socket);
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

