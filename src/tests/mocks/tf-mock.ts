// Mock TensorFlow.js functionality
const tf = {
    ready: jest.fn().mockResolvedValue(undefined),
    memory: jest.fn().mockReturnValue({
        numBytes: 1000000,
        numTensors: 100,
        numDataBuffers: 50,
        unreliable: false
    }),
    tensor: jest.fn().mockReturnValue({
        dispose: jest.fn(),
        dataSync: jest.fn().mockReturnValue(new Float32Array(100)),
        shape: [10, 10]
    }),
    dispose: jest.fn(),
    tidy: jest.fn((fn) => fn()),
    browser: {
        fromPixels: jest.fn()
    },
    util: {
        sizeFromShape: jest.fn()
    },
    // GPU specific mocks
    setBackend: jest.fn().mockResolvedValue(true),
    backend: jest.fn().mockReturnValue('webgl'),
    env: jest.fn().mockReturnValue({
        flagRegistry: {
            getFloat: jest.fn().mockReturnValue(1.0),
            getBool: jest.fn().mockReturnValue(true)
        }
    }),
    webgl: {
        forceHalfFloat: jest.fn(),
        setWebGLContext: jest.fn()
    }
};

export = tf;
