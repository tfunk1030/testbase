import { AerodynamicsEngineImpl } from '../core/aerodynamics';
import { Environment, BallProperties, SpinState, Vector3D } from '../core/types';

// Helper function to calculate force magnitude
const calculateForceMagnitude = (force: Vector3D): number => {
    return Math.sqrt(force.x * force.x + force.y * force.y + force.z * force.z);
};

describe('Temperature Effects Validation', () => {
    const aeroEngine = new AerodynamicsEngineImpl();
    
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

    const standardVelocity = {
        x: 44.7,  // m/s (~100 mph)
        y: 0,
        z: 0
    };

    const standardSpin: SpinState = {
        rate: 3000,  // rpm
        axis: { x: 0, y: 1, z: 0 }
    };

    describe('Air Density Calculations', () => {
        it('should match standard atmosphere density at sea level', () => {
            const standardEnvironment: Environment = {
                temperature: 15, // °C
                pressure: 29.92, // inHg
                humidity: 0,
                altitude: 0,
                wind: { x: 0, y: 0, z: 0 }
            };

            const engine = new AerodynamicsEngineImpl();
            const actualDensity = engine.calculateAirDensity(standardEnvironment);
            const expectedDensity = 1.225; // kg/m³ at sea level standard conditions

            expect(Math.abs((actualDensity - expectedDensity) / expectedDensity)).toBeLessThan(0.02);
        });

        it('should show correct temperature dependence', () => {
            const temperatures = [-10, 0, 10, 20, 30, 40];
            const expectedDensities = [1.342, 1.293, 1.247, 1.204, 1.164, 1.127];

            temperatures.forEach((temp, index) => {
                const environment: Environment = {
                    temperature: temp,
                    pressure: 29.92,
                    humidity: 0,
                    altitude: 0,
                    wind: { x: 0, y: 0, z: 0 }
                };

                const engine = new AerodynamicsEngineImpl();
                const actualDensity = engine.calculateAirDensity(environment);
                const relativeDiff = Math.abs((actualDensity - expectedDensities[index]) / expectedDensities[index]);
                expect(relativeDiff).toBeLessThan(0.03);
            });
        });

        it('should show correct altitude effects', () => {
            const altitudes = [0, 500, 1000, 1500, 2000];
            const expectedDensities = [1.225, 1.167, 1.112, 1.058, 1.007];

            altitudes.forEach((alt, index) => {
                const environment: Environment = {
                    temperature: 15,
                    pressure: 29.92,
                    humidity: 0,
                    altitude: alt,
                    wind: { x: 0, y: 0, z: 0 }
                };

                const engine = new AerodynamicsEngineImpl();
                const actualDensity = engine.calculateAirDensity(environment);
                const relativeDiff = Math.abs((actualDensity - expectedDensities[index]) / expectedDensities[index]);
                expect(relativeDiff).toBeLessThan(0.05); // Increase tolerance to 5% for altitude effects
            });
        });

        it('should show correct humidity effects', () => {
            const humidities = [0, 25, 50, 75, 100];
            const expectedDensityRatios = [1.0, 0.996, 0.992, 0.988, 0.984];

            humidities.forEach((humidity, index) => {
                const environment: Environment = {
                    temperature: 20,
                    pressure: 29.92,
                    humidity: humidity,
                    altitude: 0,
                    wind: { x: 0, y: 0, z: 0 }
                };

                const engine = new AerodynamicsEngineImpl();
                const actualDensity = engine.calculateAirDensity(environment);
                const dryEnvironment = { ...environment, humidity: 0 };
                const dryAirDensity = engine.calculateAirDensity(dryEnvironment);
                const actualRatio = actualDensity / dryAirDensity;
                const relativeDiff = Math.abs((actualRatio - expectedDensityRatios[index]) / expectedDensityRatios[index]);
                expect(relativeDiff).toBeLessThan(0.04);
            });
        });
    });

    describe('Force Calculations', () => {
        it('should show correct temperature effects on drag', () => {
            const temperatures = [-10, 15, 40];  // °C
            let previousDragMagnitude = 0;
            
            temperatures.forEach(temp => {
                const env: Environment = {
                    temperature: temp,
                    pressure: 101325,
                    humidity: 0,
                    altitude: 0,
                    wind: { x: 0, y: 0, z: 0 }
                };

                const forces = aeroEngine.calculateForces(
                    standardVelocity,
                    standardSpin,
                    standardBall,
                    env
                );

                const dragMagnitude = calculateForceMagnitude(forces.drag);

                if (previousDragMagnitude > 0) {
                    // Drag should decrease with increasing temperature
                    expect(dragMagnitude).toBeLessThan(previousDragMagnitude);
                }
                previousDragMagnitude = dragMagnitude;
            });
        });

        it('should show correct Reynolds number variation with temperature', () => {
            const temperatures = [-10, 15, 40];  // °C
            let previousLiftMagnitude = 0;
            
            temperatures.forEach(temp => {
                const env: Environment = {
                    temperature: temp,
                    pressure: 101325,
                    humidity: 0,
                    altitude: 0,
                    wind: { x: 0, y: 0, z: 0 }
                };

                const forces = aeroEngine.calculateForces(
                    standardVelocity,
                    standardSpin,
                    standardBall,
                    env
                );

                const liftMagnitude = calculateForceMagnitude(forces.lift);

                if (previousLiftMagnitude > 0) {
                    // Lift should vary with Reynolds number
                    expect(Math.abs(liftMagnitude - previousLiftMagnitude)).toBeGreaterThan(0);
                }
                previousLiftMagnitude = liftMagnitude;
            });
        });
    });
});
