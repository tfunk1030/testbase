import { SpinDecayValidator } from '../core/spin-decay-validation';
import { SpinState, BallProperties, Environment, Vector3D } from '../core/types';

describe('SpinDecayValidator', () => {
    const validator = new SpinDecayValidator();
    const standardBall: BallProperties = {
        mass: 0.0459,          // kg
        radius: 0.0214,        // m
        area: Math.PI * 0.0214 * 0.0214,  // m^2
        dragCoefficient: 0.23,
        liftCoefficient: 0.15,
        magnusCoefficient: 0.12,
        spinDecayRate: 100     // rpm/s
    };
    const standardEnvironment: Environment = {
        temperature: 20,       // °C
        pressure: 101325,      // Pa
        humidity: 0.5,         // 50%
        altitude: 0,           // m
        wind: { x: 0, y: 0, z: 0 }  // m/s
    };

    test('should validate initial spin rate decay', () => {
        const initialSpin: SpinState = {
            axis: { x: 0, y: 0, z: 1 },
            rate: 3000  // rpm
        };
        const velocity: Vector3D = { x: 0, y: 0, z: 45 };  // m/s

        const result = validator.validateInitialSpinDecay(
            initialSpin,
            velocity,
            standardBall,
            standardEnvironment
        );

        expect(result.isValid).toBe(true);
        expect(result.finalSpinRate).toBeLessThan(initialSpin.rate);
        expect(result.spinDecayRate).toBeGreaterThan(0);
    });

    test('should show increased decay at higher speeds', () => {
        const initialSpin: SpinState = {
            axis: { x: 0, y: 0, z: 1 },
            rate: 3000  // rpm
        };
        let previousDecay = 0;

        [30, 40, 50, 60].forEach(speed => {
            const result = validator.validateInitialSpinDecay(
                initialSpin,
                { x: 0, y: 0, z: speed },
                standardBall,
                standardEnvironment
            );
            const decay = result.spinDecayRate;
            if (previousDecay > 0) {
                expect(decay).toBeGreaterThan(previousDecay);
            }
            previousDecay = decay;
        });
    });

    test('should show reduced decay at higher altitude', () => {
        const initialSpin: SpinState = {
            axis: { x: 0, y: 0, z: 1 },
            rate: 3000  // rpm
        };
        const velocity: Vector3D = { x: 0, y: 0, z: 45 };  // m/s

        const seaLevelResult = validator.validateInitialSpinDecay(
            initialSpin,
            velocity,
            standardBall,
            { ...standardEnvironment, altitude: 0 }
        );

        const highAltitudeResult = validator.validateInitialSpinDecay(
            initialSpin,
            velocity,
            standardBall,
            { ...standardEnvironment, altitude: 2000 }
        );

        expect(highAltitudeResult.spinDecayRate).toBeLessThan(seaLevelResult.spinDecayRate);
    });

    test('should validate spin decay over trajectory', () => {
        const initialSpin: SpinState = {
            axis: { x: 0, y: 0, z: 1 },
            rate: 3000  // rpm
        };
        const timePoints = [0, 0.1, 0.2, 0.3];  // seconds
        const velocities = timePoints.map(t => ({
            x: 0,
            y: 0,
            z: 45 - t * 10  // decreasing speed
        }));

        const result = validator.validateTrajectorySpinDecay(
            initialSpin,
            standardBall,
            standardEnvironment,
            timePoints,
            velocities
        );

        expect(result.isValid).toBe(true);
        expect(result.spinRates.length).toBe(4);
        expect(result.spinRates[3]).toBeLessThan(result.spinRates[0]);
    });
});
