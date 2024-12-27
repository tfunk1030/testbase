export const BENCHMARK_CONFIG = {
    // Time targets in milliseconds
    TARGET_COMPUTE_TIME: 100,
    TARGET_TRANSFER_TIME: 50,
    TARGET_TOTAL_TIME: 200,

    // Memory limits in bytes
    MEMORY_LIMIT: 1024 * 1024 * 512, // 512MB
    TENSOR_COUNT_LIMIT: 1000,

    // GPU utilization targets (0-1)
    MAX_GPU_USAGE: 0.9,
    MIN_GPU_USAGE: 0.1,

    // Benchmark dataset sizes
    SMALL_DATASET_SIZE: 1000,
    MEDIUM_DATASET_SIZE: 100000,
    LARGE_DATASET_SIZE: 1000000,

    // Batch processing
    BATCH_SIZE: 64,
    MAX_CONCURRENT_BATCHES: 4
};
