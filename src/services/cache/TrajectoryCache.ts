import { TrajectoryResult } from '@/core/types';

export class TrajectoryCache {
  private cache: Map<string, {
    result: TrajectoryResult;
    timestamp: number;
  }> = new Map();
  
  private readonly TTL = 15 * 60 * 1000; // 15 minutes in milliseconds

  async get(key: string): Promise<TrajectoryResult | null> {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.result;
  }

  async set(key: string, value: TrajectoryResult): Promise<void> {
    this.cache.set(key, {
      result: value,
      timestamp: Date.now()
    });
  }
}
