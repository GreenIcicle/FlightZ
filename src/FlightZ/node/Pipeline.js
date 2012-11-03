var Stream = require('stream');
var ioClient = require('socket.io-client');
var ioServer = require('socket.io');

var flightZ = require('./Flight')
var MESSAGE_PLANEUPDATE = "planeUpdate";
function createSourceStream(url, config) {
    if (typeof config === "undefined") { config = null; }
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
        socket.emit(MESSAGE_PLANEUPDATE, plane);
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
    function processData(data) {
        var plane = flightZ.Plane.parse(data);
        if(plane) {
            stream.emit('data', JSON.stringify(plane));
        }
    }
    stream.write = function (data) {
        return processData(data);
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
    return stream;
}
exports.createHubStream = createHubStream;
function createServer(role, seaport) {
    var port = seaport.register(role);
    var server = ioServer.listen(port);
    server.set('log level', 1);
    var hubStream = createHubStream();
    var sinks = [];
    var sources = [];
    server.sockets.on('connection', function (socket) {
        var sinkStream = createSinkStream(socket);
        hubStream.pipe(sinkStream);
        sinks.push(sinkStream);
    });
    return {
        addSourceStream: function (sourceStream) {
            sourceStream.pipe(hubStream);
            sources.push(sourceStream);
        },
        addSource: function (role) {
            var sourcePorts = seaport.query(role);
            sourcePorts.forEach(function (sourcePort) {
                var url = 'http://' + sourcePort.host + ':' + sourcePort.port;
                var sourceStream = createSourceStream(url);
                sourceStream.pipe(hubStream);
                sources.push(sourceStream);
            });
        },
        stats: function () {
            return {
                port: port,
                activeSinks: sinks.filter(function (x) {
                    return x.writable;
                }).length,
                activeSources: sources.filter(function (x) {
                    return x.readable;
                }).length
            };
        }
    };
}
exports.createServer = createServer;

