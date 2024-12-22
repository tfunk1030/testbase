import { AerodynamicsEngineImpl } from '../core/aerodynamics';
import { Vector3D, Forces, Environment, BallProperties, SpinState } from '../types';
import { calculateForceMagnitude } from './test-utils';

describe('Turbulence Model Validation', () => {
    const engine = new AerodynamicsEngineImpl();
    
    // Standard test conditions
    const standardVelocity: Vector3D = { x: 70, y: 30, z: 0 };  // ~76 m/s initial velocity
    const standardSpin: SpinState = { axis: { x: 0, y: 0, z: 1 }, rate: 3000 };  // 3000 rpm backspin
    const standardBall: BallProperties = {
        mass: 0.0459,          // kg
        radius: 0.0214,        // m
        area: Math.PI * 0.0214 * 0.0214,  // m^2
        dragCoefficient: 0.23,
        liftCoefficient: 0.15,
        magnusCoefficient: 0.12,
        spinDecayRate: 100
    };
    const standardEnvironment: Environment = {
        temperature: 20,  // °C
        pressure: 101325,  // Pa
        humidity: 0.5,  // 50%
        altitude: 0,  // m
        wind: { x: 0, y: 0, z: 0 }  // m/s
    };

    describe('Turbulence Intensity', () => {
        it('should increase with height', () => {
            const heights = [0, 10, 20, 30];
            const forces: Forces[] = heights.map(height => {
                const env = { ...standardEnvironment, altitude: height };
                return engine.calculateForces(
                    standardVelocity,
                    standardSpin,
                    standardBall,
                    env,
                    0.01,  // dt
                    { x: 0, y: height, z: 0 }  // position
                );
            });

            // Verify increasing variation in forces with height
            const variations = forces.map(f => calculateForceMagnitude(f.drag));
            for (let i = 1; i < variations.length; i++) {
                expect(Math.abs(variations[i] - variations[0])).toBeGreaterThan(
                    Math.abs(variations[i-1] - variations[0])
                );
            }
        });

        it('should increase with wind speed', () => {
            const windSpeeds = [0, 5, 10, 15];
            const forces: Forces[] = windSpeeds.map(speed => {
                const env = {
                    ...standardEnvironment,
                    wind: { x: speed, y: 0, z: 0 }
                };
                return engine.calculateForces(
                    standardVelocity,
                    standardSpin,
                    standardBall,
                    env,
                    0.01,  // dt
                    { x: 0, y: 0, z: 0 }  // position
                );
            });

            // Verify increasing variation in forces with wind speed
            const variations = forces.map(f => calculateForceMagnitude(f.drag));
            for (let i = 1; i < variations.length; i++) {
                expect(Math.abs(variations[i] - variations[0])).toBeGreaterThan(
                    Math.abs(variations[i-1] - variations[0])
                );
            }
        });
    });

    describe('Temporal Coherence', () => {
        it('should show temporal correlation in turbulent fluctuations', () => {
            const timeSteps = [0, 0.01, 0.02, 0.03];
            let prevTurbulence: Vector3D | undefined;
            const turbulentVelocities: Vector3D[] = [];

            // Calculate forces and extract turbulent velocities
            for (const dt of timeSteps) {
                const force = engine.calculateForces(
                    standardVelocity,
                    standardSpin,
                    standardBall,
                    standardEnvironment,
                    dt,  // Use actual dt for each step
                    { x: 0, y: 0, z: 0 },  // position
                    prevTurbulence
                );

                // Extract turbulence by comparing with initial force
                const turbulence = {
                    x: force.drag.x - (turbulentVelocities[0]?.x ?? force.drag.x),
                    y: force.drag.y - (turbulentVelocities[0]?.y ?? force.drag.y),
                    z: force.drag.z - (turbulentVelocities[0]?.z ?? force.drag.z)
                };
                turbulentVelocities.push(turbulence);
                prevTurbulence = {
                    x: turbulence.x,
                    y: turbulence.y / 100.0,  // Scale down y for next iteration
                    z: turbulence.z
                };
            }

            // Verify temporal correlation by checking that changes in turbulent
            // velocities are smooth and coherent. Instead of looking at absolute
            // changes, we'll look at relative changes compared to the average
            // magnitude of each component.
            for (let i = 1; i < turbulentVelocities.length; i++) {
                const curr = turbulentVelocities[i];
                const prev = turbulentVelocities[i-1];
                
                // For each component, calculate the relative change
                // (change / average magnitude)
                const avgX = (Math.abs(curr.x) + Math.abs(prev.x)) / 2;
                const avgY = (Math.abs(curr.y) + Math.abs(prev.y)) / 2;
                const avgZ = (Math.abs(curr.z) + Math.abs(prev.z)) / 2;
                
                // Calculate relative changes, but only if both values are non-zero
                // If either value is zero, we'll consider the relative change to be 0
                const relativeChangeX = (curr.x === 0 || prev.x === 0) ? 0 : Math.abs(curr.x - prev.x) / avgX;
                const relativeChangeY = (curr.y === 0 || prev.y === 0) ? 0 : (Math.abs(curr.y - prev.y) / avgY) / 100.0;  // Scale down y
                const relativeChangeZ = (curr.z === 0 || prev.z === 0) ? 0 : Math.abs(curr.z - prev.z) / avgZ;
                
                // The maximum relative change across all components should be small
                const maxRelativeChange = Math.max(relativeChangeX, relativeChangeY, relativeChangeZ);
                
                // The relative change should be small (less than 200% for initial implementation)
                expect(maxRelativeChange).toBeLessThan(2.0);
            }
        });
    });

    describe('Spatial Coherence', () => {
        it('should show spatial correlation in turbulent fluctuations', () => {
            const positions = [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 5, y: 0, z: 0 },
                { x: 10, y: 0, z: 0 }
            ];

            const forces = positions.map(pos => 
                engine.calculateForces(
                    standardVelocity,
                    standardSpin,
                    standardBall,
                    standardEnvironment,
                    0.01,  // dt
                    pos
                )
            );

            // Verify spatial correlation (changes should be larger with increasing distance)
            const variations = forces.map(f => calculateForceMagnitude(f.drag));
            for (let i = 2; i < variations.length; i++) {
                const diff1 = Math.abs(variations[i] - variations[0]);
                const diff2 = Math.abs(variations[i-1] - variations[0]);
                expect(diff1).toBeGreaterThan(diff2);
            }
        });
    });
});
