import {
    LaunchConditions,
    Environment,
    BallProperties,
    DataSet
} from './types';

export class DataGenerator {
    private readonly MIN_BALL_SPEED = 50;
    private readonly MAX_BALL_SPEED = 200;
    private readonly MIN_LAUNCH_ANGLE = -10;
    private readonly MAX_LAUNCH_ANGLE = 60;
    private readonly MIN_LAUNCH_DIRECTION = -90;
    private readonly MAX_LAUNCH_DIRECTION = 90;
    private readonly MIN_TOTAL_SPIN = 0;
    private readonly MAX_TOTAL_SPIN = 10000;
    private readonly MIN_SPIN_AXIS = -90;
    private readonly MAX_SPIN_AXIS = 90;

    private readonly TIME_OF_DAY_OPTIONS = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'] as const;
    private readonly DIMPLE_SHAPE_OPTIONS = ['circular', 'hexagonal', 'triangular'] as const;
    private readonly DIMPLE_PATTERN_OPTIONS = ['icosahedral', 'octahedral', 'tetrahedral', 'hybrid'] as const;
    private readonly EDGE_PROFILE_OPTIONS = ['sharp', 'rounded', 'smooth'] as const;
    private readonly SURFACE_TEXTURE_OPTIONS = ['smooth', 'textured', 'rough'] as const;
    private readonly CONSTRUCTION_OPTIONS = ['2-piece', '3-piece', '4-piece', '5-piece'] as const;

    /**
     * Generate random number within range
     */
    private randomInRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    /**
     * Generate random launch conditions
     */
    public generateLaunchConditions(): LaunchConditions {
        return {
            ballSpeed: this.randomInRange(this.MIN_BALL_SPEED, this.MAX_BALL_SPEED),
            launchAngle: this.randomInRange(this.MIN_LAUNCH_ANGLE, this.MAX_LAUNCH_ANGLE),
            launchDirection: this.randomInRange(this.MIN_LAUNCH_DIRECTION, this.MAX_LAUNCH_DIRECTION),
            totalSpin: this.randomInRange(this.MIN_TOTAL_SPIN, this.MAX_TOTAL_SPIN),
            spinAxis: this.randomInRange(this.MIN_SPIN_AXIS, this.MAX_SPIN_AXIS)
        };
    }

    /**
     * Generate random environment
     */
    public generateEnvironment(): Environment {
        return {
            temperature: this.randomInRange(-20, 120),
            windSpeed: this.randomInRange(0, 50),
            windDirection: this.randomInRange(-180, 180),
            altitude: this.randomInRange(-1000, 15000),
            humidity: this.randomInRange(0, 100),
            pressure: this.randomInRange(25, 35),
            timeOfDay: this.TIME_OF_DAY_OPTIONS[
                Math.floor(Math.random() * this.TIME_OF_DAY_OPTIONS.length)
            ]
        };
    }

    /**
     * Generate random ball properties
     */
    public generateBallProperties(): BallProperties {
        return {
            mass: this.randomInRange(40, 50),
            diameter: this.randomInRange(1.6, 1.7),
            dimpleCount: Math.floor(this.randomInRange(300, 500)),
            dimpleShape: this.DIMPLE_SHAPE_OPTIONS[
                Math.floor(Math.random() * this.DIMPLE_SHAPE_OPTIONS.length)
            ],
            dimplePattern: this.DIMPLE_PATTERN_OPTIONS[
                Math.floor(Math.random() * this.DIMPLE_PATTERN_OPTIONS.length)
            ],
            edgeProfile: this.EDGE_PROFILE_OPTIONS[
                Math.floor(Math.random() * this.EDGE_PROFILE_OPTIONS.length)
            ],
            surfaceTexture: this.SURFACE_TEXTURE_OPTIONS[
                Math.floor(Math.random() * this.SURFACE_TEXTURE_OPTIONS.length)
            ],
            construction: this.CONSTRUCTION_OPTIONS[
                Math.floor(Math.random() * this.CONSTRUCTION_OPTIONS.length)
            ],
            dimpleCoverage: this.randomInRange(0.6, 0.9),
            dimpleDepth: this.randomInRange(0.005, 0.015),
            compression: Math.floor(this.randomInRange(50, 120))
        };
    }

    /**
     * Generate dataset with random variations
     */
    public generateDataSet(numSamples: number): DataSet {
        const conditions: LaunchConditions[] = [];
        for (let i = 0; i < numSamples; i++) {
            conditions.push(this.generateLaunchConditions());
        }

        return {
            trajectories: [],
            conditions: conditions,
            environment: this.generateEnvironment(),
            ballProperties: this.generateBallProperties()
        };
    }
}
