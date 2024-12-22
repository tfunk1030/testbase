import { SurfaceEffects } from './types';

export class SurfaceEffectsCalculator {
    /**
     * Calculate surface effects based on ball properties
     */
    public calculateSurfaceEffects(
        dimpleCoverage: number,
        dimpleDepth: number,
        surfaceTexture: 'smooth' | 'textured' | 'rough'
    ): SurfaceEffects {
        // Base modifiers
        let dragModifier = 1.0;
        let liftModifier = 1.0;

        // Adjust for dimple coverage
        dragModifier *= 1.0 - (dimpleCoverage - 0.75) * 0.5;
        liftModifier *= 1.0 + (dimpleCoverage - 0.75) * 0.3;

        // Adjust for dimple depth
        const normalizedDepth = (dimpleDepth - 0.008) / 0.004; // Normalize around typical depth
        dragModifier *= 1.0 - normalizedDepth * 0.2;
        liftModifier *= 1.0 + normalizedDepth * 0.15;

        // Adjust for surface texture
        switch (surfaceTexture) {
            case 'smooth':
                // No adjustment for smooth
                break;
            case 'textured':
                dragModifier *= 1.05;
                liftModifier *= 1.1;
                break;
            case 'rough':
                dragModifier *= 1.15;
                liftModifier *= 1.2;
                break;
        }

        return {
            friction: 0.3,
            restitution: 0.8,
            rollResistance: 0.1,
            bounceAngle: 45,
            dragModifier,
            liftModifier
        };
    }
}
