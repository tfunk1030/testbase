import { LaunchConditions, Environment, BallProperties, TrajectoryResult } from './types';
import { FlightIntegrator } from './flight-integrator';
import { AerodynamicsEngine } from './aerodynamics';
import { AerodynamicsEngineImpl } from './aerodynamics-engine';
import { CacheManager } from './cache-manager';

interface OptimizationResult {
    trajectory: TrajectoryResult;
    metric: number;
    conditions: LaunchConditions;
}

export class OptimizationAlgorithms {
    private readonly integrator: FlightIntegrator;
    private readonly cache: CacheManager;
    private readonly aero: AerodynamicsEngine;

    constructor() {
        this.integrator = new FlightIntegrator();
        this.cache = CacheManager.getInstance();
        this.aero = new AerodynamicsEngineImpl();
    }

    /**
     * Particle Swarm Optimization (PSO)
     */
    public async particleSwarmOptimization(
        baseConditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties,
        metricFn: (t: TrajectoryResult) => number,
        numParticles: number = 20,
        iterations: number = 50
    ): Promise<OptimizationResult> {
        const particles = this.initializeParticles(baseConditions, numParticles);
        const velocities = new Array(numParticles).fill(null).map(() => ({
            angle: (Math.random() - 0.5) * 2,
            spin: (Math.random() - 0.5) * 500
        }));

        let globalBest: OptimizationResult | null = null;
        const personalBests: OptimizationResult[] = new Array(numParticles).fill(null);

        for (let iter = 0; iter < iterations; iter++) {
            await Promise.all(particles.map(async (particle, i) => {
                const trajectory = await this.evaluateConditions(
                    particle,
                    environment,
                    properties
                );

                const metric = metricFn(trajectory);
                const result: OptimizationResult = {
                    trajectory,
                    metric,
                    conditions: { ...particle }
                };

                if (!personalBests[i] || metric > personalBests[i].metric) {
                    personalBests[i] = result;
                }

                if (!globalBest || metric > globalBest.metric) {
                    globalBest = result;
                }
            }));

            // Update particle velocities and positions
            particles.forEach((particle, i) => {
                const w = 0.7; // Inertia weight
                const c1 = 1.5; // Cognitive parameter
                const c2 = 1.5; // Social parameter

                const r1 = Math.random();
                const r2 = Math.random();

                velocities[i].angle = w * velocities[i].angle +
                    c1 * r1 * (personalBests[i].conditions.launchAngle - particle.launchAngle) +
                    c2 * r2 * (globalBest!.conditions.launchAngle - particle.launchAngle);

                velocities[i].spin = w * velocities[i].spin +
                    c1 * r1 * (personalBests[i].conditions.spinRate - particle.spinRate) +
                    c2 * r2 * (globalBest!.conditions.spinRate - particle.spinRate);

                // Update positions with bounds checking
                particle.launchAngle = this.clamp(
                    particle.launchAngle + velocities[i].angle,
                    0,
                    45
                );

                particle.spinRate = this.clamp(
                    particle.spinRate + velocities[i].spin,
                    1000,
                    5000
                );
            });
        }

        return globalBest!;
    }

    /**
     * Simulated Annealing
     */
    public async simulatedAnnealing(
        baseConditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties,
        metricFn: (t: TrajectoryResult) => number,
        initialTemp: number = 100,
        coolingRate: number = 0.95,
        iterations: number = 100
    ): Promise<OptimizationResult> {
        let current = { ...baseConditions };
        let currentTrajectory = await this.evaluateConditions(
            current,
            environment,
            properties
        );
        let currentMetric = metricFn(currentTrajectory);

        let best: OptimizationResult = {
            trajectory: currentTrajectory,
            metric: currentMetric,
            conditions: { ...current }
        };

        let temp = initialTemp;

        for (let i = 0; i < iterations && temp > 0.1; i++) {
            const neighbor = this.getNeighbor(current);
            const neighborTrajectory = await this.evaluateConditions(
                neighbor,
                environment,
                properties
            );
            const neighborMetric = metricFn(neighborTrajectory);

            const delta = neighborMetric - currentMetric;

            if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
                current = neighbor;
                currentTrajectory = neighborTrajectory;
                currentMetric = neighborMetric;

                if (currentMetric > best.metric) {
                    best = {
                        trajectory: currentTrajectory,
                        metric: currentMetric,
                        conditions: { ...current }
                    };
                }
            }

            temp *= coolingRate;
        }

        return best;
    }

    /**
     * Differential Evolution
     */
    public async differentialEvolution(
        baseConditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties,
        metricFn: (t: TrajectoryResult) => number,
        populationSize: number = 20,
        generations: number = 50,
        F: number = 0.8,
        CR: number = 0.9
    ): Promise<OptimizationResult> {
        let population = this.initializePopulation(baseConditions, populationSize);
        let fitness = await Promise.all(
            population.map(async p => {
                const trajectory = await this.evaluateConditions(p, environment, properties);
                return metricFn(trajectory);
            })
        );

        let bestIndex = fitness.indexOf(Math.max(...fitness));
        let best: OptimizationResult = {
            trajectory: await this.evaluateConditions(
                population[bestIndex],
                environment,
                properties
            ),
            metric: fitness[bestIndex],
            conditions: { ...population[bestIndex] }
        };

        for (let gen = 0; gen < generations; gen++) {
            await Promise.all(population.map(async (individual, i) => {
                // Select three random individuals
                const [a, b, c] = this.selectRandomIndividuals(population, i);

                // Create trial vector
                const trial = this.createTrialVector(a, b, c, individual, F, CR);

                // Evaluate trial vector
                const trialTrajectory = await this.evaluateConditions(
                    trial,
                    environment,
                    properties
                );
                const trialFitness = metricFn(trialTrajectory);

                // Selection
                if (trialFitness > fitness[i]) {
                    population[i] = trial;
                    fitness[i] = trialFitness;

                    if (trialFitness > best.metric) {
                        best = {
                            trajectory: trialTrajectory,
                            metric: trialFitness,
                            conditions: { ...trial }
                        };
                    }
                }
            }));
        }

        return best;
    }

    private async evaluateConditions(
        conditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): Promise<TrajectoryResult> {
        const cacheKey = this.cache.generateKey(null, environment, properties, conditions);
        const cached = this.cache.get(cacheKey, 'optimization');

        if (cached) return cached;

        const trajectory = await this.integrator.simulateFlight(
            this.convertToInitialState(conditions, properties),
            environment,
            properties,
            this.aero
        );

        this.cache.set(cacheKey, trajectory);
        return trajectory;
    }

    private initializeParticles(base: LaunchConditions, count: number): LaunchConditions[] {
        return new Array(count).fill(null).map(() => ({
            ...base,
            launchAngle: this.clamp(base.launchAngle + (Math.random() - 0.5) * 20, 0, 45),
            spinRate: this.clamp(base.spinRate + (Math.random() - 0.5) * 1000, 1000, 5000)
        }));
    }

    private initializePopulation(base: LaunchConditions, size: number): LaunchConditions[] {
        return new Array(size).fill(null).map(() => ({
            ...base,
            launchAngle: this.clamp(base.launchAngle + (Math.random() - 0.5) * 20, 0, 45),
            spinRate: this.clamp(base.spinRate + (Math.random() - 0.5) * 1000, 1000, 5000)
        }));
    }

    private getNeighbor(current: LaunchConditions): LaunchConditions {
        return {
            ...current,
            launchAngle: this.clamp(
                current.launchAngle + (Math.random() - 0.5) * 5,
                0,
                45
            ),
            spinRate: this.clamp(
                current.spinRate + (Math.random() - 0.5) * 500,
                1000,
                5000
            )
        };
    }

    private selectRandomIndividuals(
        population: LaunchConditions[],
        exclude: number
    ): [LaunchConditions, LaunchConditions, LaunchConditions] {
        const available = population
            .map((_, i) => i)
            .filter(i => i !== exclude);

        const indices = new Set<number>();
        while (indices.size < 3) {
            indices.add(available[Math.floor(Math.random() * available.length)]);
        }

        const [a, b, c] = Array.from(indices);
        return [population[a], population[b], population[c]];
    }

    private createTrialVector(
        a: LaunchConditions,
        b: LaunchConditions,
        c: LaunchConditions,
        target: LaunchConditions,
        F: number,
        CR: number
    ): LaunchConditions {
        const trial = { ...target };

        if (Math.random() < CR) {
            trial.launchAngle = this.clamp(
                a.launchAngle + F * (b.launchAngle - c.launchAngle),
                0,
                45
            );
        }

        if (Math.random() < CR) {
            trial.spinRate = this.clamp(
                a.spinRate + F * (b.spinRate - c.spinRate),
                1000,
                5000
            );
        }

        return trial;
    }

    private convertToInitialState(
        conditions: LaunchConditions,
        properties: BallProperties
    ): any {
        const speed = conditions.ballSpeed;
        const angle = conditions.launchAngle * Math.PI / 180;
        const direction = conditions.launchDirection * Math.PI / 180;

        return {
            position: { x: 0, y: 0, z: 0 },
            velocity: {
                x: speed * Math.cos(angle) * Math.cos(direction),
                y: speed * Math.sin(angle),
                z: speed * Math.cos(angle) * Math.sin(direction)
            },
            spin: {
                rate: conditions.spinRate,
                axis: conditions.spinAxis
            }
        };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
