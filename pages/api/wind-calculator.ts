import { NextApiRequest, NextApiResponse } from 'next';
import { PhysicsEngine } from '@/services/physics/PhysicsEngine';
import { TrajectoryCache } from '@/services/cache/TrajectoryCache';
import { BallProperties, Environment, BallState, Vector3D } from '@/types';

const cache = new TrajectoryCache();
const physicsEngine = new PhysicsEngine(cache);

interface WindCalculatorRequest {
  targetDistance: number;
  environment: {
    temperature: number;
    pressure: number;
    humidity: number;
    altitude: number;
    wind: {
      speed: number;      // mph or m/s
      direction: number;  // degrees
      gust: number;      // mph or m/s
    };
  };
  settings: {
    altitudeUnit: 'feet' | 'meters';
    distanceUnit: 'yards' | 'meters';
    speedUnit: 'mph' | 'ms';
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { targetDistance, environment, settings }: WindCalculatorRequest = req.body;

    // Convert wind to vector components
    const windRadians = environment.wind.direction * Math.PI / 180;
    const windSpeed = settings.speedUnit === 'mph' 
      ? environment.wind.speed * 0.44704  // mph to m/s
      : environment.wind.speed;

    const windVector: Vector3D = {
      x: windSpeed * Math.cos(windRadians),
      y: 0, // Assuming horizontal wind only
      z: windSpeed * Math.sin(windRadians)
    };

    // Convert to physics engine input format
    const physicsEnvironment: Environment = {
      temperature: environment.temperature,
      pressure: environment.pressure * 100, // Convert hPa to Pa
      humidity: environment.humidity / 100, // Convert percentage to decimal
      altitude: settings.altitudeUnit === 'feet' 
        ? environment.altitude * 0.3048 // Convert feet to meters
        : environment.altitude,
      wind: windVector
    };

    // Standard ball properties
    const ballProperties: BallProperties = {
      mass: 0.0459,          // kg
      radius: 0.02135,       // m
      area: Math.PI * 0.02135 * 0.02135,
      dragCoefficient: 0.47,
      liftCoefficient: 0.15,
      magnusCoefficient: 0.12,
      spinDecayRate: 0.0015
    };

    // Calculate trajectories with and without wind
    const noWindResult = await physicsEngine.calculateTrajectory({
      initialState: getInitialState(ballProperties),
      environment: { ...physicsEnvironment, wind: { x: 0, y: 0, z: 0 } },
      properties: ballProperties,
      targetDistance
    });

    const withWindResult = await physicsEngine.calculateTrajectory({
      initialState: getInitialState(ballProperties),
      environment: physicsEnvironment,
      properties: ballProperties,
      targetDistance
    });

    // Calculate adjustments
    const adjustments = {
      standard: {
        adjustedYardage: targetDistance * (1 + noWindResult.metrics.totalDistance / targetDistance),
        densityEffect: noWindResult.metrics.totalDistance * 0.1,
        altitudeEffect: physicsEnvironment.altitude * 0.00018 * targetDistance,
        humidityEffect: (physicsEnvironment.humidity - 0.5) * 0.0002 * targetDistance,
        temperatureEffect: (physicsEnvironment.temperature - 20) * 0.001 * targetDistance,
        totalEffect: noWindResult.metrics.totalDistance - targetDistance
      },
      wind: {
        carry: withWindResult.metrics.totalDistance - noWindResult.metrics.totalDistance,
        direction: calculateWindDirection(withWindResult.points[0].position, withWindResult.points[withWindResult.points.length - 1].position),
        heightEffect: calculateHeightEffect(withWindResult.points),
        gustEffect: calculateGustEffect(environment.wind.gust, windSpeed, targetDistance),
        totalWindEffect: withWindResult.metrics.totalDistance - noWindResult.metrics.totalDistance
      },
      total: {
        distance: withWindResult.metrics.totalDistance,
        adjustment: withWindResult.metrics.totalDistance - targetDistance,
        direction: calculatePlayDirection(withWindResult.points[0].position, withWindResult.points[withWindResult.points.length - 1].position)
      }
    };

    res.json(adjustments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Wind calculation failed' });
  }
}

function getInitialState(properties: BallProperties): BallState {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    spin: { rate: 0, axis: { x: 0, y: 0, z: 0 } },
    mass: properties.mass
  };
}

function calculateWindDirection(start: Vector3D, end: Vector3D): number {
  return Math.atan2(end.z - start.z, end.x - start.x) * 180 / Math.PI;
}

function calculateHeightEffect(points: any[]): number {
  const maxHeight = Math.max(...points.map(p => p.position.y));
  return maxHeight * 0.1; // 10% effect per meter of height
}

function calculateGustEffect(gust: number, windSpeed: number, distance: number): number {
  const gustFactor = (gust - windSpeed) / windSpeed;
  return distance * gustFactor * 0.05; // 5% effect per unit of gust factor
}

function calculatePlayDirection(start: Vector3D, end: Vector3D): number {
  const angle = Math.atan2(end.z - start.z, end.x - start.x);
  return (angle + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI;
}
