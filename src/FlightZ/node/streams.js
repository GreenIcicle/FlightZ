var Stream = require('stream');

function throttle(milliseconds) {
    var buffer = null;
    var intervalHandle;
    var stream = new Stream();
    stream.readable = true;
    stream.writable = true;
    stream.write = function (data) {
        buffer = data;
    };
    intervalHandle = setInterval(function () {
        if(buffer !== null) {
            stream.emit('data', buffer);
            buffer = null;
        }
    }, milliseconds);
    stream.destroy = function () {
        clearInterval(intervalHandle);
        stream.readable = false;
        stream.writable = false;
        stream.emit('close');
    };
    stream.end = function (data) {
        if (typeof data === "undefined") { data = null; }
        if(data !== null) {
            stream.emit('data', data);
        }
        stream.emit('end');
        stream.destroy();
    };
    return stream;
}
