import * as tf from '@tensorflow/tfjs-node-gpu';
import { GPUCompute } from './gpu-compute';
import { HardwareMonitor } from '../hardware/hardware-monitor';

interface Device {
    id: string;
    name: string;
    type: 'gpu' | 'cpu';
    capabilities: {
        computeCapability?: string;
        memorySize: number;
        cores?: number;
        clockSpeed?: number;
    };
    status: 'available' | 'busy' | 'error';
    load: number;
    temperature?: number;
}

interface DevicePreference {
    preferGPU?: boolean;
    minMemory?: number;
    minComputeCapability?: string;
    maxLoad?: number;
    maxTemperature?: number;
}

export class DeviceManager {
    private static instance: DeviceManager;
    private readonly gpuCompute: GPUCompute;
    private readonly hardwareMonitor: HardwareMonitor;
    private devices: Map<string, Device> = new Map();
    private activeDevice: Device | null = null;
    private fallbackEnabled: boolean = true;

    private constructor() {
        this.gpuCompute = GPUCompute.getInstance();
        this.hardwareMonitor = HardwareMonitor.getInstance();
        this.initialize();
    }

    public static getInstance(): DeviceManager {
        if (!DeviceManager.instance) {
            DeviceManager.instance = new DeviceManager();
        }
        return DeviceManager.instance;
    }

    private async initialize(): Promise<void> {
        try {
            // Detect available devices
            await this.detectDevices();

            // Start monitoring
            this.startMonitoring();

            // Set default device
            await this.setDefaultDevice();
        } catch (error) {
            console.error('Device manager initialization failed:', error);
            this.enableFallback();
        }
    }

    private async detectDevices(): Promise<void> {
        // Detect GPUs
        const gpuInfo = await this.gpuCompute.getGPUStatus();
        if (gpuInfo.isAvailable && gpuInfo.info) {
            this.devices.set('gpu', {
                id: 'gpu',
                name: gpuInfo.info.name,
                type: 'gpu',
                capabilities: {
                    computeCapability: gpuInfo.info.computeCapability,
                    memorySize: gpuInfo.info.memorySize
                },
                status: 'available',
                load: 0
            });
        }

        // Detect CPU
        const cpuInfo = this.hardwareMonitor.getHardwareProfile().cpu;
        this.devices.set('cpu', {
            id: 'cpu',
            name: `CPU (${cpuInfo.cores} cores)`,
            type: 'cpu',
            capabilities: {
                cores: cpuInfo.cores,
                memorySize: this.hardwareMonitor.getHardwareProfile().memory.total,
                clockSpeed: cpuInfo.speed
            },
            status: 'available',
            load: 0
        });
    }

    private startMonitoring(): void {
        setInterval(async () => {
            for (const [id, device] of this.devices) {
                try {
                    // Update device status
                    if (device.type === 'gpu') {
                        const gpuStatus = await this.gpuCompute.getGPUStatus();
                        device.status = gpuStatus.isAvailable ? 'available' : 'error';
                        device.load = await this.getGPULoad();
                        device.temperature = await this.getGPUTemperature();
                    } else {
                        const cpuStatus = await this.hardwareMonitor.getResourceSnapshot();
                        device.load = cpuStatus.cpu.usage;
                        device.status = 'available';
                    }

                    // Check for problems
                    if (device.load > 90 || (device.temperature && device.temperature > 80)) {
                        device.status = 'busy';
                    }

                    // Update active device if needed
                    if (device === this.activeDevice && device.status !== 'available') {
                        await this.failover();
                    }
                } catch (error) {
                    console.error(`Error monitoring device ${id}:`, error);
                    device.status = 'error';
                    if (device === this.activeDevice) {
                        await this.failover();
                    }
                }
            }
        }, 1000); // Check every second
    }

    private async getGPULoad(): Promise<number> {
        // This would need to be implemented using platform-specific APIs
        return 0;
    }

    private async getGPUTemperature(): Promise<number | undefined> {
        // This would need to be implemented using platform-specific APIs
        return undefined;
    }

    public async selectDevice(preferences: DevicePreference = {}): Promise<Device | null> {
        const availableDevices = Array.from(this.devices.values())
            .filter(device => device.status === 'available')
            .filter(device => {
                if (preferences.preferGPU && device.type !== 'gpu') return false;
                if (preferences.minMemory && device.capabilities.memorySize < preferences.minMemory) return false;
                if (preferences.maxLoad && device.load > preferences.maxLoad) return false;
                if (preferences.maxTemperature && device.temperature && device.temperature > preferences.maxTemperature) return false;
                if (preferences.minComputeCapability && device.type === 'gpu') {
                    if (!this.meetsComputeCapability(device.capabilities.computeCapability, preferences.minComputeCapability)) {
                        return false;
                    }
                }
                return true;
            });

        // Sort by preference
        availableDevices.sort((a, b) => {
            // Prefer GPU if specified
            if (preferences.preferGPU) {
                if (a.type === 'gpu' && b.type !== 'gpu') return -1;
                if (a.type !== 'gpu' && b.type === 'gpu') return 1;
            }

            // Sort by load
            return a.load - b.load;
        });

        const selectedDevice = availableDevices[0] || null;
        if (selectedDevice) {
            await this.activateDevice(selectedDevice);
        }

        return selectedDevice;
    }

    private async activateDevice(device: Device): Promise<void> {
        if (device === this.activeDevice) return;

        try {
            if (device.type === 'gpu') {
                await tf.setBackend('webgl');
            } else {
                await tf.setBackend('cpu');
            }
            this.activeDevice = device;
        } catch (error) {
            console.error(`Failed to activate device ${device.id}:`, error);
            throw error;
        }
    }

    private async setDefaultDevice(): Promise<void> {
        // Try GPU first
        const gpuDevice = this.devices.get('gpu');
        if (gpuDevice && gpuDevice.status === 'available') {
            await this.activateDevice(gpuDevice);
            return;
        }

        // Fall back to CPU
        const cpuDevice = this.devices.get('cpu');
        if (cpuDevice && cpuDevice.status === 'available') {
            await this.activateDevice(cpuDevice);
            return;
        }

        throw new Error('No available compute devices');
    }

    private async failover(): Promise<void> {
        if (!this.fallbackEnabled) return;

        console.warn('Device failover triggered');

        // Try to select a new device
        const newDevice = await this.selectDevice({
            maxLoad: 70,
            maxTemperature: 75
        });

        if (!newDevice) {
            console.error('No failover devices available');
            this.enableFallback();
        }
    }

    private enableFallback(): void {
        // Switch to CPU-only mode
        this.fallbackEnabled = false;
        const cpuDevice = this.devices.get('cpu');
        if (cpuDevice) {
            this.activateDevice(cpuDevice).catch(console.error);
        }
    }

    private meetsComputeCapability(current: string | undefined, required: string): boolean {
        if (!current) return false;

        // Parse version numbers (e.g., "7.5" -> [7, 5])
        const currentParts = current.split('.').map(Number);
        const requiredParts = required.split('.').map(Number);

        // Compare major version
        if (currentParts[0] !== requiredParts[0]) {
            return currentParts[0] > requiredParts[0];
        }

        // Compare minor version
        return currentParts[1] >= requiredParts[1];
    }

    public getActiveDevice(): Device | null {
        return this.activeDevice;
    }

    public listDevices(): Device[] {
        return Array.from(this.devices.values());
    }

    public isFallbackMode(): boolean {
        return !this.fallbackEnabled;
    }

    public async cleanup(): Promise<void> {
        // Stop monitoring
        this.devices.clear();
        this.activeDevice = null;
    }
}
