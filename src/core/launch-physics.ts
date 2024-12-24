import { LaunchConditions, BallProperties, Environment } from './types';

export class LaunchPhysics {
    private readonly GAS_CONSTANT = 287.05; // J/(kg·K)

    /**
     * Calculate initial velocity components
     */
    public calculateInitialVelocity(conditions: LaunchConditions): {
        vx: number;
        vy: number;
        vz: number;
    } {
        const speedMPS = conditions.ballSpeed; // Already in m/s
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
        // Convert temperature from Celsius to Kelvin
        const temperatureK = environment.temperature + 273.15;
        
        // Convert pressure from hPa to Pa
        const pressurePa = environment.pressure * 100;
        
        // Calculate air density using ideal gas law
        return pressurePa / (this.GAS_CONSTANT * temperatureK);
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
        const diameter = ballProperties.diameter; // Already in meters
        const viscosity = 1.81e-5; // Air viscosity at 20°C
        const reynoldsNumber = (airDensity * speed * diameter) / viscosity;

        // Apply temperature effects
        const temperatureK = environment.temperature + 273.15;
        const standardTemp = 293.15; // 20°C in Kelvin
        const temperatureFactor = Math.sqrt(temperatureK / standardTemp);
        velocity.vx *= temperatureFactor;
        velocity.vy *= temperatureFactor;
        velocity.vz *= temperatureFactor;

        // Apply wind effects
        const windSpeedX = environment.windSpeed * Math.cos(environment.windDirection * Math.PI / 180);
        const windSpeedZ = environment.windSpeed * Math.sin(environment.windDirection * Math.PI / 180);
        velocity.vx -= windSpeedX;
        velocity.vz -= windSpeedZ;

        return {
            velocity,
            spin,
            airDensity,
            reynoldsNumber
        };
    }

    /**
     * Process launch conditions to get initial state
     */
    public processLaunch(conditions: LaunchConditions, environment: Environment, ballProperties: BallProperties) {
        const params = this.calculateLaunchParameters(conditions, environment, ballProperties);
        
        return {
            velocity: params.velocity,
            spin: params.spin,
            airDensity: params.airDensity,
            initialState: {
                position: { x: 0, y: 0, z: 0 },
                velocity: { x: params.velocity.vx, y: params.velocity.vy, z: params.velocity.vz },
                spin: { x: params.spin.wx, y: params.spin.wy, z: params.spin.wz },
                mass: ballProperties.mass
            }
        };
    }
}
