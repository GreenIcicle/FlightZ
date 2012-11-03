/// <reference path="node.d.ts"/>
import flightZ = module('./Flight');
import pipeline = module('./Pipeline');
import simulator = module('./Simulator');

export function pump(config: any) => pipeline.createPumpStream(config);
export function funnel(config: any) => pipeline.createFunnelStream(config);
export function simulatedPlane(from: flightZ.Airport = null, to: flightZ.Airport = null) => 
                    simulator.createSimulationStream(from, to);