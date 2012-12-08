/// <reference path="node.d.ts"/>
var Stream = require('stream');
import streamInterfaces = module('stream');

function throttle(milliseconds: number) : streamInterfaces.ReadWriteStream {

    var buffer = null;
    var intervalHandle: number;

    // Wire up a new read/write stream
    var stream = new Stream();
    stream.readable = true;
    stream.writable = true;

    // When data hits the steam, put it in a buffer
    stream.write = (data) => {
        buffer = data;
    };

    // Push data out only at given intervals. Reset the buffer
    // when data has been send out. If the buffer had been empty 
    // all along, do nothing.
    intervalHandle = setInterval(() => { 
        if (buffer !== null) {
            stream.emit('data', buffer);
            buffer = null;
        }
    }, milliseconds);

    // Close the stream: make it unreadable and unwritable,
    // stop the interval, inform listeners
    stream.destroy = () => {
        clearInterval(intervalHandle);
        stream.readable = false;
        stream.writable = false;
        stream.emit('close');
    };

    stream.end = (data = null) => {
        // If a last piece of data is passed in the 'end' call,
        // pass this piece of data out directly
        if (data !== null) {
            stream.emit('data', data);
        }
        stream.emit('end');
        stream.destroy();
    };

    return stream;
}