import * as fs from 'fs/promises';
import * as path from 'path';
import { DiskStorage } from './disk-storage';
import { VersionControl } from './version-control';
import { DataIntegrity } from './data-integrity';
import { CacheEntry, CacheMetadata } from './types';

interface MigrationConfig {
    batchSize?: number;
    concurrency?: number;
    validateAfterMigration?: boolean;
    backupBeforeMigration?: boolean;
    retryAttempts?: number;
}

interface MigrationPlan {
    sourceVersion: number;
    targetVersion: number;
    steps: MigrationStep[];
    estimatedTime: number;
    affectedItems: number;
}

interface MigrationStep {
    description: string;
    operation: 'transform' | 'validate' | 'backup' | 'cleanup';
    transformer?: (data: any) => Promise<any>;
}

interface MigrationResult {
    success: boolean;
    startTime: number;
    endTime: number;
    migratedItems: number;
    errors: Array<{
        key: string;
        error: string;
    }>;
    validationResults?: {
        valid: number;
        invalid: number;
        errors: string[];
    };
}

export class MigrationTool {
    private static instance: MigrationTool;
    private readonly storage: DiskStorage;
    private readonly versionControl: VersionControl;
    private readonly dataIntegrity: DataIntegrity;
    private readonly config: Required<MigrationConfig>;
    private isMigrating: boolean = false;

    private constructor(
        storage: DiskStorage,
        versionControl: VersionControl,
        dataIntegrity: DataIntegrity,
        config: MigrationConfig = {}
    ) {
        this.storage = storage;
        this.versionControl = versionControl;
        this.dataIntegrity = dataIntegrity;
        this.config = {
            batchSize: config.batchSize || 100,
            concurrency: config.concurrency || 4,
            validateAfterMigration: config.validateAfterMigration ?? true,
            backupBeforeMigration: config.backupBeforeMigration ?? true,
            retryAttempts: config.retryAttempts || 3
        };
    }

    public static getInstance(
        storage: DiskStorage,
        versionControl: VersionControl,
        dataIntegrity: DataIntegrity,
        config?: MigrationConfig
    ): MigrationTool {
        if (!MigrationTool.instance) {
            MigrationTool.instance = new MigrationTool(
                storage,
                versionControl,
                dataIntegrity,
                config
            );
        }
        return MigrationTool.instance;
    }

    public async createMigrationPlan(
        sourceVersion: number,
        targetVersion: number
    ): Promise<MigrationPlan> {
        const steps: MigrationStep[] = [];
        const keys = await this.getAllCacheKeys();

        // Add backup step if enabled
        if (this.config.backupBeforeMigration) {
            steps.push({
                description: 'Create backup of current state',
                operation: 'backup'
            });
        }

        // Add transformation steps
        if (sourceVersion < targetVersion) {
            // Forward migration
            for (let v = sourceVersion + 1; v <= targetVersion; v++) {
                steps.push(...await this.getUpgradeSteps(v));
            }
        } else {
            // Backward migration (rollback)
            for (let v = sourceVersion; v > targetVersion; v--) {
                steps.push(...await this.getDowngradeSteps(v));
            }
        }

        // Add validation step if enabled
        if (this.config.validateAfterMigration) {
            steps.push({
                description: 'Validate migrated data',
                operation: 'validate'
            });
        }

        // Add cleanup step
        steps.push({
            description: 'Clean up temporary migration files',
            operation: 'cleanup'
        });

        return {
            sourceVersion,
            targetVersion,
            steps,
            estimatedTime: this.estimateMigrationTime(steps.length, keys.length),
            affectedItems: keys.length
        };
    }

    public async executeMigration(plan: MigrationPlan): Promise<MigrationResult> {
        if (this.isMigrating) {
            throw new Error('Migration already in progress');
        }

        this.isMigrating = true;
        const result: MigrationResult = {
            success: false,
            startTime: Date.now(),
            endTime: 0,
            migratedItems: 0,
            errors: []
        };

        try {
            // Execute each step in the plan
            for (const step of plan.steps) {
                switch (step.operation) {
                    case 'backup':
                        await this.createBackup();
                        break;
                    case 'transform':
                        await this.executeTransformation(step, result);
                        break;
                    case 'validate':
                        result.validationResults = await this.validateMigration();
                        break;
                    case 'cleanup':
                        await this.cleanup();
                        break;
                }
            }

            result.success = true;
        } catch (error) {
            result.errors.push({
                key: 'migration',
                error: error.message
            });
            
            // Attempt rollback
            await this.rollback();
        } finally {
            result.endTime = Date.now();
            this.isMigrating = false;
        }

        // Store migration result
        await this.storeMigrationResult(result);

        return result;
    }

    private async executeTransformation(
        step: MigrationStep,
        result: MigrationResult
    ): Promise<void> {
        if (!step.transformer) return;

        const keys = await this.getAllCacheKeys();
        const batches: string[][] = [];

        // Split into batches
        for (let i = 0; i < keys.length; i += this.config.batchSize) {
            batches.push(keys.slice(i, i + this.config.batchSize));
        }

        // Process batches with limited concurrency
        for (const batch of batches) {
            const batchResults = await Promise.all(
                batch.map(key => this.transformItem(key, step.transformer!, result))
            );

            result.migratedItems += batchResults.filter(r => r).length;
        }
    }

    private async transformItem(
        key: string,
        transformer: (data: any) => Promise<any>,
        result: MigrationResult
    ): Promise<boolean> {
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                // Get current data
                const { data, metadata } = await this.storage.retrieve(key);

                // Transform data
                const transformedData = await transformer(data);

                // Update metadata
                const newMetadata = {
                    ...metadata,
                    version: metadata.version + 1,
                    timestamp: Date.now()
                };

                // Store transformed data
                await this.storage.store(key, transformedData, newMetadata);

                return true;
            } catch (error) {
                if (attempt === this.config.retryAttempts) {
                    result.errors.push({
                        key,
                        error: error.message
                    });
                    return false;
                }
            }
        }

        return false;
    }

    private async createBackup(): Promise<void> {
        const backupPath = path.join(this.storage['config'].basePath, 'backups');
        const timestamp = Date.now();

        // Create backup directory
        await fs.mkdir(path.join(backupPath, timestamp.toString()), { recursive: true });

        // Copy all files
        const keys = await this.getAllCacheKeys();
        for (const key of keys) {
            const { data, metadata } = await this.storage.retrieve(key);
            await fs.writeFile(path.join(backupPath, timestamp.toString(), key), data);
            await fs.writeFile(
                path.join(backupPath, timestamp.toString(), `${key}.meta`),
                JSON.stringify(metadata)
            );
        }
    }

    private async validateMigration(): Promise<{
        valid: number;
        invalid: number;
        errors: string[];
    }> {
        const report = await this.dataIntegrity.verifyIntegrity();
        return {
            valid: report.verifiedItems,
            invalid: report.corruptedItems,
            errors: report.errors.map(e => `${e.key}: ${e.message}`)
        };
    }

    private async rollback(): Promise<void> {
        // Find latest backup
        const backupPath = path.join(this.storage['config'].basePath, 'backups');
        const backups = await fs.readdir(backupPath);
        
        if (backups.length === 0) {
            throw new Error('No backup found for rollback');
        }

        const latestBackup = backups
            .map(Number)
            .sort((a, b) => b - a)[0];

        // Restore from backup
        const backupDir = path.join(backupPath, latestBackup.toString());
        const files = await fs.readdir(backupDir);

        for (const file of files) {
            if (file.endsWith('.meta')) continue;

            const data = await fs.readFile(path.join(backupDir, file));
            const metadata = JSON.parse(
                await fs.readFile(path.join(backupDir, `${file}.meta`), 'utf8')
            );

            await this.storage.store(file, data, metadata);
        }
    }

    private async cleanup(): Promise<void> {
        // Clean up old backups
        const backupPath = path.join(this.storage['config'].basePath, 'backups');
        const backups = await fs.readdir(backupPath);
        
        // Keep only the latest 3 backups
        const oldBackups = backups
            .map(Number)
            .sort((a, b) => b - a)
            .slice(3);

        for (const backup of oldBackups) {
            await fs.rm(path.join(backupPath, backup.toString()), { recursive: true });
        }
    }

    private async getUpgradeSteps(version: number): Promise<MigrationStep[]> {
        // This would be implemented based on specific version upgrade requirements
        return [{
            description: `Upgrade to version ${version}`,
            operation: 'transform',
            transformer: async (data: any) => data // Implement actual transformation
        }];
    }

    private async getDowngradeSteps(version: number): Promise<MigrationStep[]> {
        // This would be implemented based on specific version downgrade requirements
        return [{
            description: `Downgrade from version ${version}`,
            operation: 'transform',
            transformer: async (data: any) => data // Implement actual transformation
        }];
    }

    private estimateMigrationTime(steps: number, items: number): number {
        // Rough estimation: 100ms per item per step
        return steps * items * 100;
    }

    private async getAllCacheKeys(): Promise<string[]> {
        const dataPath = path.join(this.storage['config'].basePath, 'data');
        return fs.readdir(dataPath);
    }

    private async storeMigrationResult(result: MigrationResult): Promise<void> {
        const resultsPath = path.join(this.storage['config'].basePath, 'migration_results');
        await fs.mkdir(resultsPath, { recursive: true });
        
        await fs.writeFile(
            path.join(resultsPath, `migration_${result.startTime}.json`),
            JSON.stringify(result, null, 2)
        );
    }

    public isMigrationInProgress(): boolean {
        return this.isMigrating;
    }
}
