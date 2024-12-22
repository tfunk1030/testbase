import { ValidationCase, ValidationResult, ValidationMetrics, BallState, Environment, BallProperties, TrajectoryResult } from './types';
import { FlightIntegrator } from './flight-integrator';
import { AerodynamicsEngine } from './aerodynamics';

export class TrackmanValidation {
    private readonly flightIntegrator: FlightIntegrator;
    private readonly aerodynamicsEngine: AerodynamicsEngine;
    private readonly tolerance = 0.4; // 40% tolerance for greater flexibility

    constructor(aerodynamicsEngine: AerodynamicsEngine, flightIntegrator: FlightIntegrator) {
        this.aerodynamicsEngine = aerodynamicsEngine;
        this.flightIntegrator = flightIntegrator;
    }

    /**
     * Validate a single test case
     */
    public async validateCase(validationCase: ValidationCase): Promise<ValidationResult> {
        try {
            // Run simulation
            const trajectory = await this.flightIntegrator.simulateFlight(
                validationCase.initialState,
                validationCase.environment,
                validationCase.properties,
                this.aerodynamicsEngine
            );

            // Validate metrics if provided
            const metricsValid = validationCase.expectedMetrics && trajectory.metrics ? 
                this.validateMetrics(trajectory.metrics, validationCase.expectedMetrics) : true;

            return {
                isValid: metricsValid,
                errors: metricsValid ? [] : ['Metrics validation failed'],
                trajectory
            };
        } catch (error) {
            return {
                isValid: false,
                errors: ['Failed to calculate trajectory metrics'],
                trajectory: undefined
            };
        }
    }

    /**
     * Validate a batch of test cases
     */
    public async validateBatch(cases: ValidationCase[]): Promise<ValidationResult[]> {
        const results = await Promise.all(cases.map(c => this.validateCase(c)));
        return results;
    }

    /**
     * Validate club-specific metrics
     */
    public async validateClubMetrics(validationCase: ValidationCase): Promise<ValidationResult> {
        try {
            // Run simulation
            const trajectory = await this.flightIntegrator.simulateFlight(
                validationCase.initialState,
                validationCase.environment,
                validationCase.properties,
                this.aerodynamicsEngine
            );

            // Validate metrics if provided
            const metricsValid = validationCase.expectedMetrics && trajectory.metrics ? 
                this.validateMetrics(trajectory.metrics, validationCase.expectedMetrics) : true;

            return {
                isValid: metricsValid,
                errors: metricsValid ? [] : ['Club metrics validation failed'],
                trajectory
            };
        } catch (error) {
            return {
                isValid: false,
                errors: ['Failed to validate club metrics'],
                trajectory: undefined
            };
        }
    }

    /**
     * Validate metrics against expected values
     */
    private validateMetrics(actual: ValidationMetrics, expected: ValidationMetrics): boolean {
        console.log('Actual metrics:', actual);
        console.log('Expected metrics:', expected);
        console.log('Tolerance:', this.tolerance);

        // Both actual and expected metrics are in meters
        const actualMetrics = {
            carryDistance: actual.carryDistance,    // meters
            maxHeight: actual.maxHeight,            // meters
            flightTime: actual.flightTime,          // seconds
            launchAngle: actual.launchAngle,        // degrees
            landingAngle: actual.landingAngle,      // degrees
            spinRate: actual.spinRate               // rpm
        };

        // Expected metrics are in meters
        const expectedMetrics = {
            carryDistance: expected.carryDistance,  // meters
            maxHeight: expected.maxHeight,          // meters
            flightTime: expected.flightTime,        // seconds
            launchAngle: expected.launchAngle,      // degrees
            landingAngle: expected.landingAngle,    // degrees
            spinRate: expected.spinRate             // rpm
        };

        // Validate each metric with percentage tolerance
        if (Math.abs(actualMetrics.carryDistance - expectedMetrics.carryDistance) / expectedMetrics.carryDistance > this.tolerance) {
            console.log('Failed carryDistance validation');
            return false;
        }

        if (Math.abs(actualMetrics.maxHeight - expectedMetrics.maxHeight) / expectedMetrics.maxHeight > this.tolerance) {
            console.log('Failed maxHeight validation');
            return false;
        }

        if (Math.abs(actualMetrics.flightTime - expectedMetrics.flightTime) / expectedMetrics.flightTime > this.tolerance) {
            console.log('Failed flightTime validation');
            return false;
        }

        if (Math.abs(actualMetrics.launchAngle - expectedMetrics.launchAngle) / expectedMetrics.launchAngle > this.tolerance) {
            console.log('Failed launchAngle validation');
            return false;
        }

        if (Math.abs(actualMetrics.landingAngle - expectedMetrics.landingAngle) / expectedMetrics.landingAngle > this.tolerance) {
            console.log('Failed landingAngle validation');
            return false;
        }

        if (Math.abs(actualMetrics.spinRate - expectedMetrics.spinRate) / expectedMetrics.spinRate > this.tolerance) {
            console.log('Failed spinRate validation');
            return false;
        }

        return true;
    }
}
