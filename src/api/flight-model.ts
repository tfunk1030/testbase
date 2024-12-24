import { 
    BallProperties, 
    Environment, 
    LaunchConditions, 
    TrajectoryResult, 
    BallState,
    Vector3D,
    ValidationMetrics,
    Forces
} from '../types';
import { AerodynamicsEngine } from '../core/aerodynamics';
import { ValidationSystem } from '../core/validation-system';

export class FlightModel {
    private aerodynamicsEngine: AerodynamicsEngine;
    private validationSystem: ValidationSystem;

    constructor(aerodynamicsEngine: AerodynamicsEngine) {
        this.aerodynamicsEngine = aerodynamicsEngine;
        this.validationSystem = new ValidationSystem();
    }

    public validateInput(
        properties: BallProperties,
        environment: Environment,
        initialState: BallState
    ): boolean {
        return this.validationSystem.validateInput(properties, environment, initialState);
    }

    public calculateTrajectory(
        properties: BallProperties,
        environment: Environment,
        initialState: BallState,
        dt: number = 0.001
    ): TrajectoryResult {
        if (!this.validateInput(properties, environment, initialState)) {
            throw new Error('Invalid input parameters');
        }

        // Initialize trajectory calculation
        const trajectory: TrajectoryResult = {
            points: [],
            finalState: initialState,
            metrics: {
                carryDistance: 0,
                totalDistance: 0,
                maxHeight: 0,
                timeOfFlight: 0,
                spinRate: initialState.spin.rate,
                launchAngle: Math.atan2(initialState.velocity.y, initialState.velocity.x) * 180 / Math.PI,
                launchDirection: Math.atan2(initialState.velocity.z, initialState.velocity.x) * 180 / Math.PI,
                ballSpeed: Math.sqrt(
                    initialState.velocity.x * initialState.velocity.x +
                    initialState.velocity.y * initialState.velocity.y +
                    initialState.velocity.z * initialState.velocity.z
                )
            }
        };

        let currentState = { ...initialState };
        let time = 0;

        while (currentState.position.y >= 0 && time < 30) { // Max 30 seconds flight time
            const forces = this.aerodynamicsEngine.calculateForces(
                currentState.velocity,
                currentState.spin,
                properties,
                environment
            );

            // Update position and velocity using simple Euler integration
            const newState = this.integrateState(currentState, forces, dt);
            
            trajectory.points.push({
                time,
                position: newState.position,
                velocity: newState.velocity,
                spin: newState.spin,
                forces
            });

            currentState = newState;
            time += dt;

            // Update metrics
            trajectory.metrics.maxHeight = Math.max(trajectory.metrics.maxHeight, currentState.position.y);
        }

        trajectory.finalState = currentState;
        trajectory.metrics.timeOfFlight = time;
        trajectory.metrics.carryDistance = Math.sqrt(
            currentState.position.x * currentState.position.x +
            currentState.position.z * currentState.position.z
        );
        trajectory.metrics.totalDistance = trajectory.metrics.carryDistance;

        return trajectory;
    }

    private integrateState(
        state: BallState,
        forces: Forces,
        dt: number
    ): BallState {
        const acceleration = {
            x: (forces.drag.x + forces.lift.x + forces.magnus.x + forces.gravity.x) / state.mass,
            y: (forces.drag.y + forces.lift.y + forces.magnus.y + forces.gravity.y) / state.mass,
            z: (forces.drag.z + forces.lift.z + forces.magnus.z + forces.gravity.z) / state.mass
        };

        return {
            position: {
                x: state.position.x + state.velocity.x * dt,
                y: state.position.y + state.velocity.y * dt,
                z: state.position.z + state.velocity.z * dt
            },
            velocity: {
                x: state.velocity.x + acceleration.x * dt,
                y: state.velocity.y + acceleration.y * dt,
                z: state.velocity.z + acceleration.z * dt
            },
            spin: {
                axis: state.spin.axis,
                rate: state.spin.rate // Add spin decay if needed
            },
            mass: state.mass
        };
    }
}
