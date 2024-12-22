import { Vector3D, Forces } from '../types';

export function calculateForceMagnitude(force: Vector3D): number {
    return Math.sqrt(force.x * force.x + force.y * force.y + force.z * force.z);
}

export function calculateTotalForce(forces: Forces): Vector3D {
    return {
        x: forces.drag.x + forces.lift.x + forces.magnus.x,
        y: forces.drag.y + forces.lift.y + forces.magnus.y,
        z: forces.drag.z + forces.lift.z + forces.magnus.z
    };
}
