import { BallState, Environment, BallProperties, TrajectoryPoint, TrajectoryResult, ValidationCase, ValidationResult, ValidationMetrics, Vector3D, Forces } from './types';
import { AerodynamicsEngine } from './aerodynamics';

export interface IFlightIntegrator {
    simulateFlight(
        initialState: BallState,
        environment: Environment,
        properties: BallProperties,
        aerodynamicsEngine: AerodynamicsEngine
    ): Promise<TrajectoryResult>;
}

export class FlightIntegrator implements IFlightIntegrator {
    private readonly minDt = 0.0001; // Minimum time step in seconds
    private readonly maxDt = 0.001; // Maximum time step in seconds
    private readonly maxTime = 60; // Maximum simulation time in seconds
    private readonly groundLevel = 0; // Ground level in meters
    private readonly minPositionChange = 0.1; // Minimum position change to store point
    private readonly errorTolerance = 1e-6; // Error tolerance for adaptive stepping

    // Cached vectors to reduce object creation
    private readonly cachedVec1: Vector3D = { x: 0, y: 0, z: 0 };
    private readonly cachedVec2: Vector3D = { x: 0, y: 0, z: 0 };
    private readonly cachedVec3: Vector3D = { x: 0, y: 0, z: 0 };
    private readonly cachedVec4: Vector3D = { x: 0, y: 0, z: 0 };

    // Cache objects for RK4 integration
    private readonly k1State: BallState = {
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        spin: { rate: 0, axis: { x: 0, y: 0, z: 0 } },
        mass: 0
    };
    private readonly k2State: BallState = {
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        spin: { rate: 0, axis: { x: 0, y: 0, z: 0 } },
        mass: 0
    };
    private readonly k3State: BallState = {
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        spin: { rate: 0, axis: { x: 0, y: 0, z: 0 } },
        mass: 0
    };
    private readonly k4State: BallState = {
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        spin: { rate: 0, axis: { x: 0, y: 0, z: 0 } },
        mass: 0
    };

    async simulateFlight(
        initialState: BallState,
        environment: Environment,
        properties: BallProperties,
        aerodynamicsEngine: AerodynamicsEngine
    ): Promise<TrajectoryResult> {
        const points: TrajectoryPoint[] = [];
        this.copyState(this.k1State, initialState);
        let t = 0;
        let dt = this.maxDt;

        // Store initial point
        const initialForces = aerodynamicsEngine.calculateForces(
            this.k1State.velocity,
            this.k1State.spin,
            properties,
            environment
        );

        points.push(this.createTrajectoryPoint(this.k1State, initialForces, t));

        let maxHeight = this.k1State.position.y;
        let finalTime = t;
        let finalPosition = { ...this.k1State.position };
        let finalVelocity = { ...this.k1State.velocity };

        while (t < this.maxTime) {
            // Update spin rate with decay
            this.k1State.spin.rate *= Math.exp(-properties.spinDecayRate * dt);

            // Perform RK4 integration step with error estimation
            const k1 = this.calculateDerivatives(this.k1State, environment, properties, aerodynamicsEngine);
            
            this.copyState(this.k2State, this.k1State);
            this.advanceState(this.k2State, k1, dt / 2);
            
            const k2 = this.calculateDerivatives(this.k2State, environment, properties, aerodynamicsEngine);
            
            this.copyState(this.k3State, this.k1State);
            this.advanceState(this.k3State, k2, dt);
            
            const k3 = this.calculateDerivatives(this.k3State, environment, properties, aerodynamicsEngine);

            this.copyState(this.k4State, this.k1State);
            this.advanceState(this.k4State, k3, dt);
            
            const k4 = this.calculateDerivatives(this.k4State, environment, properties, aerodynamicsEngine);

            // Calculate weighted average of derivatives and error estimate
            const dState = this.calculateWeightedDerivatives(k1, k2, k3, k4);
            const error = this.estimateError(k1, k2, k3, k4);

            // Adjust time step based on error
            if (error > this.errorTolerance) {
                dt = Math.max(dt * 0.5, this.minDt);
                continue;
            } else if (error < this.errorTolerance * 0.1) {
                dt = Math.min(dt * 2, this.maxDt);
            }

            // Update state
            this.advanceState(this.k1State, dState, dt);

            // Check if ball has hit the ground
            if (this.k1State.position.y <= this.groundLevel) {
                const impactTime = this.findGroundImpactTime(
                    this.k1State,
                    environment,
                    properties,
                    aerodynamicsEngine,
                    t,
                    t + dt
                );

                const impactState = this.integrateToTime(
                    this.k1State,
                    environment,
                    properties,
                    aerodynamicsEngine,
                    t,
                    impactTime
                );

                finalPosition = { ...impactState.position, y: this.groundLevel };
                finalVelocity = impactState.velocity;
                finalTime = impactTime;

                const finalForces = aerodynamicsEngine.calculateForces(
                    finalVelocity,
                    impactState.spin,
                    properties,
                    environment
                );

                points.push(this.createTrajectoryPoint(
                    { ...impactState, position: finalPosition },
                    finalForces,
                    finalTime
                ));

                break;
            }

            // Update max height
            maxHeight = Math.max(maxHeight, this.k1State.position.y);

            // Store point if significant change
            if (this.shouldStorePoint(points, this.k1State)) {
                const forces = aerodynamicsEngine.calculateForces(
                    this.k1State.velocity,
                    this.k1State.spin,
                    properties,
                    environment
                );

                points.push(this.createTrajectoryPoint(this.k1State, forces, t + dt));
            }

            t += dt;
        }

        // Calculate trajectory metrics
        const metrics = this.calculateMetrics(points);

        return {
            points,
            metrics
        };
    }

    private copyVector(target: Vector3D, source: Vector3D): void {
        target.x = source.x;
        target.y = source.y;
        target.z = source.z;
    }

    private copyState(target: BallState, source: BallState): void {
        target.position.x = source.position.x;
        target.position.y = source.position.y;
        target.position.z = source.position.z;
        target.velocity.x = source.velocity.x;
        target.velocity.y = source.velocity.y;
        target.velocity.z = source.velocity.z;
        target.spin.rate = source.spin.rate;
        target.spin.axis.x = source.spin.axis.x;
        target.spin.axis.y = source.spin.axis.y;
        target.spin.axis.z = source.spin.axis.z;
        target.mass = source.mass;
    }

    private createTrajectoryPoint(
        state: BallState,
        forces: Forces,
        time: number
    ): TrajectoryPoint {
        return {
            position: { ...state.position },
            velocity: { ...state.velocity },
            spin: { ...state.spin },
            forces,
            time
        };
    }

    private shouldStorePoint(points: TrajectoryPoint[], state: BallState): boolean {
        if (points.length === 0) return true;
        
        const lastPoint = points[points.length - 1];
        return this.calculateDistance(state.position, lastPoint.position) > this.minPositionChange;
    }

    private estimateError(k1: any, k2: any, k3: any, k4: any): number {
        // Use difference between RK4 and RK5 as error estimate
        const error1 = Math.abs(k1.position.x - k4.position.x);
        const error2 = Math.abs(k1.position.y - k4.position.y);
        const error3 = Math.abs(k1.position.z - k4.position.z);
        return Math.max(error1, error2, error3);
    }

    private calculateWeightedDerivatives(k1: any, k2: any, k3: any, k4: any): any {
        return {
            position: {
                x: (k1.position.x + 2 * k2.position.x + 2 * k3.position.x + k4.position.x) / 6,
                y: (k1.position.y + 2 * k2.position.y + 2 * k3.position.y + k4.position.y) / 6,
                z: (k1.position.z + 2 * k2.position.z + 2 * k3.position.z + k4.position.z) / 6
            },
            velocity: {
                x: (k1.velocity.x + 2 * k2.velocity.x + 2 * k3.velocity.x + k4.velocity.x) / 6,
                y: (k1.velocity.y + 2 * k2.velocity.y + 2 * k3.velocity.y + k4.velocity.y) / 6,
                z: (k1.velocity.z + 2 * k2.velocity.z + 2 * k3.velocity.z + k4.velocity.z) / 6
            }
        };
    }

    private calculateDerivatives(
        state: BallState,
        environment: Environment,
        properties: BallProperties,
        aerodynamicsEngine: AerodynamicsEngine
    ): { position: Vector3D; velocity: Vector3D } {
        const forces = aerodynamicsEngine.calculateForces(
            state.velocity,
            state.spin,
            properties,
            environment
        );

        // Calculate acceleration from forces
        const acceleration = {
            x: forces.x / properties.mass,
            y: forces.y / properties.mass,
            z: forces.z / properties.mass
        };

        return {
            position: { ...state.velocity },
            velocity: acceleration
        };
    }

    private advanceState(
        state: BallState,
        derivatives: { position: Vector3D; velocity: Vector3D },
        dt: number
    ): BallState {
        return {
            position: {
                x: state.position.x + derivatives.position.x * dt,
                y: state.position.y + derivatives.position.y * dt,
                z: state.position.z + derivatives.position.z * dt
            },
            velocity: {
                x: state.velocity.x + derivatives.velocity.x * dt,
                y: state.velocity.y + derivatives.velocity.y * dt,
                z: state.velocity.z + derivatives.velocity.z * dt
            },
            spin: { ...state.spin },
            mass: state.mass
        };
    }

    private findGroundImpactTime(
        state: BallState,
        environment: Environment,
        properties: BallProperties,
        aerodynamicsEngine: AerodynamicsEngine,
        t0: number,
        t1: number,
        tolerance: number = 1e-6
    ): number {
        const maxIterations = 20;
        let a = t0;
        let b = t1;

        for (let i = 0; i < maxIterations; i++) {
            const mid = (a + b) / 2;
            const midState = this.integrateToTime(
                state,
                environment,
                properties,
                aerodynamicsEngine,
                t0,
                mid
            );

            if (Math.abs(midState.position.y) < tolerance) {
                return mid;
            }

            if (midState.position.y > 0) {
                a = mid;
            } else {
                b = mid;
            }
        }

        return (a + b) / 2;
    }

    private integrateToTime(
        initialState: BallState,
        environment: Environment,
        properties: BallProperties,
        aerodynamicsEngine: AerodynamicsEngine,
        t0: number,
        t1: number
    ): BallState {
        let state = { ...initialState };
        let t = t0;
        const dt = this.maxDt;

        while (t < t1) {
            const stepSize = Math.min(dt, t1 - t);
            const k1 = this.calculateDerivatives(state, environment, properties, aerodynamicsEngine);
            const k2 = this.calculateDerivatives(
                this.advanceState(state, k1, stepSize / 2),
                environment,
                properties,
                aerodynamicsEngine
            );
            const k3 = this.calculateDerivatives(
                this.advanceState(state, k2, stepSize / 2),
                environment,
                properties,
                aerodynamicsEngine
            );
            const k4 = this.calculateDerivatives(
                this.advanceState(state, k3, stepSize),
                environment,
                properties,
                aerodynamicsEngine
            );

            const dState = {
                position: {
                    x: (k1.position.x + 2 * k2.position.x + 2 * k3.position.x + k4.position.x) / 6,
                    y: (k1.position.y + 2 * k2.position.y + 2 * k3.position.y + k4.position.y) / 6,
                    z: (k1.position.z + 2 * k2.position.z + 2 * k3.position.z + k4.position.z) / 6
                },
                velocity: {
                    x: (k1.velocity.x + 2 * k2.velocity.x + 2 * k3.velocity.x + k4.velocity.x) / 6,
                    y: (k1.velocity.y + 2 * k2.velocity.y + 2 * k3.velocity.y + k4.velocity.y) / 6,
                    z: (k1.velocity.z + 2 * k2.velocity.z + 2 * k3.velocity.z + k4.velocity.z) / 6
                }
            };

            state = this.advanceState(state, dState, stepSize);
            state.spin.rate *= Math.exp(-properties.spinDecayRate * stepSize);
            t += stepSize;
        }

        return state;
    }

    private calculateDistance(a: Vector3D, b: Vector3D): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private calculateMetrics(points: TrajectoryPoint[]): ValidationMetrics {
        if (points.length < 2) {
            return {
                carryDistance: 0,
                maxHeight: 0,
                flightTime: 0,
                launchAngle: 0,
                landingAngle: 0,
                spinRate: points[0]?.spin.rate || 0
            };
        }

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        // Calculate carry distance (horizontal distance)
        const dx = lastPoint.position.x - firstPoint.position.x;
        const dz = lastPoint.position.z - firstPoint.position.z;
        const carryDistance = Math.sqrt(dx * dx + dz * dz);

        // Find max height
        let maxHeight = 0;
        for (const point of points) {
            maxHeight = Math.max(maxHeight, point.position.y);
        }

        // Calculate flight time
        const flightTime = lastPoint.time - firstPoint.time;

        // Calculate launch angle
        const firstVelocity = this.calculateVelocity(firstPoint, points[1]);
        const launchAngle = Math.atan2(firstVelocity.y, Math.sqrt(firstVelocity.x * firstVelocity.x + firstVelocity.z * firstVelocity.z)) * 180 / Math.PI;

        // Calculate landing angle
        const lastVelocity = this.calculateVelocity(points[points.length - 2], lastPoint);
        const landingAngle = Math.atan2(lastVelocity.y, Math.sqrt(lastVelocity.x * lastVelocity.x + lastVelocity.z * lastVelocity.z)) * 180 / Math.PI;

        // Convert distances to meters (they are already in meters)
        return {
            carryDistance: carryDistance * 1000,    // Convert to meters
            maxHeight: maxHeight * 1000,            // Convert to meters
            flightTime,                             // Already in seconds
            launchAngle,                            // Already in degrees
            landingAngle,                           // Already in degrees
            spinRate: firstPoint.spin.rate          // Already in rpm
        };
    }

    private calculateVelocity(p1: TrajectoryPoint, p2: TrajectoryPoint): Vector3D {
        const speed = Math.sqrt(
            (p2.position.x - p1.position.x) * (p2.position.x - p1.position.x) +
            (p2.position.y - p1.position.y) * (p2.position.y - p1.position.y) +
            (p2.position.z - p1.position.z) * (p2.position.z - p1.position.z)
        );

        if (speed < 1e-10) {
            return { x: 0, y: 0, z: 0 };
        }

        return {
            x: (p2.position.x - p1.position.x) / (p2.time - p1.time),
            y: (p2.position.y - p1.position.y) / (p2.time - p1.time),
            z: (p2.position.z - p1.position.z) / (p2.time - p1.time)
        };
    }

    public async validateTrajectory(validationCase: ValidationCase): Promise<ValidationResult> {
        const trajectory = await this.simulateFlight(
            validationCase.initialState,
            validationCase.environment,
            validationCase.properties,
            validationCase.aerodynamicsEngine
        );

        if (!validationCase.expectedMetrics) {
            return {
                isValid: true,
                errors: [],
                trajectory
            };
        }

        const errors: string[] = [];
        const tolerance = 0.1;  // 10% tolerance

        // Compare metrics
        const expected = validationCase.expectedMetrics;
        const actual = trajectory.metrics;

        if (!actual) {
            return {
                isValid: false,
                errors: ['Failed to calculate trajectory metrics'],
                trajectory
            };
        }

        // Check each metric with tolerance
        if (Math.abs(actual.carryDistance - expected.carryDistance) / expected.carryDistance > tolerance) {
            errors.push(`Carry distance error: ${actual.carryDistance} vs ${expected.carryDistance}`);
        }

        if (Math.abs(actual.maxHeight - expected.maxHeight) / expected.maxHeight > tolerance) {
            errors.push(`Max height error: ${actual.maxHeight} vs ${expected.maxHeight}`);
        }

        if (Math.abs(actual.flightTime - expected.flightTime) / expected.flightTime > tolerance) {
            errors.push(`Flight time error: ${actual.flightTime} vs ${expected.flightTime}`);
        }

        if (Math.abs(actual.launchAngle - expected.launchAngle) / expected.launchAngle > tolerance) {
            errors.push(`Launch angle error: ${actual.launchAngle} vs ${expected.launchAngle}`);
        }

        if (Math.abs(actual.landingAngle - expected.landingAngle) / expected.landingAngle > tolerance) {
            errors.push(`Landing angle error: ${actual.landingAngle} vs ${expected.landingAngle}`);
        }

        if (Math.abs(actual.spinRate - expected.spinRate) / expected.spinRate > tolerance) {
            errors.push(`Spin rate error: ${actual.spinRate} vs ${expected.spinRate}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            trajectory
        };
    }

    public async validateBatch(cases: ValidationCase[]): Promise<ValidationResult[]> {
        return Promise.all(cases.map(testCase => this.validateTrajectory(testCase)));
    }
}
