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
});
