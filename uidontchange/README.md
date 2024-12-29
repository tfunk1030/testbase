# LastShot Windsurf 🏌️‍♂️

A mobile-first golf shot analysis and visualization application built with Next.js and TypeScript.

## Features

- 📱 Mobile-optimized interface
- 🎯 Shot visualization with wind effects
- 🌡️ Real-time weather integration
- 🏌️‍♂️ Club selection assistant
- ✈️ Ball flight testing
- 📊 Detailed shot analytics

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Radix UI Components

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/lastshot-windsurf.git
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:5000](http://localhost:5000) in your mobile browser

## Integration Guide

### Option 1: NPM Package Integration

1. Create a physics engine package:
```bash
mkdir golf-physics-engine
cd golf-physics-engine
npm init -y
npm install typescript @types/node
npm install --save-dev jest @types/jest ts-jest
```

2. Set up TypeScript configuration:
```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "strict": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

3. Build and publish:
```bash
npm run build
npm publish --access public
```

4. Install in UI project:
```bash
npm install @yourusername/golf-physics
```

### Option 2: API Integration

1. Create API server:
```bash
# In your research repository
npm install express cors ws
npm install --save-dev @types/express @types/cors @types/ws
```

2. Start the server:
```bash
# Configure environment
echo "PHYSICS_API_PORT=3000" > .env

# Start server
npm run start:api
```

3. Connect from UI:
```typescript
// In your UI code
const PHYSICS_API = process.env.NEXT_PUBLIC_PHYSICS_API || 'http://localhost:3000';
```

### Option 3: Direct Integration

1. Create shared library structure:
```
lib/
  physics/
    constants.ts
    environment.ts
    ball.ts
    shot.ts
```

2. Link repositories:
```bash
# In research repo
npm link

# In UI repo
npm link @yourusername/golf-physics
```

## Detailed Integration Examples

### Advanced Physics Integration
```typescript
// Example of complex shot calculation with all parameters
import { ShotCalculator, EnvironmentCalculator } from '@yourusername/golf-physics';

async function analyzeComplexShot() {
  // Environment setup
  const environment = {
    temperature: 25, // Celsius
    humidity: 0.65, // 65%
    pressure: 1013.25, // hPa
    altitude: 100, // meters
  };

  // Ball parameters
  const ballParams = {
    initialVelocity: 70, // m/s
    launchAngle: 12, // degrees
    spinRate: 2500, // rpm
    spinAxis: -2, // degrees
  };

  // Wind conditions
  const wind = {
    speed: 5, // m/s
    direction: 45, // degrees
    gustFactor: 1.2
  };

  // Calculate air density
  const airDensity = EnvironmentCalculator.calculateAirDensity(
    environment.temperature,
    environment.pressure,
    environment.humidity
  );

  // Get full trajectory
  const trajectory = await ShotCalculator.calculateFullTrajectory({
    ...ballParams,
    environment,
    wind,
    airDensity
  });

  return {
    path: trajectory.points,
    apex: trajectory.maxHeight,
    distance: trajectory.totalDistance,
    flightTime: trajectory.time,
    lateralDeviation: trajectory.deviation
  };
}
```

### Real-time Data Updates
```typescript
// WebSocket handler with reconnection and error handling
class PhysicsSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private url: string) {
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      console.log('Connected to physics engine');
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, 1000 * Math.pow(2, this.reconnectAttempts));
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  public sendUpdate(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
```

## Troubleshooting Guide

### Common Issues and Solutions

1. **NPM Package Integration**
   
   Problem: Type definitions not found
   ```bash
   error TS2307: Cannot find module '@yourusername/golf-physics' or its corresponding type definitions.
   ```
   Solution:
   ```bash
   # Ensure types are built and included
   # In physics package
   npm run build
   
   # In UI project
   npm install --save-dev @types/@yourusername/golf-physics
   ```

2. **API Connection Issues**
   
   Problem: CORS errors
   ```
   Access to fetch at 'http://localhost:3000' from origin 'http://localhost:5000' has been blocked by CORS policy
   ```
   Solution:
   ```typescript
   // In API server
   app.use(cors({
     origin: process.env.UI_URL || 'http://localhost:5000',
     methods: ['GET', 'POST'],
     credentials: true
   }));
   ```

3. **WebSocket Connection**
   
   Problem: Connection drops frequently
   Solution:
   ```typescript
   // Implement heartbeat mechanism
   const HEARTBEAT_INTERVAL = 30000;
   
   wss.on('connection', (ws) => {
     const heartbeat = setInterval(() => {
       if (ws.readyState === ws.OPEN) {
         ws.ping();
       }
     }, HEARTBEAT_INTERVAL);
   
     ws.on('close', () => clearInterval(heartbeat));
   });
   ```

## Deployment Instructions

### 1. Physics Engine Package

```bash
# 1. Prepare for production
npm run build

# 2. Update version
npm version patch

# 3. Publish
npm publish

# 4. Tag release
git tag v1.0.0
git push origin v1.0.0
```

### 2. API Server

```bash
# 1. Build Docker image
docker build -t physics-api .

# 2. Run container
docker run -p 3000:3000 -e NODE_ENV=production physics-api
```

Example `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["npm", "start"]
```

### 3. UI Application

```bash
# 1. Build for production
npm run build

# 2. Deploy to Vercel
vercel --prod
```

## Performance Optimization

### 1. Computation Optimization

```typescript
// Cache expensive calculations
const memoizedCalculation = memoize((params) => {
  return heavyPhysicsCalculation(params);
}, {
  maxAge: 5000, // Cache for 5 seconds
  maxSize: 100  // Store up to 100 results
});

// Use Web Workers for heavy calculations
const physicsWorker = new Worker('physics-worker.js');
physicsWorker.postMessage({ type: 'CALCULATE_TRAJECTORY', params });
```

### 2. Network Optimization

```typescript
// Batch updates
let updateQueue = [];
const BATCH_INTERVAL = 100; // ms

function queueUpdate(data) {
  updateQueue.push(data);
  if (updateQueue.length === 1) {
    setTimeout(sendBatchUpdate, BATCH_INTERVAL);
  }
}

function sendBatchUpdate() {
  if (updateQueue.length === 0) return;
  
  const batch = updateQueue;
  updateQueue = [];
  
  api.sendBatchUpdate(batch);
}
```

### 3. Memory Management

```typescript
class TrajectoryManager {
  private static MAX_POINTS = 1000;
  private points: TrajectoryPoint[] = [];

  addPoint(point: TrajectoryPoint) {
    this.points.push(point);
    if (this.points.length > TrajectoryManager.MAX_POINTS) {
      // Remove older points to prevent memory issues
      this.points = this.points.slice(-TrajectoryManager.MAX_POINTS);
    }
  }

  cleanup() {
    this.points = [];
  }
}
```

### 4. Rendering Optimization

```typescript
// Use requestAnimationFrame for smooth animations
class ShotVisualizer {
  private animationFrame: number | null = null;

  animate() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const draw = () => {
      this.updateCanvas();
      this.animationFrame = requestAnimationFrame(draw);
    };

    this.animationFrame = requestAnimationFrame(draw);
  }

  cleanup() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}
```

## Monitoring and Analytics

```typescript
// Add performance monitoring
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1
});

// Track physics calculation performance
performance.mark('physicsStart');
const result = await calculateTrajectory(params);
performance.mark('physicsEnd');
performance.measure('Physics Calculation', 'physicsStart', 'physicsEnd');
```

## Integration Examples

### Basic Usage
```typescript
// Using NPM package
import { ShotCalculator } from '@yourusername/golf-physics';

const result = await ShotCalculator.calculateTrajectory({
  initialVelocity: 70,
  launchAngle: 12,
  spinRate: 2500
});
```

### API Usage
```typescript
// Using API endpoints
const response = await fetch('${PHYSICS_API}/shot/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(shotParams)
});

const result = await response.json();
```

### WebSocket Updates
```typescript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'TRAJECTORY_UPDATE') {
    updateVisualization(data.trajectory);
  }
};
```

## Environment Variables

Create a `.env.local` file:
```env
NEXT_PUBLIC_PHYSICS_API=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

## Development Workflow

1. Start Physics API:
```bash
cd research-repo
npm run start:api
```

2. Start UI Development:
```bash
cd lastshot-windsurf
npm run dev
```

3. Run Tests:
```bash
# Test physics engine
cd research-repo
npm test

# Test UI
cd lastshot-windsurf
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
