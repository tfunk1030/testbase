import { MemoryUsage } from '../../types';

export interface CacheEntry<T> {
    key: string;
    data: T;
    metadata: CacheMetadata;
    timestamp: number;
    expiresAt?: number;
}

export interface CacheMetadata {
    key: string;
    size: number;
    lastAccess: number;
    accessCount: number;
    hitRate: number;
    costBenefit: number;
    version: string;
    createdAt: number;
    lastModified: number;
    ttl?: number;
    tags?: string[];
    priority?: number;
    checksum?: string;
}

export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    entryCount: number;
    averageAccessTime: number;
}

export interface VersionInfo {
    version: string;
    timestamp: number;
    checksum: string;
    metadata?: Record<string, any>;
}

export interface StorageMetrics {
    totalSize: number;
    usedSize: number;
    entryCount: number;
    fragmentation: number;
    lastCompaction: number;
}

export interface IntegrityReport {
    timestamp: number;
    status: 'healthy' | 'warning' | 'error';
    errors: string[];
    warnings: string[];
    metrics: {
        corruptEntries: number;
        missingEntries: number;
        inconsistentEntries: number;
        totalChecked: number;
    };
}

export interface CacheError extends Error {
    code: string;
    details?: Record<string, any>;
}

export interface MemorySnapshot {
    timestamp: number;
    used: number;
    free: number;
    total: number;
    heapUsage: number;
    gcMetrics: {
        collections: number;
        pauseTime: number;
    };
}

export interface ResourceUsage {
    timestamp: number;
    memory: MemorySnapshot;
    cpu: {
        usage: number;
        temperature?: number;
        loadAverage: number[];
        threadUtilization: number;
    };
    disk: {
        used: number;
        free: number;
        total: number;
        readSpeed: number;
        writeSpeed: number;
    };
    network: {
        bytesIn: number;
        bytesOut: number;
        connections: number;
        latency: number;
    };
}

export interface CacheRecommendation {
    type: 'evict' | 'preload' | 'resize';
    keys?: string[];
    reason: string;
    priority: number;
    impact: {
        memory: number;
        performance: number;
    };
}

export interface DataIntegrity {
    checksum: string;
    version: number;
    lastVerified: number;
    verifyIntegrity: (data: any) => boolean;
    calculateChecksum(data: unknown): Promise<string>;
    validateChecksum(data: unknown, checksum: string): Promise<boolean>;
}

export interface PoolConfig {
    name: string;
    initialSize: number;
    maxSize: number;
    itemSize: number;
    growthFactor: number;
}
