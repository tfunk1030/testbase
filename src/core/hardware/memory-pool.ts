import { RealTimeMonitor } from '../real-time-monitor';

interface PoolConfig {
    initialSize: number;
    growthFactor: number;
    maxSize: number;
    itemSize: number;
    name: string;
}

interface PoolStats {
    totalSize: number;
    usedSize: number;
    freeSize: number;
    allocationCount: number;
    deallocationCount: number;
    growthCount: number;
    fragmentationRatio: number;
}

interface MemoryBlockMetadata {
    lastAccess: number;
    accessCount: number;
    fragmentationScore: number;
}

class MemoryBlock {
    public next: MemoryBlock | null = null;
    public inUse: boolean = false;
    public size: number;
    public data: ArrayBuffer;
    public metadata: MemoryBlockMetadata;

    constructor(size: number) {
        this.size = size;
        this.data = new ArrayBuffer(size);
        this.metadata = {
            lastAccess: Date.now(),
            accessCount: 0,
            fragmentationScore: 0
        };
    }
}

export class MemoryPool {
    private readonly config: Required<PoolConfig>;
    private readonly monitor: RealTimeMonitor;
    private head: MemoryBlock | null = null;
    private totalSize: number = 0;
    private usedSize: number = 0;
    private stats = {
        allocationCount: 0,
        deallocationCount: 0,
        growthCount: 0
    };

    constructor(config: PoolConfig) {
        this.config = {
            initialSize: Math.max(1024, config.initialSize),
            growthFactor: Math.max(1.1, config.growthFactor),
            maxSize: Math.max(config.initialSize * 2, config.maxSize),
            itemSize: Math.max(1, config.itemSize),
            name: config.name
        };
        this.monitor = RealTimeMonitor.getInstance();
        this.initialize();
    }

    private initialize(): void {
        // Create initial pool
        const blockCount = Math.floor(this.config.initialSize / this.config.itemSize);
        let current: MemoryBlock | null = null;

        for (let i = 0; i < blockCount; i++) {
            const block = new MemoryBlock(this.config.itemSize);
            if (!this.head) {
                this.head = block;
            } else if (current) {
                current.next = block;
            }
            current = block;
            this.totalSize += this.config.itemSize;
        }
    }

    public allocate(): ArrayBuffer | null {
        let bestBlock: MemoryBlock | null = null;
        let bestScore = Infinity;
        let block = this.head;

        // Smart block selection using scoring
        while (block) {
            if (!block.inUse) {
                const score = this.calculateAllocationScore(block);
                if (score < bestScore) {
                    bestScore = score;
                    bestBlock = block;
                }
            }
            block = block.next;
        }

        if (!bestBlock) {
            if (!this.grow()) {
                return null;
            }
            bestBlock = this.findFirstFreeBlock();
        }

        if (!bestBlock) {
            return null;
        }

        bestBlock.inUse = true;
        bestBlock.metadata.lastAccess = Date.now();
        bestBlock.metadata.accessCount++;
        this.usedSize += bestBlock.size;
        this.stats.allocationCount++;

        this.updateFragmentationScores();
        return bestBlock.data;
    }

    private calculateAllocationScore(block: MemoryBlock): number {
        const timeSinceLastAccess = Date.now() - block.metadata.lastAccess;
        const fragmentationPenalty = block.metadata.fragmentationScore * 2;
        const accessFrequencyBonus = block.metadata.accessCount * 0.5;
        
        return timeSinceLastAccess + fragmentationPenalty - accessFrequencyBonus;
    }

    private findFirstFreeBlock(): MemoryBlock | null {
        let block = this.head;
        while (block && block.inUse) {
            block = block.next;
        }
        return block;
    }

    private updateFragmentationScores(): void {
        let block = this.head;
        let fragmentedRegions = 0;
        let currentFragmentSize = 0;

        while (block) {
            if (!block.inUse) {
                currentFragmentSize++;
            } else if (currentFragmentSize > 0) {
                fragmentedRegions++;
                this.updateBlockFragmentationScores(block, currentFragmentSize);
                currentFragmentSize = 0;
            }
            block = block.next;
        }

        if (currentFragmentSize > 0) {
            fragmentedRegions++;
        }
    }

    private updateBlockFragmentationScores(block: MemoryBlock, fragmentSize: number): void {
        const baseScore = fragmentSize / this.getTotalBlocks();
        let current = block;
        let distance = 0;

        // Update scores for blocks around the fragmented region
        while (current && distance < 3) {
            current.metadata.fragmentationScore = baseScore * (1 - distance * 0.3);
            current = current.next;
            distance++;
        }
    }

    public deallocate(buffer: ArrayBuffer): boolean {
        let block = this.head;
        while (block) {
            if (block.data === buffer && block.inUse) {
                block.inUse = false;
                this.usedSize -= block.size;
                this.stats.deallocationCount++;
                return true;
            }
            block = block.next;
        }
        return false;
    }

    private grow(): boolean {
        if (this.totalSize >= this.config.maxSize) {
            return false;
        }

        const growthSize = Math.min(
            this.totalSize * (this.config.growthFactor - 1),
            this.config.maxSize - this.totalSize
        );

        const blockCount = Math.floor(growthSize / this.config.itemSize);
        if (blockCount === 0) {
            return false;
        }

        let current = this.head;
        while (current && current.next) {
            current = current.next;
        }

        for (let i = 0; i < blockCount; i++) {
            const block = new MemoryBlock(this.config.itemSize);
            if (!this.head) {
                this.head = block;
            } else if (current) {
                current.next = block;
            }
            current = block;
            this.totalSize += this.config.itemSize;
        }

        this.stats.growthCount++;
        return true;
    }

    public getStats(): PoolStats {
        let freeBlocks = 0;
        let totalBlocks = 0;
        let maxContiguousFree = 0;
        let currentContiguousFree = 0;

        let block = this.head;
        while (block) {
            totalBlocks++;
            if (!block.inUse) {
                freeBlocks++;
                currentContiguousFree++;
                maxContiguousFree = Math.max(maxContiguousFree, currentContiguousFree);
            } else {
                currentContiguousFree = 0;
            }
            block = block.next;
        }

        const fragmentationRatio = totalBlocks > 0 ?
            1 - (maxContiguousFree / freeBlocks) : 0;

        return {
            totalSize: this.totalSize,
            usedSize: this.usedSize,
            freeSize: this.totalSize - this.usedSize,
            allocationCount: this.stats.allocationCount,
            deallocationCount: this.stats.deallocationCount,
            growthCount: this.stats.growthCount,
            fragmentationRatio
        };
    }

    public defragment(): void {
        if (!this.head) return;

        // Sort blocks by access patterns and fragmentation
        const blocks: MemoryBlock[] = [];
        let block = this.head;
        while (block) {
            blocks.push(block);
            block = block.next;
        }

        blocks.sort((a, b) => {
            if (a.inUse !== b.inUse) return a.inUse ? -1 : 1;
            if (a.inUse) {
                return b.metadata.accessCount - a.metadata.accessCount;
            }
            return a.metadata.fragmentationScore - b.metadata.fragmentationScore;
        });

        // Rebuild linked list with optimized order
        this.head = blocks[0] || null;
        for (let i = 0; i < blocks.length - 1; i++) {
            blocks[i].next = blocks[i + 1];
        }
        if (blocks.length > 0) {
            blocks[blocks.length - 1].next = null;
        }

        this.updateFragmentationScores();
    }

    private getTotalBlocks(): number {
        let count = 0;
        let block = this.head;
        while (block) {
            count++;
            block = block.next;
        }
        return count;
    }

    public clear(): void {
        let block = this.head;
        while (block) {
            block.inUse = false;
            block = block.next;
        }
        this.usedSize = 0;
        this.stats.deallocationCount += this.stats.allocationCount;
        this.stats.allocationCount = 0;
    }
}
