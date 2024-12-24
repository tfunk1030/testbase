import { ValidationCase, ValidationResult, Environment, BallState, BallProperties } from '../types';
import { AerodynamicsEngineImpl } from '../core/aerodynamics';
import { FlightIntegrator } from '../core/flight-integrator';
import { weatherValidationCases } from './weather-validation';
import { calculateForceMagnitude, calculateTotalForce } from './test-utils';

interface ValidationSuiteResults {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    results: {
        testName: string;
        passed: boolean;
        error?: string;
        metrics?: {
            expected: any;
            actual: any;
            difference: number;
            withinTolerance: boolean;
        };
    }[];
}

export class ValidationSuite {
    private readonly aero: AerodynamicsEngineImpl;
    private readonly integrator: FlightIntegrator;
    private readonly tolerance = 0.4; // 40% tolerance as per requirements

    constructor() {
        this.aero = new AerodynamicsEngineImpl();
        this.integrator = new FlightIntegrator();
    }

    /**
     * Run all validation tests
     */
    public async runAllTests(): Promise<ValidationSuiteResults> {
        const results: ValidationSuiteResults = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            results: []
        };

        // Run weather validation tests
        await this.runTestSet(weatherValidationCases, 'Weather Effects', results);

        // Run spin validation tests
        await this.runTestSet(this.generateSpinValidationCases(), 'Spin Effects', results);

        // Run altitude validation tests
        await this.runTestSet(this.generateAltitudeValidationCases(), 'Altitude Effects', results);

        // Run club validation tests
        await this.runTestSet(this.generateClubValidationCases(), 'Club Effects', results);

        return results;
    }

    /**
     * Run a set of validation tests
     */
    private async runTestSet(
        cases: ValidationCase[],
        testSetName: string,
        results: ValidationSuiteResults
    ): Promise<void> {
        for (const testCase of cases) {
            results.totalTests++;

            try {
                const trajectory = await this.integrator.simulateFlight(
                    testCase.initialState,
                    testCase.environment,
                    testCase.properties,
                    this.aero
                );

                const passed = this.validateMetrics(testCase.expectedMetrics, trajectory.metrics);

                results.results.push({
                    testName: `${testSetName} - ${this.getTestDescription(testCase)}`,
                    passed,
                    metrics: {
                        expected: testCase.expectedMetrics,
                        actual: trajectory.metrics,
                        difference: this.calculateMaxDifference(testCase.expectedMetrics, trajectory.metrics),
                        withinTolerance: passed
                    }
                });

                if (passed) {
                    results.passedTests++;
                } else {
                    results.failedTests++;
                }
            } catch (error) {
                results.failedTests++;
                results.results.push({
                    testName: `${testSetName} - ${this.getTestDescription(testCase)}`,
                    passed: false,
                    error: error.message
                });
            }
        }
    }

    /**
     * Validate metrics are within tolerance
     */
    private validateMetrics(expected: any, actual: any): boolean {
        if (!expected || !actual) return false;

        for (const key in expected) {
            const diff = Math.abs((actual[key] - expected[key]) / expected[key]);
            if (diff > this.tolerance) {
                return false;
            }
        }

        return true;
    }

    /**
     * Calculate maximum difference in metrics
     */
    private calculateMaxDifference(expected: any, actual: any): number {
        if (!expected || !actual) return 1;

        let maxDiff = 0;
        for (const key in expected) {
            const diff = Math.abs((actual[key] - expected[key]) / expected[key]);
            maxDiff = Math.max(maxDiff, diff);
        }

        return maxDiff;
    }

    /**
     * Get human-readable test description
     */
    private getTestDescription(testCase: ValidationCase): string {
        const env = testCase.environment;
        return `T:${env.temperature}°C H:${env.humidity*100}% A:${env.altitude}m`;
    }

    /**
     * Generate spin validation test cases
     */
    private generateSpinValidationCases(): ValidationCase[] {
        const baseBallState: BallState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 70, y: 0, z: 30 },
            spin: { rate: 2500, axis: { x: 0, y: 1, z: 0 } },
            mass: 0.0459
        };

        const baseEnvironment: Environment = {
            temperature: 20,
            pressure: 101325,
            humidity: 0.5,
            altitude: 0,
            wind: { x: 0, y: 0, z: 0 }
        };

        const baseBallProperties: BallProperties = {
            radius: 0.02135,
            mass: 0.0459,
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            spinDecayRate: 0.08
        };

        return [
            // Low spin case
            {
                initialState: {
                    ...baseBallState,
                    spin: { rate: 1500, axis: { x: 0, y: 1, z: 0 } }
                },
                environment: baseEnvironment,
                properties: baseBallProperties,
                expectedMetrics: {
                    carryDistance: 230,
                    maxHeight: 28,
                    flightTime: 5.8,
                    launchAngle: 23,
                    landingAngle: -35
                }
            },
            // High spin case
            {
                initialState: {
                    ...baseBallState,
                    spin: { rate: 3500, axis: { x: 0, y: 1, z: 0 } }
                },
                environment: baseEnvironment,
                properties: baseBallProperties,
                expectedMetrics: {
                    carryDistance: 235,
                    maxHeight: 35,
                    flightTime: 6.4,
                    launchAngle: 23,
                    landingAngle: -40
                }
            }
        ];
    }

    /**
     * Generate altitude validation test cases
     */
    private generateAltitudeValidationCases(): ValidationCase[] {
        // Similar structure to spin validation cases
        // Implementation based on altitude-effects.md research
        return [];  // TODO: Implement altitude test cases
    }

    /**
     * Generate club validation test cases
     */
    private generateClubValidationCases(): ValidationCase[] {
        // Similar structure to spin validation cases
        // Implementation based on club-effects.md research
        return [];  // TODO: Implement club test cases
    }
}
