import {
    BallState,
    Environment,
    BallProperties,
    LaunchConditions,
    ValidationResult,
    DataSet,
    TrajectoryResult,
    Vector3D
} from '../core/types';
import { ValidationSystem } from '../core/validation-system';
import { FlightIntegrator } from '../core/flight-integrator';

export class FlightModel {
    private readonly validator: ValidationSystem;
    private readonly flightIntegrator: FlightIntegrator;

    // Ball property ranges
    private readonly MIN_MASS = 0.0456;  // kg (1.6 oz)
    private readonly MAX_MASS = 0.0512;  // kg (1.8 oz)
    private readonly MIN_RADIUS = 0.0213; // m (1.68 inches)
    private readonly MAX_RADIUS = 0.0214; // m (1.69 inches)
    private readonly MIN_CD = 0.15;
    private readonly MAX_CD = 0.28;
    private readonly MIN_CL = 0.15;
    private readonly MAX_CL = 0.25;
    private readonly MIN_SPIN_DECAY = 5;  // rpm/s
    private readonly MAX_SPIN_DECAY = 15; // rpm/s

    // Environment ranges
    private readonly MIN_TEMP = -10;   // Celsius
    private readonly MAX_TEMP = 40;    // Celsius
    private readonly MIN_PRESSURE = 950;  // hPa
    private readonly MAX_PRESSURE = 1050; // hPa
    private readonly MIN_HUMIDITY = 0;    // percentage
    private readonly MAX_HUMIDITY = 100;  // percentage
    private readonly MIN_ALTITUDE = 0;    // meters
    private readonly MAX_ALTITUDE = 3000; // meters
    private readonly MAX_WIND = 20;       // m/s

    constructor() {
        this.validator = new ValidationSystem();
        this.flightIntegrator = new FlightIntegrator();
    }

    /**
     * Simulate a golf shot with given conditions
     */
    public async simulateFlight(
        initialState: BallState,
        environment: Environment,
        ballProperties: BallProperties
    ): Promise<TrajectoryResult> {
        // Validate inputs
        this.validateBallProperties(ballProperties);
        this.validateEnvironment(environment);
        this.validateInitialState(initialState);

        // Simulate flight
        return this.flightIntegrator.simulateFlight(
            initialState,
            environment,
            ballProperties
        );
    }

    /**
     * Simulate a golf shot with given launch conditions
     */
    public async simulateShot(
        launchConditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties
    ): Promise<TrajectoryResult> {
        const initialState = this.convertToInitialState(launchConditions);
        return this.simulateFlight(initialState, environment, ballProperties);
    }

    /**
     * Simulate a golf shot with given initial state
     */
    public async simulateTrajectory(
        initialState: BallState,
        environment: Environment,
        ballProperties: BallProperties
    ): Promise<TrajectoryResult> {
        return this.simulateFlight(initialState, environment, ballProperties);
    }

    /**
     * Generate random ball properties
     */
    public generateRandomBallProperties(): BallProperties {
        return {
            mass: this.randomInRange(this.MIN_MASS, this.MAX_MASS),
            radius: this.randomInRange(this.MIN_RADIUS, this.MAX_RADIUS),
            dragCoefficient: this.randomInRange(this.MIN_CD, this.MAX_CD),
            liftCoefficient: this.randomInRange(this.MIN_CL, this.MAX_CL),
            spinDecayRate: this.randomInRange(this.MIN_SPIN_DECAY, this.MAX_SPIN_DECAY)
        };
    }

    /**
     * Generate random environment conditions
     */
    public generateRandomEnvironment(): Environment {
        const windSpeed = Math.random() * this.MAX_WIND;
        const windDirection = Math.random() * 2 * Math.PI;

        return {
            temperature: this.randomInRange(this.MIN_TEMP, this.MAX_TEMP),
            pressure: this.randomInRange(this.MIN_PRESSURE, this.MAX_PRESSURE),
            humidity: this.randomInRange(this.MIN_HUMIDITY, this.MAX_HUMIDITY),
            altitude: this.randomInRange(this.MIN_ALTITUDE, this.MAX_ALTITUDE),
            wind: {
                x: windSpeed * Math.cos(windDirection),
                y: 0,  // Assuming horizontal wind only
                z: windSpeed * Math.sin(windDirection)
            }
        };
    }

    /**
     * Generate random launch conditions
     */
    public generateRandomConditions(): LaunchConditions {
        return {
            ballSpeed: this.randomInRange(30, 80),  // m/s
            launchAngle: this.randomInRange(0, 30),  // degrees
            launchDirection: this.randomInRange(-10, 10),  // degrees
            spinRate: this.randomInRange(2000, 4000),  // rpm
            spinAxis: this.generateRandomUnitVector()
        };
    }

    /**
     * Convert launch conditions to initial velocity vector
     */
    private convertToInitialState(launchConditions: LaunchConditions): BallState {
        const speed = launchConditions.ballSpeed;
        const launchAngleRad = launchConditions.launchAngle * Math.PI / 180;
        const directionRad = launchConditions.launchDirection * Math.PI / 180;

        return {
            position: { x: 0, y: 0, z: 0 },
            velocity: {
                x: speed * Math.cos(launchAngleRad) * Math.cos(directionRad),
                y: speed * Math.sin(launchAngleRad),
                z: speed * Math.cos(launchAngleRad) * Math.sin(directionRad)
            },
            spin: {
                rate: launchConditions.spinRate,
                axis: launchConditions.spinAxis
            },
            mass: 0.0475 // default mass
        };
    }

    /**
     * Generate a random unit vector
     */
    private generateRandomUnitVector(): Vector3D {
        const phi = Math.random() * 2 * Math.PI;
        const cosTheta = Math.random() * 2 - 1;
        const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);

        return {
            x: sinTheta * Math.cos(phi),
            y: sinTheta * Math.sin(phi),
            z: cosTheta
        };
    }

    /**
     * Generate a random number in a range
     */
    private randomInRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    /**
     * Validate a dataset against TrackMan data
     */
    public async validateDataset(dataset: DataSet): Promise<ValidationResult[]> {
        const results: ValidationResult[] = [];

        for (let i = 0; i < dataset.inputs.length; i++) {
            const input = dataset.inputs[i];
            const output = dataset.outputs[i];

            const trajectory = await this.simulateShot(
                input.launchConditions,
                input.environment,
                input.ballProperties
            );

            const validationCase = {
                initialState: {
                    position: { x: 0, y: 0, z: 0 },
                    velocity: this.convertToInitialState(input.launchConditions).velocity,
                    spin: {
                        rate: input.launchConditions.spinRate,
                        axis: input.launchConditions.spinAxis
                    },
                    mass: input.ballProperties.mass
                },
                environment: input.environment,
                ballProperties: input.ballProperties,
                expectedMetrics: output.metrics,
                trajectory
            };

            const result = await this.validator.validateTrajectory(validationCase);
            results.push(result);
        }

        return results;
    }

    /**
     * Generate a random dataset for testing
     */
    public async generateRandomDataset(size: number): Promise<DataSet> {
        const inputs: DataSet['inputs'] = [];
        const outputs: DataSet['outputs'] = [];

        for (let i = 0; i < size; i++) {
            const launchConditions = this.generateRandomConditions();
            const environment = this.generateRandomEnvironment();
            const ballProperties = this.generateRandomBallProperties();

            const trajectory = await this.simulateShot(
                launchConditions,
                environment,
                ballProperties
            );

            inputs.push({
                launchConditions,
                environment,
                ballProperties
            });

            outputs.push({
                metrics: trajectory.metrics,
                trajectory
            });
        }

        return { inputs, outputs };
    }
}
