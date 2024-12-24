import express, { Request, Response } from 'express';
import { WebSocket } from 'ws';
import { RealTimeMonitor } from '../core/real-time-monitor';
import { PerformanceVisualizer } from '../core/performance-visualizer';
import * as path from 'path';

const router = express.Router();
const monitor = RealTimeMonitor.getInstance();
const visualizer = PerformanceVisualizer.getInstance();

// Get current performance metrics
router.get('/metrics', (req: Request, res: Response) => {
    const seconds = parseInt(req.query.seconds as string) || 60;
    const metrics = monitor.getAggregateMetrics(seconds);
    res.json(metrics);
});

// Get recent performance snapshots
router.get('/snapshots', (req: Request, res: Response) => {
    const seconds = parseInt(req.query.seconds as string) || 60;
    const snapshots = monitor.getRecentSnapshots(seconds);
    res.json(snapshots);
});

// Generate and get performance report
router.post('/report', async (req: Request, res: Response) => {
    try {
        const reportsDir = path.join(__dirname, '../../reports/performance');
        await visualizer.generatePerformanceReport(reportsDir);
        res.json({ success: true, message: 'Performance report generated successfully' });
    } catch (error) {
        console.error('Error generating performance report:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating performance report',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// WebSocket endpoint for real-time metrics
router.ws('/realtime', (ws: WebSocket) => {
    const sendMetrics = () => {
        if (ws.readyState === WebSocket.OPEN) {
            const metrics = monitor.getAggregateMetrics(60);
            ws.send(JSON.stringify(metrics));
        }
    };

    // Send initial metrics
    sendMetrics();

    // Subscribe to real-time updates
    const updateInterval = setInterval(sendMetrics, 1000);

    // Subscribe to alerts
    const alertHandler = (alert: any) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'alert', data: alert }));
        }
    };
    monitor.on('alert', alertHandler);

    // Cleanup on connection close
    ws.on('close', () => {
        clearInterval(updateInterval);
        monitor.off('alert', alertHandler);
    });
});

export default router;
