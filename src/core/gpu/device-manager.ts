import * as tf from '@tensorflow/tfjs';
import { DeviceError } from './gpu-compute';

export interface DevicePreference {
    preferGPU?: boolean;
    minMemory?: number;  // In bytes
    maxLoad?: number;    // 0-1 range
}

export interface DeviceInfo {
    type: string;
    memory: {
        total: number;
        free: number;
    };
    load: number;
}

export class DeviceManager {
    private static instance: DeviceManager;
    private currentDevice: string | null = null;

    private constructor() {}

    public static getInstance(): DeviceManager {
        if (!DeviceManager.instance) {
            DeviceManager.instance = new DeviceManager();
        }
        return DeviceManager.instance;
    }

    public async getDeviceInfo(): Promise<DeviceInfo> {
        const backend = tf.getBackend();
        if (backend === 'webgl') {
            const gl = (tf as any).backend().gl;
            if (!gl) {
                throw new DeviceError('WebGL context not available');
            }

            // Get GPU memory info if available
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
            const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';

            // Estimate available memory (this is approximate)
            const totalMemory = gl.getParameter(gl.MAX_TEXTURE_SIZE) ** 2 * 4; // Rough estimate in bytes
            const usedMemory = tf.memory().numBytes;
            
            return {
                type: `WebGL (${vendor} - ${renderer})`,
                memory: {
                    total: totalMemory,
                    free: totalMemory - usedMemory
                },
                load: usedMemory / totalMemory
            };
        } else {
            // CPU info
            const totalMemory = process.memoryUsage().heapTotal;
            const usedMemory = process.memoryUsage().heapUsed;
            
            return {
                type: 'CPU',
                memory: {
                    total: totalMemory,
                    free: totalMemory - usedMemory
                },
                load: usedMemory / totalMemory
            };
        }
    }

    public async selectDevice(preferences: DevicePreference = {}): Promise<void> {
        try {
            if (preferences.preferGPU) {
                try {
                    // Try WebGL backend
                    await tf.setBackend('webgl');
                    await tf.ready();
                    
                    // Configure WebGL
                    tf.env().set('WEBGL_CPU_FORWARD', false);
                    tf.env().set('WEBGL_PACK', true);
                    
                    // Check if device meets requirements
                    const deviceInfo = await this.getDeviceInfo();
                    
                    if (preferences.minMemory && deviceInfo.memory.free < preferences.minMemory) {
                        throw new DeviceError(`Insufficient GPU memory: ${deviceInfo.memory.free} bytes available, ${preferences.minMemory} bytes required`);
                    }
                    
                    if (preferences.maxLoad && deviceInfo.load > preferences.maxLoad) {
                        throw new DeviceError(`GPU load too high: ${deviceInfo.load * 100}%, maximum ${preferences.maxLoad * 100}% allowed`);
                    }
                    
                    this.currentDevice = 'webgl';
                    console.info(`Selected GPU device: ${deviceInfo.type}`);
                    
                } catch (error) {
                    console.warn('WebGL backend initialization failed, falling back to CPU', error);
                    await this.fallbackToCPU();
                }
            } else {
                await this.fallbackToCPU();
            }
        } catch (error) {
            throw new DeviceError(`Failed to initialize device: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async fallbackToCPU(): Promise<void> {
        await tf.setBackend('cpu');
        await tf.ready();
        this.currentDevice = 'cpu';
        const deviceInfo = await this.getDeviceInfo();
        console.info(`Selected CPU device with ${Math.round(deviceInfo.memory.free / 1024 / 1024)}MB available memory`);
    }

    public getActiveDevice(): string {
        if (!this.currentDevice) {
            throw new DeviceError('No active device selected');
        }
        return this.currentDevice;
    }

    public async cleanup(): Promise<void> {
        await tf.dispose();
    }

    public async resetDevice(): Promise<void> {
        console.info('Resetting device...');
        
        try {
            // Clean up current device
            await this.cleanup();
            
            // Reset TensorFlow backend
            tf.engine().reset();
            
            // Reinitialize with current device preference
            await this.selectDevice({ preferGPU: this.currentDevice === 'webgl' });
            
            // Verify device is ready
            await tf.ready();
            const deviceInfo = await this.getDeviceInfo();
            console.info(`Device reset complete. Using ${deviceInfo.type} with ${Math.round(deviceInfo.memory.free / 1024 / 1024)}MB available memory`);
            
        } catch (error) {
            const message = `Failed to reset device: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(message);
            throw new DeviceError(message);
        }
    }
}
