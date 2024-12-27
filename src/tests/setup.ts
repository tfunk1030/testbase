// Setup file for Jest
import { TextEncoder, TextDecoder } from 'util';

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock performance.now()
if (typeof performance === 'undefined') {
    (global as any).performance = {
        now: jest.fn(() => Date.now())
    };
}

// Mock WebGL context
class WebGLRenderingContext {
    canvas: any;
    drawingBufferWidth: number;
    drawingBufferHeight: number;

    constructor() {
        this.canvas = {
            width: 256,
            height: 256
        };
        this.drawingBufferWidth = 256;
        this.drawingBufferHeight = 256;
    }

    getExtension() { return {}; }
    getParameter() { return 1; }
    getShaderPrecisionFormat() { return { precision: 1 }; }
}

// Mock HTMLCanvasElement
class HTMLCanvasElement {
    width: number;
    height: number;

    constructor() {
        this.width = 256;
        this.height = 256;
    }

    getContext(contextId: string) {
        if (contextId === 'webgl' || contextId === 'webgl2') {
            return new WebGLRenderingContext();
        }
        return null;
    }
}

// Add to global
global.HTMLCanvasElement = HTMLCanvasElement as any;
global.WebGLRenderingContext = WebGLRenderingContext as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    return setTimeout(() => callback(Date.now()), 0) as unknown as number;
};

// Mock cancelAnimationFrame
global.cancelAnimationFrame = (handle: number): void => {
    clearTimeout(handle);
};
