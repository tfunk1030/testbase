import { HardwareMonitor } from './hardware-monitor';
import { ThreadPool } from './thread-pool';
import { MemoryManager } from './memory-manager';
import * as os from 'os';

interface SystemConfig {
    hardware: {
        cpu: {
            cores: number;
            recommendedThreads: number;
            minThreads: number;
            maxThreads: number;
            cpuTarget: number;
        };
        memory: {
            total: number;
            recommended: number;
            poolSizes: {
                [key: string]: {
                    initial: number;
                    max: number;
                };
            };
            gcThreshold: number;
        };
    };
    performance: {
        batchSize: {
            min: number;
            max: number;
            recommended: number;
        };
        caching: {
            maxSize: number;
            cleanupInterval: number;
            maxAge: number;
        };
        monitoring: {
            sampleInterval: number;
            retentionPeriod: number;
            alertThresholds: {
                cpu: number;
                memory: number;
                errorRate: number;
                responseTime: number;
            };
        };
    };
    optimization: {
        vectorization: boolean;
        parallelization: boolean;
        memoryPooling: boolean;
        adaptiveScaling: boolean;
        preemptiveGC: boolean;
    };
}

export class ConfigGenerator {
    private static instance: ConfigGenerator;
    private readonly hardwareMonitor: HardwareMonitor;
    private readonly threadPool: ThreadPool;
    private readonly memoryManager: MemoryManager;
    private currentConfig: SystemConfig | null = null;

    private constructor() {
        this.hardwareMonitor = HardwareMonitor.getInstance();
        this.threadPool = ThreadPool.getInstance();
        this.memoryManager = MemoryManager.getInstance();
    }

    public static getInstance(): ConfigGenerator {
        if (!ConfigGenerator.instance) {
            ConfigGenerator.instance = new ConfigGenerator();
        }
        return ConfigGenerator.instance;
    }

    public generateConfig(): SystemConfig {
        const hardwareProfile = this.hardwareMonitor.getHardwareProfile();
        const totalMemoryGB = hardwareProfile.memory.total / (1024 * 1024 * 1024);
        const physicalCores = hardwareProfile.cpu.physicalCores;

        const config: SystemConfig = {
            hardware: {
                cpu: this.generateCPUConfig(physicalCores),
                memory: this.generateMemoryConfig(totalMemoryGB)
            },
            performance: this.generatePerformanceConfig(totalMemoryGB, physicalCores),
            optimization: this.generateOptimizationConfig()
        };

        this.currentConfig = config;
        return config;
    }

    private generateCPUConfig(physicalCores: number) {
        // Reserve some cores for system processes
        const reservedCores = Math.max(1, Math.floor(physicalCores * 0.1));
        const availableCores = physicalCores - reservedCores;

        return {
            cores: physicalCores,
            recommendedThreads: Math.max(1, Math.floor(availableCores * 0.75)),
            minThreads: Math.max(1, Math.floor(availableCores * 0.25)),
            maxThreads: availableCores,
            cpuTarget: 70 // 70% target CPU usage
        };
    }

    private generateMemoryConfig(totalMemoryGB: number) {
        // Reserve memory for system and other processes
        const reservedMemoryGB = Math.max(1, totalMemoryGB * 0.2);
        const availableMemoryGB = totalMemoryGB - reservedMemoryGB;

        // Calculate pool sizes based on available memory
        const poolSizes = {
            vector: {
                initial: Math.floor(availableMemoryGB * 0.1 * 1024 * 1024 * 1024),
                max: Math.floor(availableMemoryGB * 0.2 * 1024 * 1024 * 1024)
            },
            trajectory: {
                initial: Math.floor(availableMemoryGB * 0.2 * 1024 * 1024 * 1024),
                max: Math.floor(availableMemoryGB * 0.4 * 1024 * 1024 * 1024)
            },
            state: {
                initial: Math.floor(availableMemoryGB * 0.05 * 1024 * 1024 * 1024),
                max: Math.floor(availableMemoryGB * 0.1 * 1024 * 1024 * 1024)
            }
        };

        return {
            total: totalMemoryGB * 1024 * 1024 * 1024,
            recommended: availableMemoryGB * 1024 * 1024 * 1024,
            poolSizes,
            gcThreshold: Math.floor(availableMemoryGB * 0.8 * 1024 * 1024 * 1024)
        };
    }

    private generatePerformanceConfig(totalMemoryGB: number, physicalCores: number) {
        // Calculate batch sizes based on available resources
        const maxBatchSize = Math.min(
            1000,
            Math.floor(totalMemoryGB * 100)
        );

        return {
            batchSize: {
                min: 10,
                max: maxBatchSize,
                recommended: Math.floor(maxBatchSize * 0.5)
            },
            caching: {
                maxSize: Math.floor(totalMemoryGB * 0.3 * 1024 * 1024 * 1024),
                cleanupInterval: 60000, // 1 minute
                maxAge: 3600000 // 1 hour
            },
            monitoring: {
                sampleInterval: 1000, // 1 second
                retentionPeriod: 3600, // 1 hour
                alertThresholds: {
                    cpu: 80,
                    memory: 85,
                    errorRate: 5,
                    responseTime: 100
                }
            }
        };
    }

    private generateOptimizationConfig() {
        const hardwareProfile = this.hardwareMonitor.getHardwareProfile();
        const totalMemoryGB = hardwareProfile.memory.total / (1024 * 1024 * 1024);

        return {
            vectorization: this.supportsVectorization(),
            parallelization: hardwareProfile.cpu.cores > 1,
            memoryPooling: totalMemoryGB >= 4,
            adaptiveScaling: true,
            preemptiveGC: totalMemoryGB >= 8
        };
    }

    private supportsVectorization(): boolean {
        // Check for CPU features that support vectorization
        // This is platform-specific and would need proper implementation
        return true; // Default to true for now
    }

    public validateConfig(config: SystemConfig): string[] {
        const warnings: string[] = [];
        const hardwareProfile = this.hardwareMonitor.getHardwareProfile();

        // CPU validation
        if (config.hardware.cpu.maxThreads > hardwareProfile.cpu.cores) {
            warnings.push('Maximum thread count exceeds available CPU cores');
        }

        // Memory validation
        const totalMemoryGB = hardwareProfile.memory.total / (1024 * 1024 * 1024);
        if (config.hardware.memory.recommended > hardwareProfile.memory.total) {
            warnings.push('Recommended memory exceeds available system memory');
        }

        // Pool size validation
        const totalPoolSize = Object.values(config.hardware.memory.poolSizes)
            .reduce((sum, pool) => sum + pool.max, 0);
        if (totalPoolSize > config.hardware.memory.recommended) {
            warnings.push('Total pool size exceeds recommended memory');
        }

        // Performance validation
        if (config.performance.batchSize.max > 1000) {
            warnings.push('Maximum batch size may be too large for efficient processing');
        }

        // Cache validation
        if (config.performance.caching.maxSize > config.hardware.memory.recommended * 0.5) {
            warnings.push('Cache size may be too large relative to available memory');
        }

        return warnings;
    }

    public getCurrentConfig(): SystemConfig | null {
        return this.currentConfig;
    }

    public generateConfigFile(): string {
        const config = this.generateConfig();
        const warnings = this.validateConfig(config);

        return `# System Configuration
# Generated: ${new Date().toISOString()}
# Hardware Profile:
# - CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)
# - Memory: ${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)}GB
# - Platform: ${os.platform()} ${os.arch()}

${warnings.length > 0 ? `# Warnings:
${warnings.map(w => `# - ${w}`).join('\n')}

` : ''}
hardware:
  cpu:
    cores: ${config.hardware.cpu.cores}
    recommendedThreads: ${config.hardware.cpu.recommendedThreads}
    minThreads: ${config.hardware.cpu.minThreads}
    maxThreads: ${config.hardware.cpu.maxThreads}
    cpuTarget: ${config.hardware.cpu.cpuTarget}

  memory:
    total: ${config.hardware.memory.total}
    recommended: ${config.hardware.memory.recommended}
    gcThreshold: ${config.hardware.memory.gcThreshold}
    
    poolSizes:
${Object.entries(config.hardware.memory.poolSizes)
    .map(([name, sizes]) => `      ${name}:
        initial: ${sizes.initial}
        max: ${sizes.max}`).join('\n')}

performance:
  batchSize:
    min: ${config.performance.batchSize.min}
    max: ${config.performance.batchSize.max}
    recommended: ${config.performance.batchSize.recommended}

  caching:
    maxSize: ${config.performance.caching.maxSize}
    cleanupInterval: ${config.performance.caching.cleanupInterval}
    maxAge: ${config.performance.caching.maxAge}

  monitoring:
    sampleInterval: ${config.performance.monitoring.sampleInterval}
    retentionPeriod: ${config.performance.monitoring.retentionPeriod}
    alertThresholds:
      cpu: ${config.performance.monitoring.alertThresholds.cpu}
      memory: ${config.performance.monitoring.alertThresholds.memory}
      errorRate: ${config.performance.monitoring.alertThresholds.errorRate}
      responseTime: ${config.performance.monitoring.alertThresholds.responseTime}

optimization:
  vectorization: ${config.optimization.vectorization}
  parallelization: ${config.optimization.parallelization}
  memoryPooling: ${config.optimization.memoryPooling}
  adaptiveScaling: ${config.optimization.adaptiveScaling}
  preemptiveGC: ${config.optimization.preemptiveGC}
`;
    }
}
