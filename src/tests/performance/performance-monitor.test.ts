import { PerformanceMonitor } from '../../core/performance-monitor';

describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
        monitor = PerformanceMonitor.getInstance();
        monitor.resetAccumulators();
    });

    it('should track compute operations', async () => {
        const operation = async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
        };

        const time = await monitor.trackComputeOperation(operation);
        expect(time).toBeGreaterThanOrEqual(100);

        const metrics = await monitor.getDetailedMetrics();
        expect(metrics.computeTime).toBeGreaterThanOrEqual(100);
    });

    it('should track transfer operations', async () => {
        const operation = async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
        };

        const time = await monitor.trackTransferOperation(operation);
        expect(time).toBeGreaterThanOrEqual(100);

        const metrics = await monitor.getDetailedMetrics();
        expect(metrics.transferTime).toBeGreaterThanOrEqual(100);
    });

    it('should reset accumulators', async () => {
        const operation = async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
        };

        await monitor.trackComputeOperation(operation);
        await monitor.trackTransferOperation(operation);

        let metrics = await monitor.getDetailedMetrics();
        expect(metrics.computeTime).toBeGreaterThan(0);
        expect(metrics.transferTime).toBeGreaterThan(0);

        monitor.resetAccumulators();
        metrics = await monitor.getDetailedMetrics();
        expect(metrics.computeTime).toBe(0);
        expect(metrics.transferTime).toBe(0);
    });

    it('should get detailed metrics', async () => {
        const metrics = await monitor.getDetailedMetrics();
        
        expect(metrics).toHaveProperty('memoryUsage');
        expect(metrics.memoryUsage).toHaveProperty('numTensors');
        expect(metrics.memoryUsage).toHaveProperty('numBytes');
        expect(metrics.memoryUsage).toHaveProperty('unreliable');
        
        expect(metrics).toHaveProperty('computeTime');
        expect(metrics).toHaveProperty('transferTime');
        expect(metrics).toHaveProperty('gpuUtilization');
        
        expect(typeof metrics.computeTime).toBe('number');
        expect(typeof metrics.transferTime).toBe('number');
        expect(typeof metrics.gpuUtilization).toBe('number');
    });
});
