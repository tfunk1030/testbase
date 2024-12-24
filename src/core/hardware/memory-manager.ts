import { MemoryPool } from './memory-pool';
import { RealTimeMonitor } from '../real-time-monitor';
import { HardwareMonitor } from './hardware-monitor';

interface PoolConfig {
    name: string;
    itemSize: number;
    initialSize: number;
    maxSize: number;
    growthFactor: number;
}

interface MemoryStats {
    totalAllocated: number;
    totalUsed: number;
    totalFree: number;
    pools: {
        [name: string]: {
            size: number;
            used: number;
            free: number;
            fragmentation: number;
            allocationCount: number;
            deallocationCount: number;
        };
    };
}

export class MemoryManager {
    private static instance: MemoryManager;
    private readonly monitor: RealTimeMonitor;
    private readonly hardwareMonitor: HardwareMonitor;
    private readonly pools: Map<string, MemoryPool> = new Map();
    private readonly defaultConfigs: { [key: string]: PoolConfig } = {
        'vector': {
            name: 'vector',
            itemSize: 24, // 3 * 8 bytes for Vector3D
            initialSize: 1024 * 1024, // 1MB
            maxSize: 10 * 1024 * 1024, // 10MB
            growthFactor: 1.5
        },
        'trajectory': {
            name: 'trajectory',
            itemSize: 48, // Position + Velocity vectors
            initialSize: 2 * 1024 * 1024, // 2MB
            maxSize: 20 * 1024 * 1024, // 20MB
            growthFactor: 1.5
        },
        'state': {
            name: 'state',
            itemSize: 96, // Full ball state
            initialSize: 512 * 1024, // 512KB
            maxSize: 5 * 1024 * 1024, // 5MB
            growthFactor: 1.5
        }
    };

    private readonly gcConfig = {
        fragmentationThreshold: 0.4,
        memoryPressureThreshold: 0.8,
        defragmentationInterval: 60000, // 1 minute
        gcInterval: 30000 // 30 seconds
    };

    private constructor() {
        this.monitor = RealTimeMonitor.getInstance();
        this.hardwareMonitor = HardwareMonitor.getInstance();
        this.initialize();
        this.startMonitoring();
        this.startGarbageCollection();
    }

    public static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    private initialize(): void {
        // Create default pools with hardware-aware sizing
        const memoryInfo = this.hardwareMonitor.getHardwareProfile().memory;
        const totalMemoryGB = memoryInfo.total / (1024 * 1024 * 1024);

        // Adjust pool sizes based on available memory
        const scaleFactor = Math.max(0.5, Math.min(2, totalMemoryGB / 8)); // Normalize to 8GB baseline

        for (const [name, config] of Object.entries(this.defaultConfigs)) {
            const scaledConfig = {
                ...config,
                initialSize: Math.floor(config.initialSize * scaleFactor),
                maxSize: Math.floor(config.maxSize * scaleFactor)
            };
            this.createPool(scaledConfig);
        }
    }

    private startMonitoring(): void {
        setInterval(() => {
            const stats = this.getStats();
            
            // Check memory pressure
            const totalMemory = this.hardwareMonitor.getHardwareProfile().memory.total;
            const usageRatio = stats.totalUsed / totalMemory;

            if (usageRatio > 0.8) {
                this.emit('memoryPressure', {
                    level: 'warning',
                    message: `High memory usage: ${(usageRatio * 100).toFixed(1)}%`,
                    stats
                });
            }

            // Check fragmentation
            for (const [name, poolStats] of Object.entries(stats.pools)) {
                if (poolStats.fragmentation > 0.5) {
                    this.emit('fragmentation', {
                        level: 'warning',
                        message: `High fragmentation in pool ${name}: ${(poolStats.fragmentation * 100).toFixed(1)}%`,
                        pool: name
                    });
                }
            }
        }, 5000); // Check every 5 seconds
    }

    private startGarbageCollection(): void {
        // Regular garbage collection cycle
        setInterval(() => {
            this.collectGarbage();
        }, this.gcConfig.gcInterval);

        // Regular defragmentation cycle
        setInterval(() => {
            this.smartDefragmentation();
        }, this.gcConfig.defragmentationInterval);
    }

    private collectGarbage(): void {
        const stats = this.getStats();
        const systemMemory = this.hardwareMonitor.getHardwareProfile().memory;
        const memoryPressure = stats.totalUsed / systemMemory.total;

        // Aggressive collection under memory pressure
        if (memoryPressure > this.gcConfig.memoryPressureThreshold) {
            this.emit('gc', { level: 'aggressive', memoryPressure });
            this.aggressiveCollection();
        } else {
            this.emit('gc', { level: 'normal', memoryPressure });
            this.normalCollection();
        }
    }

    private normalCollection(): void {
        for (const [name, pool] of this.pools.entries()) {
            const poolStats = pool.getStats();
            const fragmentationRatio = poolStats.fragmentationRatio;

            if (fragmentationRatio > this.gcConfig.fragmentationThreshold) {
                this.defragmentPool(name);
            }
        }
    }

    private aggressiveCollection(): void {
        // Perform defragmentation on all pools
        this.defragmentAll();

        // Clear unused pools
        for (const [name, pool] of this.pools.entries()) {
            const stats = pool.getStats();
            if (stats.usedSize === 0) {
                pool.clear();
                this.emit('pool_cleared', { name });
            }
        }
    }

    private smartDefragmentation(): void {
        const stats = this.getStats();
        const fragmentedPools = Object.entries(stats.pools)
            .filter(([_, poolStats]) => poolStats.fragmentation > this.gcConfig.fragmentationThreshold)
            .sort((a, b) => b[1].fragmentation - a[1].fragmentation);

        for (const [name] of fragmentedPools) {
            this.defragmentPool(name);
            this.emit('pool_defragmented', { name, newStats: this.pools.get(name)?.getStats() });
        }
    }

    public createPool(config: PoolConfig): void {
        if (this.pools.has(config.name)) {
            throw new Error(`Pool ${config.name} already exists`);
        }

        const pool = new MemoryPool(config);
        this.pools.set(config.name, pool);
    }

    public allocate(poolName: string): ArrayBuffer | null {
        const pool = this.pools.get(poolName);
        if (!pool) {
            throw new Error(`Pool ${poolName} does not exist`);
        }

        return pool.allocate();
    }

    public deallocate(poolName: string, buffer: ArrayBuffer): boolean {
        const pool = this.pools.get(poolName);
        if (!pool) {
            throw new Error(`Pool ${poolName} does not exist`);
        }

        return pool.deallocate(buffer);
    }

    public getStats(): MemoryStats {
        const stats: MemoryStats = {
            totalAllocated: 0,
            totalUsed: 0,
            totalFree: 0,
            pools: {}
        };

        for (const [name, pool] of this.pools.entries()) {
            const poolStats = pool.getStats();
            stats.totalAllocated += poolStats.totalSize;
            stats.totalUsed += poolStats.usedSize;
            stats.totalFree += poolStats.freeSize;

            stats.pools[name] = {
                size: poolStats.totalSize,
                used: poolStats.usedSize,
                free: poolStats.freeSize,
                fragmentation: poolStats.fragmentationRatio,
                allocationCount: poolStats.allocationCount,
                deallocationCount: poolStats.deallocationCount
            };
        }

        return stats;
    }

    public defragmentPool(poolName: string): void {
        const pool = this.pools.get(poolName);
        if (!pool) {
            throw new Error(`Pool ${poolName} does not exist`);
        }

        pool.defragment();
    }

    public defragmentAll(): void {
        for (const pool of this.pools.values()) {
            pool.defragment();
        }
    }

    public clearPool(poolName: string): void {
        const pool = this.pools.get(poolName);
        if (!pool) {
            throw new Error(`Pool ${poolName} does not exist`);
        }

        pool.clear();
    }

    public clearAll(): void {
        for (const pool of this.pools.values()) {
            pool.clear();
        }
    }

    private emit(event: string, data: any): void {
        this.monitor.emit(event, data);
    }
}
