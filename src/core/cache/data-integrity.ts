import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { MemoryUsage } from '../../types';
import { 
    CacheError, 
    CacheEntry, 
    IntegrityReport, 
    VersionInfo 
} from './types';

export class DataIntegrity extends EventEmitter {
    private static instance: DataIntegrity;
    private checkInterval: NodeJS.Timeout | null;
    private lastCheck: number;
    private errors: Map<string, CacheError>;

    private constructor() {
        super();
        this.lastCheck = Date.now();
        this.checkInterval = null;
        this.errors = new Map();
    }

    public static getInstance(): DataIntegrity {
        if (!DataIntegrity.instance) {
            DataIntegrity.instance = new DataIntegrity();
        }
        return DataIntegrity.instance;
    }

    public startIntegrityChecks(intervalMs: number = 300000): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(() => {
            this.performIntegrityCheck()
                .catch(error => {
                    this.emit('error', {
                        code: 'INTEGRITY_CHECK_FAILED',
                        message: 'Failed to perform integrity check',
                        details: error
                    });
                });
        }, intervalMs);
    }

    public stopIntegrityChecks(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    public async checkEntryIntegrity<T>(entry: CacheEntry<T>): Promise<boolean> {
        try {
            // Verify entry structure
            if (!this.validateEntryStructure(entry)) {
                throw new Error('Invalid entry structure');
            }

            // Verify data consistency
            const calculatedSize = this.calculateEntrySize(entry);
            if (calculatedSize !== entry.size) {
                throw new Error('Size mismatch');
            }

            // Check timestamp validity
            if (entry.timestamp > Date.now()) {
                throw new Error('Future timestamp');
            }

            // Check expiration
            if (entry.expiresAt && entry.expiresAt < Date.now()) {
                throw new Error('Entry expired');
            }

            return true;
        } catch (error) {
            const cacheError: CacheError = {
                name: 'CacheIntegrityError',
                message: error instanceof Error ? error.message : 'Unknown error',
                code: 'ENTRY_INTEGRITY_ERROR',
                details: { entry: entry.key }
            };
            this.errors.set(entry.key, cacheError);
            return false;
        }
    }

    public async performIntegrityCheck(): Promise<IntegrityReport> {
        const startTime = Date.now();
        const report: IntegrityReport = {
            timestamp: startTime,
            status: 'healthy',
            errors: [],
            warnings: [],
            metrics: {
                corruptEntries: 0,
                missingEntries: 0,
                inconsistentEntries: 0,
                totalChecked: 0
            }
        };

        try {
            // Record memory usage
            const memUsage = process.memoryUsage();
            this.emit('memoryUsage', {
                timestamp: Date.now(),
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                gc: []
            });

            this.lastCheck = startTime;
            this.emit('integrityCheckComplete', report);
            return report;
        } catch (repairError) {
            report.status = 'error';
            report.errors.push('Failed to repair corrupted entries');
            this.emit('integrityCheckFailed', report);
            return report;
        }
    }

    public async repairCorruptedEntry<T>(entry: CacheEntry<T>): Promise<CacheEntry<T> | null> {
        try {
            // Basic repair attempts
            const repairedEntry: CacheEntry<T> = {
                ...entry,
                timestamp: entry.timestamp || Date.now(),
                size: this.calculateEntrySize(entry)
            };

            // Verify the repaired entry
            if (await this.checkEntryIntegrity(repairedEntry)) {
                return repairedEntry;
            }

            return null;
        } catch (error) {
            this.emit('error', {
                code: 'REPAIR_FAILED',
                message: 'Failed to repair corrupted entry',
                details: { error, entry: entry.key }
            });
            return null;
        }
    }

    private validateEntryStructure<T>(entry: CacheEntry<T>): boolean {
        return (
            typeof entry.key === 'string' &&
            entry.value !== undefined &&
            typeof entry.timestamp === 'number' &&
            typeof entry.size === 'number' &&
            (!entry.expiresAt || typeof entry.expiresAt === 'number')
        );
    }

    private calculateEntrySize<T>(entry: CacheEntry<T>): number {
        const serialized = JSON.stringify(entry.value);
        return Buffer.byteLength(serialized, 'utf8');
    }

    public generateVersionInfo(data: Buffer, info: Partial<VersionInfo> = {}): VersionInfo {
        return {
            version: info.version || '1.0',
            timestamp: Date.now(),
            checksum: this.calculateChecksum(data),
            metadata: info.metadata
        };
    }

    private calculateChecksum(data: Buffer): string {
        return createHash('sha256').update(data).digest('hex');
    }

    public getLastCheckTime(): number {
        return this.lastCheck;
    }

    public getErrors(): Map<string, CacheError> {
        return new Map(this.errors);
    }

    public clearErrors(): void {
        this.errors.clear();
    }
}
