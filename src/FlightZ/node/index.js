
var pipeline = require('./Pipeline')
var simulator = require('./Simulator')
function pump(config) {
    return pipeline.createPumpStream(config);
}
exports.pump = pump;
function funnel(config) {
    return pipeline.createFunnelStream(config);
}
exports.funnel = funnel;
function simulatedPlane(from, to) {
    if (typeof from === "undefined") { from = null; }
    if (typeof to === "undefined") { to = null; }
    return simulator.createSimulationStream(from, to);
}
exports.simulatedPlane = simulatedPlane;

