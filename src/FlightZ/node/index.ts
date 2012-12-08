/// <reference path="node.d.ts"/>
export import flightZ = module('./Flight');
export import pipeline = module('./Pipeline');
export import simulator = module('./Simulator');

export function pump(config: any) => pipeline.createPumpStream(config);
export function funnel(config: any) => pipeline.createFunnelStream(config);
export function simulatedPlane(from: flightZ.Airport = null, to: flightZ.Airport = null) => 
                    simulator.createSimulationStream(from, to);