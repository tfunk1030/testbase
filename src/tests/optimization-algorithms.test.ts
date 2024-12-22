import { OptimizationAlgorithms } from '../core/optimization-algorithms';
import { LaunchConditions, Environment, BallProperties, TrajectoryResult } from '../types';

describe('Optimization Algorithms', () => {
    const optimizer = new OptimizationAlgorithms();

    const baseConditions: LaunchConditions = {
        ballSpeed: 70,
        launchAngle: 15,
        launchDirection: 0,
        spinRate: 2500,
        spinAxis: { x: 0, y: 1, z: 0 }
    };

    const environment: Environment = {
        temperature: 20,
        pressure: 101325,
        humidity: 0.5,
        altitude: 0,
        wind: { x: 5, y: 0, z: 0 }
    };

    const properties: BallProperties = {
        mass: 0.0459,
        radius: 0.02135,
        area: Math.PI * 0.02135 * 0.02135,
        dragCoefficient: 0.3,
        liftCoefficient: 0.2,
        magnusCoefficient: 0.1,
        spinDecayRate: 0.1
    };

    const metricFn = (trajectory: TrajectoryResult): number => {
        if (!trajectory.points.length) return 0;
        const lastPoint = trajectory.points[trajectory.points.length - 1];
        return Math.sqrt(
            lastPoint.position.x * lastPoint.position.x +
            lastPoint.position.z * lastPoint.position.z
        );
    };

    describe('Particle Swarm Optimization', () => {
        it('should find better solution than base conditions', async () => {
            const result = await optimizer.particleSwarmOptimization(
                baseConditions,
                environment,
                properties,
                metricFn,
                10, // Reduced particles for test
                20  // Reduced iterations for test
            );

            const baseTrajectory = await optimizer['evaluateConditions'](
                baseConditions,
                environment,
                properties
            );
            const baseMetric = metricFn(baseTrajectory);

            expect(result.metric).toBeGreaterThan(baseMetric);
            expect(result.conditions.launchAngle).toBeGreaterThanOrEqual(0);
            expect(result.conditions.launchAngle).toBeLessThanOrEqual(45);
            expect(result.conditions.spinRate).toBeGreaterThanOrEqual(1000);
            expect(result.conditions.spinRate).toBeLessThanOrEqual(5000);
        }, 30000);
    });

    describe('Simulated Annealing', () => {
        it('should find better solution than base conditions', async () => {
            const result = await optimizer.simulatedAnnealing(
                baseConditions,
                environment,
                properties,
                metricFn,
                100,  // Initial temperature
                0.95, // Cooling rate
                50    // Iterations
            );

            const baseTrajectory = await optimizer['evaluateConditions'](
                baseConditions,
                environment,
                properties
            );
            const baseMetric = metricFn(baseTrajectory);

            expect(result.metric).toBeGreaterThan(baseMetric);
            expect(result.conditions.launchAngle).toBeGreaterThanOrEqual(0);
            expect(result.conditions.launchAngle).toBeLessThanOrEqual(45);
            expect(result.conditions.spinRate).toBeGreaterThanOrEqual(1000);
            expect(result.conditions.spinRate).toBeLessThanOrEqual(5000);
        }, 30000);
    });

    describe('Differential Evolution', () => {
        it('should find better solution than base conditions', async () => {
            const result = await optimizer.differentialEvolution(
                baseConditions,
                environment,
                properties,
                metricFn,
                10, // Population size
                20, // Generations
                0.8, // F
                0.9  // CR
            );

            const baseTrajectory = await optimizer['evaluateConditions'](
                baseConditions,
                environment,
                properties
            );
            const baseMetric = metricFn(baseTrajectory);

            expect(result.metric).toBeGreaterThan(baseMetric);
            expect(result.conditions.launchAngle).toBeGreaterThanOrEqual(0);
            expect(result.conditions.launchAngle).toBeLessThanOrEqual(45);
            expect(result.conditions.spinRate).toBeGreaterThanOrEqual(1000);
            expect(result.conditions.spinRate).toBeLessThanOrEqual(5000);
        }, 30000);
    });

    describe('Algorithm Comparison', () => {
        it('should compare performance of all algorithms', async () => {
            const algorithms = [
                {
                    name: 'PSO',
                    run: () => optimizer.particleSwarmOptimization(
                        baseConditions,
                        environment,
                        properties,
                        metricFn,
                        10,
                        20
                    )
                },
                {
                    name: 'SA',
                    run: () => optimizer.simulatedAnnealing(
                        baseConditions,
                        environment,
                        properties,
                        metricFn,
                        100,
                        0.95,
                        50
                    )
                },
                {
                    name: 'DE',
                    run: () => optimizer.differentialEvolution(
                        baseConditions,
                        environment,
                        properties,
                        metricFn,
                        10,
                        20,
                        0.8,
                        0.9
                    )
                }
            ];

            const results = await Promise.all(
                algorithms.map(async (alg) => {
                    const startTime = performance.now();
                    const result = await alg.run();
                    const endTime = performance.now();

                    return {
                        name: alg.name,
                        metric: result.metric,
                        time: endTime - startTime
                    };
                })
            );

            // Log results for comparison
            console.log('\nAlgorithm Performance Comparison:');
            console.log('================================');
            results.forEach(r => {
                console.log(`${r.name}:`);
                console.log(`  Metric: ${r.metric.toFixed(2)}`);
                console.log(`  Time: ${r.time.toFixed(2)}ms`);
            });

            // Verify all algorithms found valid solutions
            results.forEach(r => {
                expect(r.metric).toBeGreaterThan(0);
                expect(r.time).toBeLessThan(30000); // 30 second timeout
            });
        }, 90000);
    });
});
