import * as fs from 'fs/promises';
import * as path from 'path';
import { DiskStorage } from './disk-storage';
import { CacheEntry, CacheMetadata } from './types';

interface VersionConfig {
    maxVersions?: number;
    retentionPeriod?: number;
    diffStorage?: boolean;
    compressionLevel?: number;
}

interface VersionInfo {
    version: number;
    timestamp: number;
    author?: string;
    comment?: string;
    checksum: string;
    size: number;
    metadata: CacheMetadata;
}

export class VersionControl {
    private static instance: VersionControl;
    private readonly storage: DiskStorage;
    private readonly config: Required<VersionConfig>;

    private constructor(storage: DiskStorage, config: VersionConfig = {}) {
        this.storage = storage;
        this.config = {
            maxVersions: config.maxVersions || 10,
            retentionPeriod: config.retentionPeriod || 30 * 24 * 60 * 60 * 1000, // 30 days
            diffStorage: config.diffStorage ?? true,
            compressionLevel: config.compressionLevel || 6
        };
    }

    public static getInstance(storage: DiskStorage, config?: VersionConfig): VersionControl {
        if (!VersionControl.instance) {
            VersionControl.instance = new VersionControl(storage, config);
        }
        return VersionControl.instance;
    }

    public async createVersion(
        key: string,
        data: Buffer,
        metadata: CacheMetadata,
        comment?: string
    ): Promise<VersionInfo> {
        const versionPath = this.getVersionPath(key);
        await fs.mkdir(versionPath, { recursive: true });

        // Get current version number
        const currentVersion = await this.getCurrentVersion(key);
        const newVersion = currentVersion + 1;

        // Create version info
        const versionInfo: VersionInfo = {
            version: newVersion,
            timestamp: Date.now(),
            comment,
            checksum: this.calculateChecksum(data),
            size: data.length,
            metadata: {
                ...metadata,
                version: newVersion
            }
        };

        // Store version data
        if (this.config.diffStorage && currentVersion > 0) {
            await this.storeDiff(key, data, currentVersion);
        } else {
            await this.storeFullVersion(key, data, newVersion);
        }

        // Store version info
        await this.storeVersionInfo(key, versionInfo);

        // Cleanup old versions
        await this.cleanupOldVersions(key);

        return versionInfo;
    }

    public async getVersion(
        key: string,
        version?: number
    ): Promise<{ data: Buffer; info: VersionInfo }> {
        const targetVersion = version || await this.getCurrentVersion(key);
        const versionPath = this.getVersionPath(key);

        // Get version info
        const info = await this.getVersionInfo(key, targetVersion);

        // Get version data
        let data: Buffer;
        if (this.config.diffStorage && targetVersion > 1) {
            data = await this.reconstructFromDiffs(key, targetVersion);
        } else {
            data = await this.getFullVersion(key, targetVersion);
        }

        // Verify checksum
        const checksum = this.calculateChecksum(data);
        if (checksum !== info.checksum) {
            throw new Error(`Version integrity check failed for ${key}@${targetVersion}`);
        }

        return { data, info };
    }

    public async listVersions(key: string): Promise<VersionInfo[]> {
        const versionPath = this.getVersionPath(key);
        const infoPath = path.join(versionPath, 'info');

        try {
            const files = await fs.readdir(infoPath);
            const versions = await Promise.all(
                files
                    .filter(f => f.endsWith('.json'))
                    .map(async f => {
                        const content = await fs.readFile(path.join(infoPath, f), 'utf8');
                        return JSON.parse(content) as VersionInfo;
                    })
            );

            return versions.sort((a, b) => b.version - a.version);
        } catch {
            return [];
        }
    }

    public async revertToVersion(key: string, version: number): Promise<void> {
        const { data, info } = await this.getVersion(key, version);
        await this.storage.store(key, data, info.metadata);
    }

    private async getCurrentVersion(key: string): Promise<number> {
        const versions = await this.listVersions(key);
        return versions.length > 0 ? versions[0].version : 0;
    }

    private async storeDiff(key: string, newData: Buffer, baseVersion: number): Promise<void> {
        const { data: baseData } = await this.getVersion(key, baseVersion);
        const diff = this.calculateDiff(baseData, newData);
        
        const diffPath = path.join(this.getVersionPath(key), 'diffs');
        await fs.mkdir(diffPath, { recursive: true });
        await fs.writeFile(
            path.join(diffPath, `${baseVersion + 1}.diff`),
            diff
        );
    }

    private async storeFullVersion(key: string, data: Buffer, version: number): Promise<void> {
        const versionPath = this.getVersionPath(key);
        await fs.writeFile(
            path.join(versionPath, `${version}.full`),
            data
        );
    }

    private async storeVersionInfo(key: string, info: VersionInfo): Promise<void> {
        const infoPath = path.join(this.getVersionPath(key), 'info');
        await fs.mkdir(infoPath, { recursive: true });
        await fs.writeFile(
            path.join(infoPath, `${info.version}.json`),
            JSON.stringify(info, null, 2)
        );
    }

    private async reconstructFromDiffs(key: string, targetVersion: number): Promise<Buffer> {
        // Find the nearest full version
        const versions = await this.listVersions(key);
        const fullVersion = versions.find(v => 
            v.version <= targetVersion && 
            fs.existsSync(path.join(this.getVersionPath(key), `${v.version}.full`))
        );

        if (!fullVersion) {
            throw new Error(`No full version found for ${key}@${targetVersion}`);
        }

        // Get base version
        let currentData = await this.getFullVersion(key, fullVersion.version);

        // Apply diffs
        for (let v = fullVersion.version + 1; v <= targetVersion; v++) {
            const diff = await this.getDiff(key, v);
            currentData = this.applyDiff(currentData, diff);
        }

        return currentData;
    }

    private async getFullVersion(key: string, version: number): Promise<Buffer> {
        return fs.readFile(
            path.join(this.getVersionPath(key), `${version}.full`)
        );
    }

    private async getDiff(key: string, version: number): Promise<Buffer> {
        return fs.readFile(
            path.join(this.getVersionPath(key), 'diffs', `${version}.diff`)
        );
    }

    private async getVersionInfo(key: string, version: number): Promise<VersionInfo> {
        const content = await fs.readFile(
            path.join(this.getVersionPath(key), 'info', `${version}.json`),
            'utf8'
        );
        return JSON.parse(content);
    }

    private async cleanupOldVersions(key: string): Promise<void> {
        const versions = await this.listVersions(key);
        const now = Date.now();

        // Keep only the configured number of versions
        if (versions.length > this.config.maxVersions) {
            const toDelete = versions
                .slice(this.config.maxVersions)
                .filter(v => now - v.timestamp > this.config.retentionPeriod);

            for (const version of toDelete) {
                await this.deleteVersion(key, version.version);
            }
        }
    }

    private async deleteVersion(key: string, version: number): Promise<void> {
        const versionPath = this.getVersionPath(key);
        const files = [
            path.join(versionPath, `${version}.full`),
            path.join(versionPath, 'diffs', `${version}.diff`),
            path.join(versionPath, 'info', `${version}.json`)
        ];

        await Promise.all(
            files.map(f => fs.unlink(f).catch(() => {}))
        );
    }

    private getVersionPath(key: string): string {
        return path.join(this.storage['config'].basePath, 'versions', key);
    }

    private calculateChecksum(data: Buffer): string {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    private calculateDiff(oldData: Buffer, newData: Buffer): Buffer {
        // Implement diff calculation (e.g., using diff-match-patch)
        // For now, store full content
        return newData;
    }

    private applyDiff(baseData: Buffer, diff: Buffer): Buffer {
        // Implement diff application
        // For now, return the diff as is (since we're storing full content)
        return diff;
    }
}
