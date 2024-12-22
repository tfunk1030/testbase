import { FlightIntegrator } from '../core/flight-integrator';
import { LaunchPhysics } from '../core/launch-physics';
import { ValidationSystem } from '../core/validation-system';
import { DataGenerator } from '../core/data-generator';
import { PerformanceOptimizer } from '../core/performance-optimizer';
import { 
    LaunchConditions,
    Environment,
    BallProperties,
    Trajectory 
} from '../core/types';

describe('Golf Ball Flight Model Tests', () => {
    // Test instances
    let flightIntegrator: FlightIntegrator;
    let launchPhysics: LaunchPhysics;
    let validator: ValidationSystem;
    let dataGenerator: DataGenerator;
    let optimizer: PerformanceOptimizer;

    // Standard test conditions
    const standardLaunch: LaunchConditions = {
        ballSpeed: 160,
        launchAngle: 10.5,
        launchDirection: 0,
        totalSpin: 2800,
        spinAxis: 0
    };

    const standardEnvironment: Environment = {
        temperature: 70,
        windSpeed: 0,
        windDirection: 0,
        altitude: 0,
        humidity: 50,
        pressure: 29.92
    };

    const standardBall: BallProperties = {
        compression: 90,
        diameter: 1.68,
        mass: 45.93,
        dimpleCount: 352,
        dimpleDepth: 0.01
    };

    beforeEach(() => {
        flightIntegrator = new FlightIntegrator();
        launchPhysics = new LaunchPhysics();
        validator = new ValidationSystem();
        dataGenerator = new DataGenerator();
        optimizer = new PerformanceOptimizer();
    });

    describe('Launch Physics Tests', () => {
        test('should calculate correct initial velocity components', () => {
            const launch = launchPhysics.processLaunch(
                standardLaunch,
                standardEnvironment,
                standardBall
            );

            // Check velocity magnitude
            const speed = Math.sqrt(
                launch.initialVelocity.x * launch.initialVelocity.x +
                launch.initialVelocity.y * launch.initialVelocity.y +
                launch.initialVelocity.z * launch.initialVelocity.z
            );
            expect(speed).toBeCloseTo(standardLaunch.ballSpeed, 1);

            // Check launch angle
            const angle = Math.atan2(
                launch.initialVelocity.y,
                launch.initialVelocity.x
            ) * 180 / Math.PI;
            expect(angle).toBeCloseTo(standardLaunch.launchAngle, 1);
        });

        test('should apply correct temperature effects', () => {
            const hotEnvironment = { ...standardEnvironment, temperature: 90 };
            const coldEnvironment = { ...standardEnvironment, temperature: 50 };

            const hotLaunch = launchPhysics.processLaunch(
                standardLaunch,
                hotEnvironment,
                standardBall
            );
            const coldLaunch = launchPhysics.processLaunch(
                standardLaunch,
                coldEnvironment,
                standardBall
            );

            // Pro standard: 2 yards per 10 degrees
            const expectedDiff = ((90 - 50) / 10) * 2;
            const actualDiff = hotLaunch.adjustedSpeed - coldLaunch.adjustedSpeed;
            expect(actualDiff).toBeCloseTo(expectedDiff, 1);
        });

        test('should apply correct wind effects', () => {
            const headwindEnv = { ...standardEnvironment, windSpeed: 10, windDirection: 0 };
            const tailwindEnv = { ...standardEnvironment, windSpeed: 10, windDirection: 180 };

            const headwindLaunch = launchPhysics.processLaunch(
                standardLaunch,
                headwindEnv,
                standardBall
            );
            const tailwindLaunch = launchPhysics.processLaunch(
                standardLaunch,
                tailwindEnv,
                standardBall
            );

            // Headwind should reduce speed more than tailwind increases it
            expect(Math.abs(headwindLaunch.environmentalEffects.windEffect.headwind))
                .toBeGreaterThan(Math.abs(tailwindLaunch.environmentalEffects.windEffect.headwind));
        });
    });

    describe('Flight Integration Tests', () => {
        test('should produce realistic trajectory shape', () => {
            const trajectory = flightIntegrator.simulateFlight(
                standardLaunch,
                standardEnvironment,
                standardBall
            );

            // Check trajectory points increase then decrease in height
            let maxHeight = 0;
            let maxHeightIndex = 0;
            
            trajectory.points.forEach((point, index) => {
                if (point.position.y > maxHeight) {
                    maxHeight = point.position.y;
                    maxHeightIndex = index;
                }
            });

            // Max height should occur in middle third of flight
            expect(maxHeightIndex).toBeGreaterThan(trajectory.points.length * 0.3);
            expect(maxHeightIndex).toBeLessThan(trajectory.points.length * 0.7);
        });

        test('should conserve energy within reasonable bounds', () => {
            const trajectory = flightIntegrator.simulateFlight(
                standardLaunch,
                standardEnvironment,
                standardBall
            );

            // Calculate initial energy
            const initialEnergy = 0.5 * standardBall.mass * Math.pow(standardLaunch.ballSpeed, 2);

            // Check energy at each point
            trajectory.points.forEach(point => {
                const velocity = Math.sqrt(
                    point.velocity.x * point.velocity.x +
                    point.velocity.y * point.velocity.y +
                    point.velocity.z * point.velocity.z
                );
                const kineticEnergy = 0.5 * standardBall.mass * Math.pow(velocity, 2);
                const potentialEnergy = standardBall.mass * 9.81 * point.position.y;
                const totalEnergy = kineticEnergy + potentialEnergy;

                // Energy should always be less than initial (due to drag)
                expect(totalEnergy).toBeLessThanOrEqual(initialEnergy * 1.01); // 1% tolerance
            });
        });
    });

    describe('Validation Tests', () => {
        test('should validate against professional standards', () => {
            const testCases = dataGenerator.generateValidationSet();
            const results = validator.validateModel(testCases.samples);

            results.forEach(result => {
                expect(result.temperatureValid).toBe(true);
                expect(result.windValid).toBe(true);
                expect(result.altitudeValid).toBe(true);
                expect(result.trajectoryValid).toBe(true);
                expect(result.landingValid).toBe(true);
            });
        });
    });

    describe('Performance Tests', () => {
        test('should cache and retrieve trajectories', () => {
            const trajectory1 = optimizer.optimizeTrajectory(
                standardLaunch,
                standardEnvironment,
                standardBall
            );
            const trajectory2 = optimizer.optimizeTrajectory(
                standardLaunch,
                standardEnvironment,
                standardBall
            );

            // Second call should be cached
            expect(trajectory1).toEqual(trajectory2);
        });

        test('should handle batch processing efficiently', () => {
            const conditions = Array(10).fill(standardLaunch);
            const startTime = process.hrtime();
            
            const trajectories = optimizer.batchProcess(
                conditions,
                standardEnvironment,
                standardBall
            );

            const [seconds, nanoseconds] = process.hrtime(startTime);
            const totalTime = seconds * 1000 + nanoseconds / 1e6;

            // Should process 10 trajectories in under 100ms
            expect(totalTime).toBeLessThan(100);
            expect(trajectories.length).toBe(10);
        });
    });

    describe('Data Generation Tests', () => {
        test('should generate realistic driver data', () => {
            const dataset = dataGenerator.generateClubDataset('DRIVER', 100);

            dataset.samples.forEach(sample => {
                // Check carry distance is realistic for driver
                expect(sample.output.carryDistance).toBeGreaterThan(200);
                expect(sample.output.carryDistance).toBeLessThan(350);

                // Check max height is realistic
                expect(sample.output.maxHeight).toBeGreaterThan(20);
                expect(sample.output.maxHeight).toBeLessThan(150);

                // Check flight time is realistic
                expect(sample.output.flightTime).toBeGreaterThan(4);
                expect(sample.output.flightTime).toBeLessThan(7);
            });
        });

        test('should generate consistent validation data', () => {
            const dataset1 = dataGenerator.generateValidationSet();
            const dataset2 = dataGenerator.generateValidationSet();

            // Same test cases should produce same results
            expect(dataset1.samples).toEqual(dataset2.samples);
        });
    });
});
