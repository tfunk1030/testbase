import {
    LaunchConditions,
    Environment,
    BallProperties,
    Trajectory,
    ValidationResult,
    DataSet
} from '../core/types';
import { ValidationSystem } from '../core/validation-system';
import { FlightIntegrator } from '../core/flight-integrator';
import { DataGenerator } from '../core/data-generator';

/**
 * Simplified Flight Model API
 * 
 * A streamlined physics-based model for simulating golf ball trajectories
 * with professional-grade accuracy.
 * 
 * Features:
 * - Full 3D trajectory simulation
 * - Basic environmental effects
 * - Data generation for training
 * 
 * @version 1.0.0
 * @license MIT
 */
export class FlightModel {
    private readonly validator: ValidationSystem;
    private readonly integrator: FlightIntegrator;
    private readonly dataGenerator: DataGenerator;

    constructor() {
        this.validator = new ValidationSystem();
        this.integrator = new FlightIntegrator();
        this.dataGenerator = new DataGenerator();
    }

    /**
     * Simulate a single golf shot
     * 
     * @param conditions - Initial launch conditions
     * @param environment - Environmental conditions
     * @param ballProperties - Ball specifications
     * @returns Complete trajectory with all data points
     * 
     * @example
     * ```typescript
     * const model = new FlightModel();
     * const trajectory = model.simulateShot({
     *     ballSpeed: 160,
     *     launchAngle: 10.5,
     *     launchDirection: 0,
     *     totalSpin: 2800,
     *     spinAxis: 0
     * }, {
     *     temperature: 70,
     *     windSpeed: 0,
     *     windDirection: 0,
     *     altitude: 0,
     *     humidity: 50,
     *     pressure: 29.92
     * }, {
     *     compression: 90,
     *     diameter: 1.68,
     *     mass: 45.93,
     *     dimpleCount: 352,
     *     dimpleDepth: 0.01
     * });
     * ```
     */
    public simulateShot(
        conditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties
    ): Trajectory {
        // Initialize ball state
        const initialState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: {
                x: conditions.ballSpeed * Math.cos(conditions.launchAngle * Math.PI / 180),
                y: conditions.ballSpeed * Math.sin(conditions.launchAngle * Math.PI / 180),
                z: 0
            },
            spin: {
                x: conditions.totalSpin * Math.cos(conditions.spinAxis * Math.PI / 180),
                y: 0,
                z: conditions.totalSpin * Math.sin(conditions.spinAxis * Math.PI / 180)
            },
            mass: ballProperties.mass
        };

        // Simulate flight
        return this.integrator.integrate(
            initialState,
            environment,
            ballProperties,
            { dragModifier: 1.0, liftModifier: 1.0 }
        );
    }

    /**
     * Validate a simulated trajectory
     * 
     * @param conditions - Initial launch conditions
     * @param environment - Environmental conditions
     * @param ballProperties - Ball specifications
     * @param trajectory - Simulated trajectory
     * @returns Validation result
     */
    public validateTrajectory(
        conditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties,
        trajectory: Trajectory
    ): ValidationResult {
        return this.validator.validate(
            conditions,
            environment,
            ballProperties,
            trajectory
        );
    }

    /**
     * Generate random launch conditions
     * 
     * @returns Random launch conditions
     */
    public generateRandomConditions(): LaunchConditions {
        return this.dataGenerator.generateLaunchConditions();
    }

    /**
     * Generate random environment
     * 
     * @returns Random environment
     */
    public generateRandomEnvironment(): Environment {
        return this.dataGenerator.generateEnvironment();
    }

    /**
     * Generate random ball properties
     * 
     * @returns Random ball properties
     */
    public generateRandomBallProperties(): BallProperties {
        return this.dataGenerator.generateBallProperties();
    }

    /**
     * Generate random dataset
     * 
     * @param numSamples - Number of trajectories to generate (default: 100)
     * @returns Array of trajectories
     * 
     * @example
     * ```typescript
     * const model = new FlightModel();
     * const trajectories = model.generateRandomDataset(1000);
     * ```
     */
    public generateRandomDataset(numSamples: number = 100): Trajectory[] {
        const dataset: DataSet = this.dataGenerator.generateDataSet(numSamples);
        const trajectories: Trajectory[] = [];

        for (const conditions of dataset.conditions) {
            const trajectory = this.simulateShot(
                conditions,
                dataset.environment,
                dataset.ballProperties
            );
            trajectories.push(trajectory);
        }

        return trajectories;
    }
}
