import { MemoryUsage } from '../types';

export class MemoryManager {
    private allocations: Map<string, number>;
    private totalAllocated: number;

    constructor() {
        this.allocations = new Map();
        this.totalAllocated = 0;
    }

    public allocateMemory(size: number, tag?: string): void {
        const id = tag || `allocation_${Date.now()}`;
        this.allocations.set(id, size);
        this.totalAllocated += size;
    }

    public freeMemory(tag: string): void {
        const size = this.allocations.get(tag);
        if (size) {
            this.totalAllocated -= size;
            this.allocations.delete(tag);
        }
    }

    public getMemoryUsage(): MemoryUsage {
        const process = require('process');
        const memUsage = process.memoryUsage();
        
        return {
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            gc: []  // Garbage collection stats would be populated here
        };
    }

    public getTotalAllocated(): number {
        return this.totalAllocated;
    }

    public getAllocations(): Map<string, number> {
        return new Map(this.allocations);
    }
}
