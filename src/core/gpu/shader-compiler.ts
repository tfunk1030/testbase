interface ShaderConfig {
    vertexShader: string;
    fragmentShader: string;
    attributes?: { [key: string]: number };
    uniforms?: { [key: string]: any };
    precision?: 'highp' | 'mediump' | 'lowp';
}

interface CompiledShader {
    program: WebGLProgram;
    attributes: { [key: string]: number };
    uniforms: { [key: string]: WebGLUniformLocation };
}

export class ShaderCompiler {
    private static instance: ShaderCompiler;
    private gl: WebGLRenderingContext | null = null;
    private compiledShaders: Map<string, CompiledShader> = new Map();

    private constructor() {
        this.initWebGL();
    }

    public static getInstance(): ShaderCompiler {
        if (!ShaderCompiler.instance) {
            ShaderCompiler.instance = new ShaderCompiler();
        }
        return ShaderCompiler.instance;
    }

    private initWebGL(): void {
        try {
            const canvas = new OffscreenCanvas(1, 1);
            this.gl = canvas.getContext('webgl') || null;

            if (!this.gl) {
                throw new Error('WebGL not supported');
            }
        } catch (error) {
            console.error('Failed to initialize WebGL:', error);
        }
    }

    public compileShader(name: string, config: ShaderConfig): boolean {
        if (!this.gl) {
            throw new Error('WebGL context not available');
        }

        try {
            // Compile vertex shader
            const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
            if (!vertexShader) {
                throw new Error('Failed to create vertex shader');
            }

            this.gl.shaderSource(vertexShader, this.addPrecision(config.vertexShader, config.precision));
            this.gl.compileShader(vertexShader);

            if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
                throw new Error(`Vertex shader compilation failed: ${this.gl.getShaderInfoLog(vertexShader)}`);
            }

            // Compile fragment shader
            const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
            if (!fragmentShader) {
                throw new Error('Failed to create fragment shader');
            }

            this.gl.shaderSource(fragmentShader, this.addPrecision(config.fragmentShader, config.precision));
            this.gl.compileShader(fragmentShader);

            if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
                throw new Error(`Fragment shader compilation failed: ${this.gl.getShaderInfoLog(fragmentShader)}`);
            }

            // Create and link program
            const program = this.gl.createProgram();
            if (!program) {
                throw new Error('Failed to create shader program');
            }

            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);

            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                throw new Error(`Shader program linking failed: ${this.gl.getProgramInfoLog(program)}`);
            }

            // Get attribute locations
            const attributes: { [key: string]: number } = {};
            if (config.attributes) {
                for (const [name, size] of Object.entries(config.attributes)) {
                    const location = this.gl.getAttribLocation(program, name);
                    if (location !== -1) {
                        attributes[name] = location;
                    }
                }
            }

            // Get uniform locations
            const uniforms: { [key: string]: WebGLUniformLocation } = {};
            if (config.uniforms) {
                for (const name of Object.keys(config.uniforms)) {
                    const location = this.gl.getUniformLocation(program, name);
                    if (location) {
                        uniforms[name] = location;
                    }
                }
            }

            // Store compiled shader
            this.compiledShaders.set(name, { program, attributes, uniforms });

            // Cleanup
            this.gl.deleteShader(vertexShader);
            this.gl.deleteShader(fragmentShader);

            return true;
        } catch (error) {
            console.error(`Failed to compile shader ${name}:`, error);
            return false;
        }
    }

    private addPrecision(shader: string, precision: string = 'highp'): string {
        return `precision ${precision} float;\n${shader}`;
    }

    public useShader(name: string): boolean {
        if (!this.gl) return false;

        const shader = this.compiledShaders.get(name);
        if (!shader) return false;

        this.gl.useProgram(shader.program);
        return true;
    }

    public setUniforms(name: string, uniforms: { [key: string]: any }): boolean {
        if (!this.gl) return false;

        const shader = this.compiledShaders.get(name);
        if (!shader) return false;

        this.gl.useProgram(shader.program);

        for (const [uniformName, value] of Object.entries(uniforms)) {
            const location = shader.uniforms[uniformName];
            if (!location) continue;

            if (Array.isArray(value)) {
                switch (value.length) {
                    case 2:
                        this.gl.uniform2fv(location, value);
                        break;
                    case 3:
                        this.gl.uniform3fv(location, value);
                        break;
                    case 4:
                        this.gl.uniform4fv(location, value);
                        break;
                    case 9:
                        this.gl.uniformMatrix3fv(location, false, value);
                        break;
                    case 16:
                        this.gl.uniformMatrix4fv(location, false, value);
                        break;
                }
            } else if (typeof value === 'number') {
                this.gl.uniform1f(location, value);
            }
        }

        return true;
    }

    public deleteShader(name: string): boolean {
        if (!this.gl) return false;

        const shader = this.compiledShaders.get(name);
        if (!shader) return false;

        this.gl.deleteProgram(shader.program);
        this.compiledShaders.delete(name);
        return true;
    }

    // Common shader templates
    public static readonly SHADER_TEMPLATES = {
        BASIC_VERTEX: `
            attribute vec3 position;
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;

            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,

        BASIC_FRAGMENT: `
            uniform vec3 color;

            void main() {
                gl_FragColor = vec4(color, 1.0);
            }
        `,

        PHYSICS_COMPUTE: `
            uniform float dt;
            uniform vec3 gravity;
            
            attribute vec3 position;
            attribute vec3 velocity;
            
            varying vec3 vPosition;
            varying vec3 vVelocity;
            
            void main() {
                vec3 newVelocity = velocity + gravity * dt;
                vec3 newPosition = position + velocity * dt + 0.5 * gravity * dt * dt;
                
                vPosition = newPosition;
                vVelocity = newVelocity;
                
                gl_Position = vec4(newPosition, 1.0);
            }
        `
    };

    public cleanup(): void {
        if (!this.gl) return;

        // Delete all shaders
        for (const [name] of this.compiledShaders) {
            this.deleteShader(name);
        }

        // Clear the map
        this.compiledShaders.clear();
    }
}
