import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { 
    CacheEntry, 
    StorageMetrics, 
    VersionInfo,
    CacheError 
} from './types';

interface DiskStorageConfig {
    basePath: string;
    maxSize?: number;
    compactionThreshold?: number;
    syncWrites?: boolean;
}

export class DiskStorage extends EventEmitter {
    private readonly config: Required<DiskStorageConfig>;
    private readonly dataPath: string;
    private readonly metaPath: string;
    private currentSize: number;
    private entryCount: number;

    constructor(config: DiskStorageConfig) {
        super();
        this.config = {
            maxSize: config.maxSize || 1024 * 1024 * 1024, // 1GB default
            compactionThreshold: config.compactionThreshold || 0.7,
            syncWrites: config.syncWrites ?? true,
            basePath: config.basePath
        };

        this.dataPath = path.join(this.config.basePath, 'data');
        this.metaPath = path.join(this.config.basePath, 'meta');
        this.currentSize = 0;
        this.entryCount = 0;

        this.initialize().catch(error => {
            this.emit('error', {
                code: 'STORAGE_INIT_ERROR',
                message: 'Failed to initialize storage',
                details: error
            });
        });
    }

    private async initialize(): Promise<void> {
        await Promise.all([
            fs.mkdir(this.dataPath, { recursive: true }),
            fs.mkdir(this.metaPath, { recursive: true })
        ]);

        await this.loadMetrics();
    }

    private async loadMetrics(): Promise<void> {
        try {
            const files = await fs.readdir(this.dataPath);
            let totalSize = 0;
            
            for (const file of files) {
                const stats = await fs.stat(path.join(this.dataPath, file));
                totalSize += stats.size;
            }

            this.currentSize = totalSize;
            this.entryCount = files.length;

            this.emit('metricsUpdated', await this.getMetrics());
        } catch (error) {
            this.emit('error', {
                code: 'METRICS_LOAD_ERROR',
                message: 'Failed to load storage metrics',
                details: error
            });
        }
    }

    public async store<T>(entry: CacheEntry<T>): Promise<void> {
        const dataFile = path.join(this.dataPath, entry.key);
        const metaFile = path.join(this.metaPath, `${entry.key}.meta`);

        try {
            const serializedData = JSON.stringify(entry.value);
            const serializedMeta = JSON.stringify({
                timestamp: entry.timestamp,
                expiresAt: entry.expiresAt,
                size: entry.size,
                metadata: entry.metadata
            });

            if (this.config.syncWrites) {
                await Promise.all([
                    fs.writeFile(dataFile, serializedData, 'utf8'),
                    fs.writeFile(metaFile, serializedMeta, 'utf8')
                ]);
            } else {
                fs.writeFile(dataFile, serializedData, 'utf8').catch(error => 
                    this.emit('error', {
                        code: 'ASYNC_WRITE_ERROR',
                        message: 'Failed to write data file',
                        details: error
                    })
                );
                fs.writeFile(metaFile, serializedMeta, 'utf8').catch(error =>
                    this.emit('error', {
                        code: 'ASYNC_WRITE_ERROR',
                        message: 'Failed to write meta file',
                        details: error
                    })
                );
            }

            this.currentSize += entry.size;
            this.entryCount++;

            this.emit('stored', entry.key);
            this.checkCompaction();
        } catch (error) {
            throw {
                name: 'CacheError',
                message: 'Failed to store entry',
                code: 'STORE_ERROR',
                details: { error, key: entry.key }
            } as CacheError;
        }
    }

    public async retrieve<T>(key: string): Promise<CacheEntry<T>> {
        const dataFile = path.join(this.dataPath, key);
        const metaFile = path.join(this.metaPath, `${key}.meta`);

        try {
            const [dataContent, metaContent] = await Promise.all([
                fs.readFile(dataFile, 'utf8'),
                fs.readFile(metaFile, 'utf8')
            ]);

            const value = JSON.parse(dataContent) as T;
            const meta = JSON.parse(metaContent);

            const entry: CacheEntry<T> = {
                key,
                value,
                timestamp: meta.timestamp,
                expiresAt: meta.expiresAt,
                size: meta.size,
                metadata: meta.metadata
            };

            this.emit('retrieved', key);
            return entry;
        } catch (error) {
            throw {
                name: 'CacheError',
                message: 'Failed to retrieve entry',
                code: 'RETRIEVE_ERROR',
                details: { error, key }
            } as CacheError;
        }
    }

    public async delete(key: string): Promise<void> {
        const dataFile = path.join(this.dataPath, key);
        const metaFile = path.join(this.metaPath, `${key}.meta`);

        try {
            const stats = await fs.stat(dataFile);
            await Promise.all([
                fs.unlink(dataFile),
                fs.unlink(metaFile)
            ]);

            this.currentSize -= stats.size;
            this.entryCount--;

            this.emit('deleted', key);
        } catch (error) {
            throw {
                name: 'CacheError',
                message: 'Failed to delete entry',
                code: 'DELETE_ERROR',
                details: { error, key }
            } as CacheError;
        }
    }

    public async clear(): Promise<void> {
        try {
            const files = await fs.readdir(this.dataPath);
            const metaFiles = await fs.readdir(this.metaPath);

            await Promise.all([
                ...files.map(file => fs.unlink(path.join(this.dataPath, file))),
                ...metaFiles.map(file => fs.unlink(path.join(this.metaPath, file)))
            ]);

            this.currentSize = 0;
            this.entryCount = 0;

            this.emit('cleared');
        } catch (error) {
            throw {
                name: 'CacheError',
                message: 'Failed to clear storage',
                code: 'CLEAR_ERROR',
                details: error
            } as CacheError;
        }
    }

    private async checkCompaction(): Promise<void> {
        const usageRatio = this.currentSize / this.config.maxSize;
        if (usageRatio >= this.config.compactionThreshold) {
            await this.compact();
        }
    }

    private async compact(): Promise<void> {
        try {
            const files = await fs.readdir(this.dataPath);
            const entries = await Promise.all(
                files.map(async file => {
                    const metaFile = path.join(this.metaPath, `${file}.meta`);
                    try {
                        const meta = JSON.parse(
                            await fs.readFile(metaFile, 'utf8')
                        );
                        return {
                            key: file,
                            expiresAt: meta.expiresAt,
                            timestamp: meta.timestamp,
                            size: meta.size
                        };
                    } catch {
                        return null;
                    }
                })
            );

            // Remove expired entries
            const now = Date.now();
            const expiredEntries = entries
                .filter(entry => entry && entry.expiresAt && entry.expiresAt < now)
                .map(entry => entry!.key);

            if (expiredEntries.length > 0) {
                await Promise.all(
                    expiredEntries.map(key => this.delete(key))
                );
            }

            this.emit('compacted', {
                entriesRemoved: expiredEntries.length,
                spaceFreed: expiredEntries.reduce((total, key) => {
                    const entry = entries.find(e => e && e.key === key);
                    return total + (entry ? entry.size : 0);
                }, 0)
            });
        } catch (error) {
            this.emit('error', {
                code: 'COMPACTION_ERROR',
                message: 'Failed to compact storage',
                details: error
            });
        }
    }

    public async getMetrics(): Promise<StorageMetrics> {
        const fragmentation = await this.calculateFragmentation();
        return {
            totalSize: this.config.maxSize,
            usedSize: this.currentSize,
            entryCount: this.entryCount,
            fragmentation,
            lastCompaction: Date.now()
        };
    }

    private async calculateFragmentation(): Promise<number> {
        try {
            const files = await fs.readdir(this.dataPath);
            let totalFileSize = 0;
            let totalAllocatedSize = 0;

            for (const file of files) {
                const stats = await fs.stat(path.join(this.dataPath, file));
                totalFileSize += stats.size;
                totalAllocatedSize += Math.ceil(stats.size / 4096) * 4096; // Assuming 4KB blocks
            }

            return totalAllocatedSize > 0 
                ? (totalAllocatedSize - totalFileSize) / totalAllocatedSize 
                : 0;
        } catch {
            return 0;
        }
    }
}
