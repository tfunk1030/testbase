import {
    ClubType,
    ClubSpecifications,
    ClubValidationCase,
    ValidationResult,
    ValidationMetrics
} from './types';

export class ClubValidation {
    // Club-specific validation thresholds
    private readonly DRIVER_THRESHOLDS = {
        carryDistance: 2.0,  // meters
        maxHeight: 1.0,      // meters
        flightTime: 0.3,     // seconds
        launchAngle: 1.0,    // degrees
        landingAngle: 3.0,   // degrees
        spinRate: 100,       // rpm
        r2Score: 0.95
    };

    private readonly IRON_THRESHOLDS = {
        carryDistance: 1.75, // meters
        maxHeight: 0.75,     // meters
        flightTime: 0.25,    // seconds
        launchAngle: 1.0,    // degrees
        landingAngle: 3.0,   // degrees
        spinRate: 150,       // rpm
        r2Score: 0.95
    };

    private readonly WEDGE_THRESHOLDS = {
        carryDistance: 1.5,  // meters
        maxHeight: 0.75,     // meters
        flightTime: 0.2,     // seconds
        launchAngle: 1.0,    // degrees
        landingAngle: 3.0,   // degrees
        spinRate: 200,       // rpm
        r2Score: 0.95
    };

    /**
     * Get validation thresholds for specific club type
     */
    private getThresholds(clubType: ClubType) {
        switch (clubType) {
            case 'driver':
                return this.DRIVER_THRESHOLDS;
            case 'iron':
                return this.IRON_THRESHOLDS;
            case 'wedge':
                return this.WEDGE_THRESHOLDS;
            default:
                throw new Error(`Unsupported club type: ${clubType}`);
        }
    }

    /**
     * Validate club-specific metrics
     */
    public validateClubMetrics(validationCase: ClubValidationCase): ValidationResult {
        const { clubSpecs, expectedMetrics, trajectory } = validationCase;
        const thresholds = this.getThresholds(clubSpecs.type);
        const actualMetrics = trajectory.metrics;

        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate metrics with club-specific thresholds
        this.validateMetric(
            'Carry distance',
            actualMetrics.carryDistance,
            expectedMetrics.carryDistance,
            thresholds.carryDistance,
            errors,
            warnings
        );

        this.validateMetric(
            'Max height',
            actualMetrics.maxHeight,
            expectedMetrics.maxHeight,
            thresholds.maxHeight,
            errors,
            warnings
        );

        this.validateMetric(
            'Flight time',
            actualMetrics.flightTime,
            expectedMetrics.flightTime,
            thresholds.flightTime,
            errors,
            warnings
        );

        this.validateMetric(
            'Launch angle',
            actualMetrics.launchAngle,
            expectedMetrics.launchAngle,
            thresholds.launchAngle,
            errors,
            warnings
        );

        this.validateMetric(
            'Landing angle',
            actualMetrics.landingAngle,
            expectedMetrics.landingAngle,
            thresholds.landingAngle,
            errors,
            warnings
        );

        this.validateMetric(
            'Spin rate',
            actualMetrics.spinRate,
            expectedMetrics.spinRate,
            thresholds.spinRate,
            errors,
            warnings
        );

        // Calculate detailed metrics
        const detailedMetrics = {
            carryDistanceError: Math.abs(actualMetrics.carryDistance - expectedMetrics.carryDistance),
            maxHeightError: Math.abs(actualMetrics.maxHeight - expectedMetrics.maxHeight),
            flightTimeError: Math.abs(actualMetrics.flightTime - expectedMetrics.flightTime),
            launchAngleError: Math.abs(actualMetrics.launchAngle - expectedMetrics.launchAngle),
            landingAngleError: Math.abs(actualMetrics.landingAngle - expectedMetrics.landingAngle),
            spinRateError: Math.abs(actualMetrics.spinRate - expectedMetrics.spinRate)
        };

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metrics: actualMetrics,
            trajectory,
            detailedMetrics
        };
    }

    /**
     * Validate a single metric
     */
    private validateMetric(
        name: string,
        actual: number,
        expected: number,
        threshold: number,
        errors: string[],
        warnings: string[]
    ): void {
        const diff = Math.abs(actual - expected);
        const warningThreshold = threshold * 0.9;

        if (diff > threshold) {
            errors.push(`${name} error: ${diff.toFixed(2)} (threshold: ${threshold})`);
        } else if (diff > warningThreshold) {
            warnings.push(`${name} is within ${((1 - diff/threshold) * 100).toFixed(1)}% of threshold`);
        }
    }

    /**
     * Validate club specifications
     */
    public validateClubSpecs(specs: ClubSpecifications): string[] {
        const errors: string[] = [];

        // Validate loft angle
        if (specs.type === 'driver') {
            if (specs.loft < 8 || specs.loft > 12) {
                errors.push(`Driver loft must be between 8° and 12°`);
            }
        } else if (specs.type === 'iron') {
            if (specs.loft < 17 || specs.loft > 48) {
                errors.push(`Iron loft must be between 17° and 48°`);
            }
        } else if (specs.type === 'wedge') {
            if (specs.loft < 46 || specs.loft > 64) {
                errors.push(`Wedge loft must be between 46° and 64°`);
            }
        }

        // Validate club length
        if (specs.length < 32 || specs.length > 48) {
            errors.push(`Club length must be between 32" and 48"`);
        }

        // Validate club weight
        if (specs.weight < 280 || specs.weight > 420) {
            errors.push(`Club weight must be between 280g and 420g`);
        }

        // Validate swing weight
        const validSwingWeights = ['C7', 'C8', 'C9', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
        if (!validSwingWeights.includes(specs.swingWeight)) {
            errors.push(`Invalid swing weight: ${specs.swingWeight}`);
        }

        // Validate flex
        const validFlex = ['Ladies', 'Senior', 'Regular', 'Stiff', 'Extra Stiff'];
        if (!validFlex.includes(specs.flex)) {
            errors.push(`Invalid flex: ${specs.flex}`);
        }

        return errors;
    }
}
