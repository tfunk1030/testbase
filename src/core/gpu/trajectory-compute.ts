import * as tf from '@tensorflow/tfjs-node-gpu';
import { GPUCompute } from './gpu-compute';
import { KernelManager } from './kernel-manager';
import { MatrixCompute } from './matrix-compute';

interface TrajectoryConfig {
    steps: number;
    dt: number;
    batchSize?: number;
    useAdaptiveStep?: boolean;
    tolerance?: number;
}

interface TrajectoryState {
    position: tf.Tensor2D;
    velocity: tf.Tensor2D;
    acceleration: tf.Tensor2D;
    time: number;
}

export class TrajectoryCompute {
    private static instance: TrajectoryCompute;
    private readonly gpuCompute: GPUCompute;
    private readonly kernelManager: KernelManager;
    private readonly matrixCompute: MatrixCompute;
    private readonly defaultConfig: Required<TrajectoryConfig> = {
        steps: 1000,
        dt: 1/60,
        batchSize: 128,
        useAdaptiveStep: true,
        tolerance: 1e-6
    };

    private constructor() {
        this.gpuCompute = GPUCompute.getInstance();
        this.kernelManager = KernelManager.getInstance();
        this.matrixCompute = MatrixCompute.getInstance();
        this.registerTrajectoryKernels();
    }

    public static getInstance(): TrajectoryCompute {
        if (!TrajectoryCompute.instance) {
            TrajectoryCompute.instance = new TrajectoryCompute();
        }
        return TrajectoryCompute.instance;
    }

    private async registerTrajectoryKernels(): Promise<void> {
        // RK4 step kernel
        await this.kernelManager.registerKernel(
            {
                name: 'rk4Step',
                inputShape: [2, 3],
                outputShape: [2, 3]
            },
            (state: tf.Tensor) => this.rk4Step(state)
        );

        // Acceleration computation kernel
        await this.kernelManager.registerKernel(
            {
                name: 'computeAcceleration',
                inputShape: [2, 3],
                outputShape: [1, 3]
            },
            (state: tf.Tensor) => this.computeAcceleration(state)
        );
    }

    public async computeTrajectories(
        initialStates: TrajectoryState[],
        config: TrajectoryConfig = {}
    ): Promise<TrajectoryState[][]> {
        const opts = { ...this.defaultConfig, ...config };
        const batchSize = Math.min(opts.batchSize, initialStates.length);

        // Process in batches
        const results: TrajectoryState[][] = [];
        for (let i = 0; i < initialStates.length; i += batchSize) {
            const batch = initialStates.slice(i, i + batchSize);
            const batchResults = await this.computeBatch(batch, opts);
            results.push(...batchResults);
        }

        return results;
    }

    private async computeBatch(
        states: TrajectoryState[],
        config: Required<TrajectoryConfig>
    ): Promise<TrajectoryState[][]> {
        return tf.tidy(() => {
            // Convert states to tensors
            const positions = tf.stack(states.map(s => s.position));
            const velocities = tf.stack(states.map(s => s.velocity));
            const accelerations = tf.stack(states.map(s => s.acceleration));

            const trajectories: TrajectoryState[][] = Array(states.length);
            for (let i = 0; i < states.length; i++) {
                trajectories[i] = [states[i]];
            }

            // Compute trajectories
            for (let step = 0; step < config.steps; step++) {
                const newStates = this.stepBatch(
                    positions,
                    velocities,
                    accelerations,
                    config
                );

                // Store results
                for (let i = 0; i < states.length; i++) {
                    trajectories[i].push({
                        position: newStates.position.slice([i, 0], [1, 3]),
                        velocity: newStates.velocity.slice([i, 0], [1, 3]),
                        acceleration: newStates.acceleration.slice([i, 0], [1, 3]),
                        time: states[i].time + config.dt
                    });
                }

                // Update for next step
                positions.assign(newStates.position);
                velocities.assign(newStates.velocity);
                accelerations.assign(newStates.acceleration);
            }

            return trajectories;
        });
    }

    private stepBatch(
        positions: tf.Tensor3D,
        velocities: tf.Tensor3D,
        accelerations: tf.Tensor3D,
        config: Required<TrajectoryConfig>
    ): TrajectoryState {
        return tf.tidy(() => {
            if (config.useAdaptiveStep) {
                return this.adaptiveStep(positions, velocities, accelerations, config);
            }

            return this.fixedStep(positions, velocities, accelerations, config);
        });
    }

    private fixedStep(
        positions: tf.Tensor3D,
        velocities: tf.Tensor3D,
        accelerations: tf.Tensor3D,
        config: Required<TrajectoryConfig>
    ): TrajectoryState {
        const dt = config.dt;
        const gravity = tf.tensor2d([[0, -9.81, 0]]);

        // RK4 integration
        const k1v = accelerations;
        const k1p = velocities;

        const k2v = this.computeAcceleration(
            positions.add(k1p.mul(dt/2)),
            velocities.add(k1v.mul(dt/2))
        );
        const k2p = velocities.add(k1v.mul(dt/2));

        const k3v = this.computeAcceleration(
            positions.add(k2p.mul(dt/2)),
            velocities.add(k2v.mul(dt/2))
        );
        const k3p = velocities.add(k2v.mul(dt/2));

        const k4v = this.computeAcceleration(
            positions.add(k3p.mul(dt)),
            velocities.add(k3v.mul(dt))
        );
        const k4p = velocities.add(k3v.mul(dt));

        // Update positions and velocities
        const newPositions = positions.add(
            k1p.add(k2p.mul(2)).add(k3p.mul(2)).add(k4p).mul(dt/6)
        );
        const newVelocities = velocities.add(
            k1v.add(k2v.mul(2)).add(k3v.mul(2)).add(k4v).mul(dt/6)
        );
        const newAccelerations = this.computeAcceleration(newPositions, newVelocities);

        return {
            position: newPositions,
            velocity: newVelocities,
            acceleration: newAccelerations,
            time: config.dt
        };
    }

    private adaptiveStep(
        positions: tf.Tensor3D,
        velocities: tf.Tensor3D,
        accelerations: tf.Tensor3D,
        config: Required<TrajectoryConfig>
    ): TrajectoryState {
        const dt = config.dt;
        const tolerance = config.tolerance;

        // Compute two steps: one full step and two half steps
        const fullStep = this.fixedStep(positions, velocities, accelerations, { ...config, dt });
        
        const halfStep1 = this.fixedStep(positions, velocities, accelerations, { ...config, dt: dt/2 });
        const halfStep2 = this.fixedStep(
            halfStep1.position,
            halfStep1.velocity,
            halfStep1.acceleration,
            { ...config, dt: dt/2 }
        );

        // Compute error estimate
        const positionError = fullStep.position.sub(halfStep2.position).norm();
        const velocityError = fullStep.velocity.sub(halfStep2.velocity).norm();

        // Adjust step size if needed
        if (positionError.greater(tolerance).any() || velocityError.greater(tolerance).any()) {
            return this.adaptiveStep(
                positions,
                velocities,
                accelerations,
                { ...config, dt: dt/2 }
            );
        }

        return fullStep;
    }

    private computeAcceleration(
        positions: tf.Tensor3D,
        velocities: tf.Tensor3D
    ): tf.Tensor3D {
        return tf.tidy(() => {
            const gravity = tf.tensor2d([[0, -9.81, 0]]);
            const dragCoeff = 0.1;

            // Compute drag force
            const velocityMagnitude = velocities.norm('euclidean', 2, true);
            const drag = velocities.mul(-dragCoeff).mul(velocityMagnitude);

            // Total acceleration
            return gravity.add(drag);
        });
    }

    private rk4Step(state: tf.Tensor): tf.Tensor {
        const dt = this.defaultConfig.dt;
        const [position, velocity] = tf.split(state, 2);
        
        // RK4 integration
        const k1 = this.computeAcceleration(position, velocity);
        const k2 = this.computeAcceleration(
            position.add(velocity.mul(dt/2)),
            velocity.add(k1.mul(dt/2))
        );
        const k3 = this.computeAcceleration(
            position.add(velocity.mul(dt/2).add(k1.mul(dt*dt/4))),
            velocity.add(k2.mul(dt/2))
        );
        const k4 = this.computeAcceleration(
            position.add(velocity.mul(dt).add(k2.mul(dt*dt/2))),
            velocity.add(k3.mul(dt))
        );

        const newPosition = position.add(
            velocity.mul(dt).add(
                k1.add(k2.mul(2)).add(k3.mul(2)).add(k4).mul(dt/6)
            )
        );
        const newVelocity = velocity.add(
            k1.add(k2.mul(2)).add(k3.mul(2)).add(k4).mul(dt/6)
        );

        return tf.concat([newPosition, newVelocity], 0);
    }

    public async cleanup(): Promise<void> {
        tf.dispose();
    }
}
