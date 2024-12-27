import { PerformanceLogger } from '../../core/performance-logger';
import { PerformanceMetrics } from '../../core/performance-monitor';

describe('PerformanceLogger', () => {
    let logger: PerformanceLogger;

    beforeEach(() => {
        logger = PerformanceLogger.getInstance();
        logger.clearMetrics();
    });

    const createSampleMetrics = (override: Partial<PerformanceMetrics> = {}): PerformanceMetrics => ({
        memoryUsage: {
            numTensors: 100,
            numBytes: 1024,
            unreliable: false,
            ...override.memoryUsage
        },
        computeTime: 50,
        transferTime: 30,
        gpuUtilization: 0.75,
        ...override
    });

    it('should maintain singleton instance', () => {
        const instance1 = PerformanceLogger.getInstance();
        const instance2 = PerformanceLogger.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('should log metrics and maintain size limit', () => {
        for (let i = 0; i < 1100; i++) {
            logger.logMetrics(createSampleMetrics());
        }
        expect(logger.getMetricsCount()).toBe(1000);
    });

    it('should calculate correct averages', () => {
        const metrics1 = createSampleMetrics();
        const metrics2 = createSampleMetrics({
            memoryUsage: { numTensors: 200, numBytes: 2048, unreliable: false },
            computeTime: 100,
            transferTime: 60,
            gpuUtilization: 0.85
        });

        logger.logMetrics(metrics1);
        logger.logMetrics(metrics2);

        const averages = logger.getAverages();
        expect(averages.memoryUsage.numTensors).toBe(150); // (100 + 200) / 2
        expect(averages.memoryUsage.numBytes).toBe(1536); // (1024 + 2048) / 2
        expect(averages.computeTime).toBe(75); // (50 + 100) / 2
        expect(averages.transferTime).toBe(45); // (30 + 60) / 2
        expect(averages.gpuUtilization).toBe(0.8); // (0.75 + 0.85) / 2
    });

    it('should handle unreliable memory flags correctly', () => {
        logger.logMetrics(createSampleMetrics());
        logger.logMetrics(createSampleMetrics({
            memoryUsage: { numTensors: 200, numBytes: 2048, unreliable: true }
        }));

        const averages = logger.getAverages();
        expect(averages.memoryUsage.unreliable).toBe(true);
    });

    it('should throw error when getting averages with no metrics', () => {
        expect(() => logger.getAverages()).toThrow('No metrics available for averaging');
    });

    it('should get recent metrics', () => {
        const metrics = Array(5).fill(null).map((_, i) => 
            createSampleMetrics({ computeTime: i * 10 })
        );
        
        metrics.forEach(m => logger.logMetrics(m));
        
        const recent = logger.getRecentMetrics(3);
        expect(recent.length).toBe(3);
        expect(recent[2].computeTime).toBe(40);
        expect(recent[1].computeTime).toBe(30);
        expect(recent[0].computeTime).toBe(20);
    });
});
