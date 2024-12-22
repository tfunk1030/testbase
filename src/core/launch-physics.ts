import { LaunchConditions, BallProperties, Environment } from './types';

export class LaunchPhysics {
    private readonly GRAVITY = 9.81; // m/s^2
    private readonly AIR_DENSITY_SEA_LEVEL = 1.225; // kg/m^3
    private readonly STANDARD_PRESSURE = 1013.25; // hPa
    private readonly STANDARD_TEMPERATURE = 288.15; // K
    private readonly GAS_CONSTANT = 287.05; // J/(kg·K)

    /**
     * Calculate initial velocity components
     */
    public calculateInitialVelocity(conditions: LaunchConditions): {
        vx: number;
        vy: number;
        vz: number;
    } {
        const speedMPS = conditions.ballSpeed * 0.44704; // Convert mph to m/s
        const angleRad = (conditions.launchAngle * Math.PI) / 180;
        const directionRad = (conditions.launchDirection * Math.PI) / 180;

        return {
            vx: speedMPS * Math.cos(angleRad) * Math.cos(directionRad),
            vy: speedMPS * Math.sin(angleRad),
            vz: speedMPS * Math.cos(angleRad) * Math.sin(directionRad)
        };
    }

    /**
     * Calculate initial spin components
     */
    public calculateInitialSpin(conditions: LaunchConditions): {
        wx: number;
        wy: number;
        wz: number;
    } {
        const spinRPS = conditions.totalSpin * (2 * Math.PI) / 60; // Convert rpm to rad/s
        const axisRad = (conditions.spinAxis * Math.PI) / 180;

        return {
            wx: spinRPS * Math.sin(axisRad),
            wy: spinRPS * Math.cos(axisRad),
            wz: 0
        };
    }

    /**
     * Calculate air density based on environmental conditions
     */
    public calculateAirDensity(environment: Environment): number {
        // Convert temperature from Fahrenheit to Kelvin
        const temperatureK = (environment.temperature - 32) * 5/9 + 273.15;
        
        // Convert pressure from inHg to hPa
        const pressureHPa = environment.pressure * 33.8639;
        
        // Calculate air density using ideal gas law
        return pressureHPa * 100 / (this.GAS_CONSTANT * temperatureK);
    }

    /**
     * Calculate initial launch parameters
     */
    public calculateLaunchParameters(
        conditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties
    ): {
        velocity: { vx: number; vy: number; vz: number };
        spin: { wx: number; wy: number; wz: number };
        airDensity: number;
        reynoldsNumber: number;
    } {
        const velocity = this.calculateInitialVelocity(conditions);
        const spin = this.calculateInitialSpin(conditions);
        const airDensity = this.calculateAirDensity(environment);

        // Calculate Reynolds number
        const speed = Math.sqrt(
            velocity.vx * velocity.vx +
            velocity.vy * velocity.vy +
            velocity.vz * velocity.vz
        );
        const diameter = ballProperties.diameter * 0.0254; // Convert inches to meters
        const viscosity = 1.81e-5; // Air viscosity at 20°C
        const reynoldsNumber = (airDensity * speed * diameter) / viscosity;

        // Apply compression effects if available
        if (ballProperties.compression !== undefined) {
            const compressionFactor = 1 + (ballProperties.compression - 90) * 0.001;
            velocity.vx *= compressionFactor;
            velocity.vy *= compressionFactor;
            velocity.vz *= compressionFactor;
        }

        return {
            velocity,
            spin,
            airDensity,
            reynoldsNumber
        };
    }
}
