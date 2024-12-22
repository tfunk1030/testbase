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

describe('Flight Model', () => {
    let launchPhysics: LaunchPhysics;
    let flightIntegrator: FlightIntegrator;
    let validator: ValidationSystem;
    let dataGenerator: DataGenerator;
    let optimizer: PerformanceOptimizer;

    const standardEnvironment: Environment = {
        temperature: 20,
        windSpeed: 0,
        windDirection: 0,
        altitude: 0,
        humidity: 50,
        pressure: 1013.25
    };

    const standardBall: BallProperties = {
        mass: 0.0459,          // kg (approximately 45.9 grams)
        diameter: 0.0428,      // m (approximately 1.68 inches)
        dimpleCount: 392,
        dimplePattern: 'icosahedral',
        dimpleShape: 'circular',
        edgeProfile: 'rounded',
        surfaceTexture: 'smooth',
        construction: '3-piece',
        dimpleCoverage: 0.78,  // 78% coverage
        dimpleDepth: 0.00125,  // m
        compression: 90        // compression rating
    };

    const standardLaunch: LaunchConditions = {
        ballSpeed: 71.5264, // 160 mph converted to m/s
        launchAngle: 12,
        launchDirection: 0,
        totalSpin: 2500,
        spinAxis: 0
    };

    beforeEach(() => {
        launchPhysics = new LaunchPhysics();
        flightIntegrator = new FlightIntegrator();
        validator = new ValidationSystem();
        dataGenerator = new DataGenerator();
        optimizer = new PerformanceOptimizer();
    });

    describe('Launch Physics', () => {
        test('should calculate initial velocity correctly', () => {
            const launch = launchPhysics.processLaunch(standardLaunch, standardEnvironment, standardBall);
            const speed = Math.sqrt(
                launch.velocity.vx * launch.velocity.vx +
                launch.velocity.vy * launch.velocity.vy +
                launch.velocity.vz * launch.velocity.vz
            );

            expect(speed).toBeCloseTo(standardLaunch.ballSpeed, 2); 

            const angle = Math.atan2(
                launch.velocity.vy,
                launch.velocity.vx
            ) * 180 / Math.PI;

            expect(angle).toBeCloseTo(standardLaunch.launchAngle, 2);
        });

        test('should handle temperature effects', () => {
            const hotEnvironment = { ...standardEnvironment, temperature: 35 };
            const coldEnvironment = { ...standardEnvironment, temperature: 5 };

            const hotLaunch = launchPhysics.processLaunch(standardLaunch, hotEnvironment, standardBall);
            const coldLaunch = launchPhysics.processLaunch(standardLaunch, coldEnvironment, standardBall);

            // Hot air is less dense, so ball should travel further
            const hotSpeed = Math.sqrt(
                hotLaunch.velocity.vx * hotLaunch.velocity.vx +
                hotLaunch.velocity.vy * hotLaunch.velocity.vy +
                hotLaunch.velocity.vz * hotLaunch.velocity.vz
            );

            const coldSpeed = Math.sqrt(
                coldLaunch.velocity.vx * coldLaunch.velocity.vx +
                coldLaunch.velocity.vy * coldLaunch.velocity.vy +
                coldLaunch.velocity.vz * coldLaunch.velocity.vz
            );

            expect(hotSpeed).toBeGreaterThan(coldSpeed);
        });

        test('should handle wind effects', () => {
            const headwindEnv = { ...standardEnvironment, windSpeed: 10, windDirection: 0 };
            const tailwindEnv = { ...standardEnvironment, windSpeed: 10, windDirection: 180 };

            const headwindLaunch = launchPhysics.processLaunch(standardLaunch, headwindEnv, standardBall);
            const tailwindLaunch = launchPhysics.processLaunch(standardLaunch, tailwindEnv, standardBall);

            // Headwind should reduce effective speed more than tailwind
            expect(Math.abs(headwindLaunch.velocity.vx)).toBeLessThan(Math.abs(tailwindLaunch.velocity.vx));
        });
    });

    describe('Flight Integration', () => {
        test('should simulate basic trajectory', () => {
            const launch = launchPhysics.processLaunch(standardLaunch, standardEnvironment, standardBall);
            const trajectory = flightIntegrator.simulateFlight(
                launch.initialState,
                standardEnvironment,
                standardBall
            );

            expect(trajectory.points.length).toBeGreaterThan(0);
            trajectory.points.forEach((point, index) => {
                if (index > 0) {
                    const prevPoint = trajectory.points[index - 1];
                    const dt = point.time - prevPoint.time;
                    expect(dt).toBeGreaterThan(0);
                }
            });
        });

        test('should handle ground interaction', () => {
            const launch = launchPhysics.processLaunch(standardLaunch, standardEnvironment, standardBall);
            const trajectory = flightIntegrator.simulateFlight(
                launch.initialState,
                standardEnvironment,
                standardBall
            );

            trajectory.points.forEach(point => {
                // Ball should never go below ground
                expect(point.y).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('Validation System', () => {
        test('should validate launch conditions', () => {
            const testCases = dataGenerator.generateValidationSet();
            const results = validator.validateModel([{
                conditions: standardLaunch,
                environment: standardEnvironment,
                ballProperties: standardBall
            }]);

            results.forEach(result => {
                expect(result.isValid).toBe(true);
                expect(result.errors.length).toBe(0);
                expect(result.metrics.carryDistance).toBeGreaterThan(0);
                expect(result.metrics.maxHeight).toBeGreaterThan(0);
                expect(result.metrics.flightTime).toBeGreaterThan(0);
                expect(result.metrics.carryDistance).toBeLessThan(400); // Maximum reasonable carry distance
                expect(result.metrics.maxHeight).toBeLessThan(100); // Maximum reasonable height
                expect(result.metrics.flightTime).toBeLessThan(15); // Maximum reasonable flight time
            });
        });
    });

    describe('Performance Optimizer', () => {
        test('should optimize for distance', () => {
            const trajectory1 = optimizer.optimizeTrajectory(
                standardLaunch,
                standardEnvironment,
                standardBall,
                'distance'
            );

            const trajectory2 = optimizer.optimizeTrajectory(
                standardLaunch,
                standardEnvironment,
                standardBall,
                'height'
            );

            expect(trajectory1.carryDistance).toBeGreaterThan(0);
            expect(trajectory2.maxHeight).toBeGreaterThan(0);
        });

        test('should handle batch processing', () => {
            const conditions = Array(5).fill(null).map(() => ({
                ...standardLaunch,
                launchAngle: standardLaunch.launchAngle + Math.random() * 10 - 5
            }));

            const trajectories = optimizer.batchProcess(
                conditions,
                standardEnvironment,
                standardBall,
                'distance'
            );

            expect(trajectories.length).toBe(conditions.length);
            trajectories.forEach(trajectory => {
                expect(trajectory.carryDistance).toBeGreaterThan(0);
            });
        });
    });

    describe('Data Generation', () => {
        test('should generate club-specific datasets', () => {
            const dataset = dataGenerator.generateClubDataset('DRIVER', 100);

            expect(dataset.conditions.length).toBe(100);
            dataset.conditions.forEach(condition => {
                expect(condition.ballSpeed).toBeGreaterThanOrEqual(150);
                expect(condition.ballSpeed).toBeLessThanOrEqual(175);
                expect(condition.launchAngle).toBeGreaterThanOrEqual(8);
                expect(condition.launchAngle).toBeLessThanOrEqual(15);
            });
        });

        test('should generate consistent validation sets', () => {
            const dataset1 = dataGenerator.generateValidationSet();
            const dataset2 = dataGenerator.generateValidationSet();

            expect(dataset1.conditions.length).toBeGreaterThan(0);
            expect(dataset1.conditions.length).toBe(dataset2.conditions.length);
        });
    });
});
