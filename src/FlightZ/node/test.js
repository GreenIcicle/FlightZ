var seaport = require('seaport').connect('localhost', 9090);
seaport.register('foo');

setTimeout(function() {console.log(seaport.query());}, 500);

