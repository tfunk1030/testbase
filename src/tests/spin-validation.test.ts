import { SpinDynamicsEngine } from '../core/spin-dynamics';
import { Environment, BallProperties, SpinState } from '../core/types';

describe('Spin Dynamics Validation', () => {
    const spinEngine = new SpinDynamicsEngine();
    
    // Standard test conditions
    const standardBall: BallProperties = {
        mass: 0.0459,          // kg
        radius: 0.0214,        // m
        area: Math.PI * 0.0214 * 0.0214,  // m^2
        dragCoefficient: 0.23,
        liftCoefficient: 0.15,
        magnusCoefficient: 0.12,
        spinDecayRate: 100     // rpm/s
    };

    const standardEnv: Environment = {
        temperature: 20,          // °C
        pressure: 101325,         // Pa
        humidity: 0.5,            // 50%
        altitude: 0,              // m
        wind: { x: 0, y: 0, z: 0 }
    };

    describe('Spin Decay Validation', () => {
        it('should match empirical spin decay data', () => {
            const initialSpin: SpinState = {
                rate: 3000,  // rpm
                axis: { x: 0, y: 1, z: 0 }
            };

            const velocity = { x: 44.7, y: 0, z: 0 };  // 100mph
            const timeSteps = [1, 2, 3, 4, 5];
            
            // Expected decay rates from wind tunnel data
            const expectedRates = [
                0.92,   // 8% decay after 1s
                0.85,   // 15% decay after 2s
                0.78,   // 22% decay after 3s
                0.72,   // 28% decay after 4s
                0.66    // 34% decay after 5s
            ];

            timeSteps.forEach((time, index) => {
                const newState = spinEngine.updateSpinState(
                    initialSpin,
                    standardBall,
                    standardEnv,
                    velocity,
                    time
                );

                const actualRate = newState.rate / initialSpin.rate;
                expect(Math.abs(actualRate - expectedRates[index])).toBeLessThan(0.05);
            });
        });

        it('should show increased decay at higher speeds', async () => {
            const initialSpin: SpinState = {
                axis: { x: 0, y: 0, z: 1 },
                rate: 3000
            };

            let previousRate = 0;
            [30, 45, 60, 75].forEach(async speed => {
                const velocity: any = { x: 0, y: 0, z: speed };
                const newState = await spinEngine.updateSpinState(
                    initialSpin,
                    standardBall,
                    standardEnv,
                    velocity,
                    0.01  // dt
                );
                const decayRate = (initialSpin.rate - newState.rate) / 0.01;  // rpm/s
                if (previousRate > 0) {
                    expect(decayRate).toBeGreaterThan(previousRate * 1.05);  // At least 5% increase
                }
                previousRate = decayRate;
            });
        });

        it('should show reduced decay at higher altitude', () => {
            const initialSpin: SpinState = {
                rate: 3000,
                axis: { x: 0, y: 1, z: 0 }
            };

            const velocity = { x: 44.7, y: 0, z: 0 };
            const time = 2.0;

            // Test at different altitudes
            const altitudes = [0, 1000, 2000];  // meters
            let previousDecay = 1.0;

            altitudes.forEach(altitude => {
                const envAtAltitude: Environment = {
                    ...standardEnv,
                    altitude,
                    pressure: 101325 * Math.exp(-altitude / 7400)  // Approximate pressure variation
                };

                const newState = spinEngine.updateSpinState(
                    initialSpin,
                    standardBall,
                    envAtAltitude,
                    velocity,
                    time
                );

                const decay = 1 - (newState.rate / initialSpin.rate);
                expect(decay).toBeLessThan(previousDecay);
                previousDecay = decay;
            });
        });

        it('should validate gyroscopic stability', () => {
            const initialSpin: SpinState = {
                rate: 3000,
                axis: { x: 0.707, y: 0.1, z: 0.707 }  // Initial tilt with small vertical component
            };

            const velocity = { x: 44.7, y: 0, z: 0 };
            const timeSteps = [1, 2, 3];

            let previousYComponent = initialSpin.axis.y;
            timeSteps.forEach(time => {
                const newState = spinEngine.updateSpinState(
                    { ...initialSpin },  // Use fresh copy each time
                    standardBall,
                    standardEnv,
                    velocity,
                    time
                );

                // Axis should gradually become more vertical
                expect(newState.axis.y).toBeGreaterThan(previousYComponent);
                previousYComponent = newState.axis.y;

                // Axis should remain normalized
                const magnitude = Math.sqrt(
                    newState.axis.x * newState.axis.x +
                    newState.axis.y * newState.axis.y +
                    newState.axis.z * newState.axis.z
                );
                expect(Math.abs(magnitude - 1)).toBeLessThan(1e-10);

                // Original components should decrease
                expect(Math.abs(newState.axis.x)).toBeLessThan(Math.abs(initialSpin.axis.x));
                expect(Math.abs(newState.axis.z)).toBeLessThan(Math.abs(initialSpin.axis.z));
            });
        });
    });

    describe('Spin Axis Normalization', () => {
        it('should maintain normalized spin axis under all conditions', () => {
            const testCases = [
                { rate: 3000, axis: { x: 1, y: 0, z: 0 } },
                { rate: 2500, axis: { x: 0.707, y: 0.707, z: 0 } },
                { rate: 2000, axis: { x: 0.577, y: 0.577, z: 0.577 } },
                { rate: 1500, axis: { x: 0, y: 1, z: 0 } },
                { rate: 1000, axis: { x: 0, y: 0, z: 1 } }
            ];

            const velocities = [
                { x: 30, y: 0, z: 0 },
                { x: 45, y: 15, z: 0 },
                { x: 60, y: -10, z: 5 }
            ];

            const timeSteps = [0.1, 0.5, 1.0, 2.0];

            testCases.forEach(initialSpin => {
                velocities.forEach(velocity => {
                    timeSteps.forEach(time => {
                        const newState = spinEngine.updateSpinState(
                            initialSpin,
                            standardBall,
                            standardEnv,
                            velocity,
                            time
                        );

                        // Verify axis normalization
                        const magnitude = Math.sqrt(
                            newState.axis.x * newState.axis.x +
                            newState.axis.y * newState.axis.y +
                            newState.axis.z * newState.axis.z
                        );
                        expect(Math.abs(magnitude - 1)).toBeLessThan(1e-10);
                    });
                });
            });
        });
    });

    describe('Extreme Spin Conditions', () => {
        it('should handle very high spin rates', () => {
            const highSpinState: SpinState = {
                rate: 8000,  // Very high spin rate
                axis: { x: 0, y: 1, z: 0 }
            };

            const velocity = { x: 44.7, y: 0, z: 0 };
            const time = 1.0;

            const newState = spinEngine.updateSpinState(
                highSpinState,
                standardBall,
                standardEnv,
                velocity,
                time
            );

            // Verify spin decay is reasonable
            expect(newState.rate).toBeLessThan(highSpinState.rate);
            expect(newState.rate).toBeGreaterThan(highSpinState.rate * 0.5);  // Not too much decay
        });

        it('should handle very low spin rates', () => {
            const lowSpinState: SpinState = {
                rate: 100,  // Very low spin rate
                axis: { x: 0, y: 1, z: 0 }
            };

            const velocity = { x: 44.7, y: 0, z: 0 };
            const time = 1.0;

            const newState = spinEngine.updateSpinState(
                lowSpinState,
                standardBall,
                standardEnv,
                velocity,
                time
            );

            // Verify spin behavior at low rates
            expect(newState.rate).toBeLessThan(lowSpinState.rate);
            expect(newState.rate).toBeGreaterThan(0);  // Should not go negative
        });

        it('should handle rapid axis changes', () => {
            const initialSpin: SpinState = {
                rate: 3000,
                axis: { x: 1, y: 0, z: 0 }
            };

            const velocity = { x: 44.7, y: 0, z: 0 };
            const dt = 0.01;
            let currentState = { ...initialSpin };

            // Simulate rapid axis changes
            for (let i = 0; i < 100; i++) {
                const angle = (i * Math.PI) / 50;  // Rotate axis
                currentState.axis = {
                    x: Math.cos(angle),
                    y: Math.sin(angle),
                    z: 0
                };

                const newState = spinEngine.updateSpinState(
                    currentState,
                    standardBall,
                    standardEnv,
                    velocity,
                    dt
                );

                // Verify axis remains normalized
                const magnitude = Math.sqrt(
                    newState.axis.x * newState.axis.x +
                    newState.axis.y * newState.axis.y +
                    newState.axis.z * newState.axis.z
                );
                expect(Math.abs(magnitude - 1)).toBeLessThan(1e-10);

                currentState = newState;
            }
        });
    });

    describe('Environmental Effects on Spin', () => {
        it('should validate temperature effects on spin decay', () => {
            const initialSpin: SpinState = {
                rate: 3000,
                axis: { x: 0, y: 1, z: 0 }
            };

            const velocity = { x: 44.7, y: 0, z: 0 };
            const time = 1.0;
            const temperatures = [-10, 0, 20, 40];  // °C
            let previousDecay = 0;

            temperatures.forEach(temp => {
                const envAtTemp: Environment = {
                    ...standardEnv,
                    temperature: temp
                };

                const newState = spinEngine.updateSpinState(
                    initialSpin,
                    standardBall,
                    envAtTemp,
                    velocity,
                    time
                );

                const decay = initialSpin.rate - newState.rate;
                if (previousDecay > 0) {
                    // Higher temperatures should lead to more decay
                    expect(decay).toBeGreaterThan(previousDecay);
                }
                previousDecay = decay;
            });
        });

        it('should validate humidity effects on spin decay', () => {
            const initialSpin: SpinState = {
                rate: 3000,
                axis: { x: 0, y: 1, z: 0 }
            };

            const velocity = { x: 44.7, y: 0, z: 0 };
            const time = 1.0;
            const humidities = [0, 0.3, 0.6, 0.9];  // 0% to 90%
            let previousDecay = 0;

            humidities.forEach(humidity => {
                const envWithHumidity: Environment = {
                    ...standardEnv,
                    humidity
                };

                const newState = spinEngine.updateSpinState(
                    initialSpin,
                    standardBall,
                    envWithHumidity,
                    velocity,
                    time
                );

                const decay = initialSpin.rate - newState.rate;
                if (previousDecay > 0) {
                    // Higher humidity should lead to slightly less decay
                    expect(decay).toBeLessThan(previousDecay);
                }
                previousDecay = decay;
            });
        });
    });
});
