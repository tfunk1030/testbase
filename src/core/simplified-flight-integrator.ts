import { BallState, Environment, BallProperties, TrajectoryPoint, TrajectoryResult, Vector3D, Forces } from '../types';

/**
 * A simplified flight integrator for ball trajectory calculations.
 * Uses basic Euler integration and simplified physics for better performance.
 * Includes basic environmental effects and spin influences.
 */
export class SimplifiedFlightIntegrator {
    private readonly groundLevel = 0; // Ground level in meters
    private readonly g = 9.81; // Gravity acceleration in m/s^2

    /**
     * Simulates the flight of a ball given initial conditions and environmental factors.
     * Uses simplified Euler integration for performance.
     * 
     * @param initialState Initial ball state (position, velocity, spin)
     * @param environment Environmental conditions (temperature, pressure, wind)
     * @param properties Physical properties of the ball
     * @returns Trajectory result including points and metrics
     * @throws Error if invalid input parameters
     */
    async simulateFlight(
        initialState: BallState,
        environment: Environment,
        properties: BallProperties
    ): Promise<TrajectoryResult> {
        // Validate inputs
        if (!initialState || !environment || !properties) {
            throw new Error('Missing required parameters');
        }
        if (properties.mass <= 0 || properties.radius <= 0) {
            throw new Error('Invalid ball properties');
        }
        if (environment.pressure <= 0 || environment.temperature < -273.15) {
            throw new Error('Invalid environmental conditions');
        }

        const points: TrajectoryPoint[] = [];
        const dt = 0.001; // 1ms timestep
        const maxTime = 10; // 10s max simulation time
        
        let currentState = { ...initialState };
        let currentTime = 0;
        let maxHeight = currentState.position.y;

        // Store initial point
        points.push(this.createTrajectoryPoint(currentState, this.calculateForces(currentState, environment, properties), currentTime));

        while (currentTime < maxTime && currentState.position.y >= this.groundLevel) {
            // Calculate forces
            const forces = this.calculateForces(currentState, environment, properties);
            
            // Calculate acceleration
            const acceleration = this.calculateAcceleration(forces, properties);
            
            // Update velocity (Euler integration)
            currentState.velocity = {
                x: currentState.velocity.x + acceleration.x * dt,
                y: currentState.velocity.y + acceleration.y * dt,
                z: currentState.velocity.z + acceleration.z * dt
            };
            
            // Update position
            currentState.position = {
                x: currentState.position.x + currentState.velocity.x * dt,
                y: currentState.position.y + currentState.velocity.y * dt,
                z: currentState.position.z + currentState.velocity.z * dt
            };
            
            // Simple spin decay
            currentState.spin.rate *= (1 - properties.spinDecayRate * dt);
            
            // Record point
            points.push(this.createTrajectoryPoint(currentState, forces, currentTime));
            
            // Update max height
            maxHeight = Math.max(maxHeight, currentState.position.y);
            
            currentTime += dt;
        }

        // Calculate metrics
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        const dx = lastPoint.position.x - firstPoint.position.x;
        const dz = lastPoint.position.z - firstPoint.position.z;
        const carryDistance = Math.sqrt(dx * dx + dz * dz);

        const ballSpeed = Math.sqrt(
            Math.pow(firstPoint.velocity.x, 2) +
            Math.pow(firstPoint.velocity.y, 2) +
            Math.pow(firstPoint.velocity.z, 2)
        );

        const launchDirection = Math.atan2(firstPoint.velocity.z, firstPoint.velocity.x) * 180 / Math.PI;

        return {
            points,
            metrics: {
                carryDistance: carryDistance,
                totalDistance: carryDistance,
                maxHeight: maxHeight,
                timeOfFlight: currentTime,
                spinRate: firstPoint.spin.rate,
                launchAngle: Math.atan2(firstPoint.velocity.y,
                    Math.sqrt(Math.pow(firstPoint.velocity.x, 2) + Math.pow(firstPoint.velocity.z, 2))
                ) * 180 / Math.PI,
                launchDirection,
                ballSpeed
            },
            finalState: points[points.length - 1]
        };
    }

    /**
     * Calculates aerodynamic forces acting on the ball.
     * Includes drag, lift, magnus effect and gravity.
     * Uses simplified models suitable for real-time calculation.
     */
    private calculateForces(state: BallState, environment: Environment, properties: BallProperties): Forces {
        // Simplified force calculations
        const velocity = state.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
        
        // Calculate relative velocity (accounting for wind)
        const relativeVelocity = {
            x: velocity.x - environment.wind.x,
            y: velocity.y - environment.wind.y,
            z: velocity.z - environment.wind.z
        };
        const relativeSpeed = Math.sqrt(
            relativeVelocity.x * relativeVelocity.x + 
            relativeVelocity.y * relativeVelocity.y + 
            relativeVelocity.z * relativeVelocity.z
        );

        // Calculate air density from environmental conditions
        const airDensity = (environment.pressure * 100) / (287.05 * (environment.temperature + 273.15));
        
        // Calculate drag force
        const dragMagnitude = 0.5 * airDensity * relativeSpeed * relativeSpeed * properties.area * properties.dragCoefficient;
        const drag = {
            x: -dragMagnitude * relativeVelocity.x / relativeSpeed,
            y: -dragMagnitude * relativeVelocity.y / relativeSpeed,
            z: -dragMagnitude * relativeVelocity.z / relativeSpeed
        };

        // Calculate lift force (simplified)
        const liftMagnitude = 0.5 * airDensity * relativeSpeed * relativeSpeed * properties.area * properties.liftCoefficient;
        const lift = {
            x: 0,
            y: liftMagnitude,
            z: 0
        };

        // Calculate magnus force (spin effect)
        const magnusMagnitude = state.spin.rate * properties.magnusCoefficient * airDensity * relativeSpeed * properties.radius;
        const magnus = {
            x: 0,
            y: magnusMagnitude,
            z: 0
        };

        return {
            drag,
            lift,
            magnus,
            gravity: { x: 0, y: -this.g, z: 0 }
        };
    }

    /**
     * Calculates acceleration from forces using F = ma.
     * Includes gravitational acceleration.
     */
    private calculateAcceleration(forces: Forces, properties: BallProperties): Vector3D {
        return {
            x: (forces.drag.x + forces.lift.x + forces.magnus.x) / properties.mass,
            y: (forces.drag.y + forces.lift.y + forces.magnus.y) / properties.mass - this.g,
            z: (forces.drag.z + forces.lift.z + forces.magnus.z) / properties.mass
        };
    }

    /**
     * Creates a trajectory point from current state.
     * Deep copies vectors to prevent mutation.
     */
    private createTrajectoryPoint(state: BallState, forces: Forces, time: number): TrajectoryPoint {
        return {
            position: { ...state.position },
            velocity: { ...state.velocity },
            spin: { ...state.spin },
            mass: state.mass,
            forces,
            time
        };
    }
}
