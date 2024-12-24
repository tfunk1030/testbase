import * as os from 'os';
import { EventEmitter } from 'events';
import { RealTimeMonitor } from '../real-time-monitor';

interface HardwareInfo {
    cpu: {
        model: string;
        speed: number;
        cores: number;
        physicalCores: number;
    };
    memory: {
        total: number;
        free: number;
        available: number;
    };
    system: {
        platform: string;
        arch: string;
        version: string;
    };
}

interface ResourceUsage {
    cpu: {
        usage: number;
        loadAverage: number[];
        temperature?: number;
    };
    memory: {
        used: number;
        free: number;
        cached?: number;
        buffers?: number;
    };
    process: {
        cpu: number;
        memory: number;
        uptime: number;
    };
}

export class HardwareMonitor extends EventEmitter {
    private static instance: HardwareMonitor;
    private readonly monitor: RealTimeMonitor;
    private readonly updateInterval: number = 1000; // 1 second
    private readonly hardwareInfo: HardwareInfo;
    private lastCpuInfo: { idle: number; total: number } = { idle: 0, total: 0 };
    private lastCpuUsage = process.cpuUsage();

    private constructor() {
        super();
        this.monitor = RealTimeMonitor.getInstance();
        this.hardwareInfo = this.getHardwareInfo();
        this.startMonitoring();
    }

    public static getInstance(): HardwareMonitor {
        if (!HardwareMonitor.instance) {
            HardwareMonitor.instance = new HardwareMonitor();
        }
        return HardwareMonitor.instance;
    }

    private getHardwareInfo(): HardwareInfo {
        const cpus = os.cpus();
        const physicalCores = new Set(cpus.map(cpu => cpu.model)).size;

        return {
            cpu: {
                model: cpus[0].model,
                speed: cpus[0].speed,
                cores: cpus.length,
                physicalCores
            },
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                available: os.freemem() // Will be updated in monitoring loop
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                version: os.version()
            }
        };
    }

    private startMonitoring(): void {
        setInterval(() => {
            const usage = this.getResourceUsage();
            this.emit('usage', usage);

            // Check for resource pressure
            this.checkResourcePressure(usage);
        }, this.updateInterval);
    }

    private async getResourceUsage(): Promise<ResourceUsage> {
        const cpuUsage = await this.getCpuUsage();
        const memInfo = this.getMemoryInfo();
        const processInfo = this.getProcessInfo();

        return {
            cpu: {
                usage: cpuUsage,
                loadAverage: os.loadavg(),
                temperature: await this.getCpuTemperature()
            },
            memory: memInfo,
            process: processInfo
        };
    }

    private async getCpuUsage(): Promise<number> {
        return new Promise((resolve) => {
            const cpus = os.cpus();
            let idle = 0;
            let total = 0;

            for (const cpu of cpus) {
                idle += cpu.times.idle;
                total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle;
            }

            const idleDiff = idle - this.lastCpuInfo.idle;
            const totalDiff = total - this.lastCpuInfo.total;

            this.lastCpuInfo = { idle, total };

            const usage = totalDiff > 0 ? 100 * (1 - idleDiff / totalDiff) : 0;
            resolve(usage);
        });
    }

    private getMemoryInfo(): {
        used: number;
        free: number;
        cached?: number;
        buffers?: number;
    } {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;

        return {
            used,
            free,
            // Note: cached and buffers are OS-specific
            cached: undefined,
            buffers: undefined
        };
    }

    private getProcessInfo(): {
        cpu: number;
        memory: number;
        uptime: number;
    } {
        const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
        this.lastCpuUsage = process.cpuUsage();

        const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000; // Convert to seconds

        return {
            cpu: cpuPercent * 100,
            memory: process.memoryUsage().heapUsed,
            uptime: process.uptime()
        };
    }

    private async getCpuTemperature(): Promise<number | undefined> {
        // This is platform-specific and may not be available
        try {
            // On Windows, you might need to use external tools or WMI
            return undefined;
        } catch {
            return undefined;
        }
    }

    private checkResourcePressure(usage: ResourceUsage): void {
        // CPU pressure
        if (usage.cpu.usage > 80) {
            this.emit('alert', {
                type: 'cpu',
                level: 'warning',
                message: `High CPU usage: ${usage.cpu.usage.toFixed(1)}%`
            });
        }

        // Memory pressure
        const memoryUsagePercent = (usage.memory.used / os.totalmem()) * 100;
        if (memoryUsagePercent > 90) {
            this.emit('alert', {
                type: 'memory',
                level: 'warning',
                message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`
            });
        }

        // Process pressure
        if (usage.process.cpu > 80) {
            this.emit('alert', {
                type: 'process',
                level: 'warning',
                message: `High process CPU usage: ${usage.process.cpu.toFixed(1)}%`
            });
        }
    }

    public getHardwareProfile(): HardwareInfo {
        return { ...this.hardwareInfo };
    }

    public async getResourceSnapshot(): Promise<ResourceUsage> {
        return await this.getResourceUsage();
    }

    public getRecommendedThreads(): number {
        const physicalCores = this.hardwareInfo.cpu.physicalCores;
        const memoryGB = this.hardwareInfo.memory.total / (1024 * 1024 * 1024);

        // Base recommendation on available resources
        let recommendedThreads = Math.max(1, Math.floor(physicalCores * 0.75));

        // Adjust based on memory
        if (memoryGB < 4) {
            recommendedThreads = Math.min(recommendedThreads, 2);
        } else if (memoryGB < 8) {
            recommendedThreads = Math.min(recommendedThreads, 4);
        }

        return recommendedThreads;
    }

    public getRecommendedBatchSize(): number {
        const memoryGB = this.hardwareInfo.memory.total / (1024 * 1024 * 1024);
        
        // Base batch size on available memory
        if (memoryGB < 4) {
            return 50;
        } else if (memoryGB < 8) {
            return 100;
        } else if (memoryGB < 16) {
            return 200;
        } else {
            return 500;
        }
    }
}
