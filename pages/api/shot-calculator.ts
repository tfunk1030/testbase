import { NextApiRequest, NextApiResponse } from 'next';
import { PhysicsEngine } from '@/services/physics/PhysicsEngine';
import { TrajectoryCache } from '@/services/cache/TrajectoryCache';
import { WeatherService } from '@/services/weather/WeatherService';
import { BallProperties, Environment, BallState } from '@/types';

const cache = new TrajectoryCache();
const physicsEngine = new PhysicsEngine(cache);
const weatherService = new WeatherService();

interface ShotCalculatorRequest {
  targetDistance: number;
  environment: {
    temperature: number;
    pressure: number;
    humidity: number;
    altitude: number;
  };
  settings: {
    altitudeUnit: 'feet' | 'meters';
    distanceUnit: 'yards' | 'meters';
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
    const { targetDistance, environment, settings }: ShotCalculatorRequest = req.body;

    // Get current weather if no environment provided
    const physicsEnvironment: Environment = environment ? {
      temperature: environment.temperature,
      pressure: environment.pressure * 100, // Convert hPa to Pa
      humidity: environment.humidity / 100, // Convert percentage to decimal
      altitude: settings.altitudeUnit === 'feet' 
        ? environment.altitude * 0.3048 // Convert feet to meters
        : environment.altitude,
      wind: { 
        x: environment.wind?.speed * Math.cos(environment.wind?.direction * Math.PI / 180) || 0,
        y: 0,
        z: environment.wind?.speed * Math.sin(environment.wind?.direction * Math.PI / 180) || 0
      }
    } : await weatherService.getCurrentWeather(req.query.latitude as string, req.query.longitude as string)
      .then(weather => weatherService.convertToEnvironment(weather));

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

    // Initial ball state for calculation
    const initialState: BallState = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      spin: { rate: 0, axis: { x: 0, y: 0, z: 0 } },
      mass: ballProperties.mass
    };

    const result = await physicsEngine.calculateTrajectory({
      initialState,
      environment: physicsEnvironment,
      properties: ballProperties,
      targetDistance
    });

    // Convert physics results to UI format
    const windEffect = calculateWindEffect(
      targetDistance,
      physicsEnvironment.wind,
      settings.distanceUnit
    );

    const adjustments = {
      adjustedYardage: targetDistance * (1 + (result.metrics.totalDistance + windEffect) / targetDistance),
      densityEffect: result.metrics.totalDistance * 0.1,
      altitudeEffect: physicsEnvironment.altitude * 0.00018 * targetDistance,
      humidityEffect: (physicsEnvironment.humidity - 0.5) * 0.0002 * targetDistance,
      temperatureEffect: (physicsEnvironment.temperature - 20) * 0.001 * targetDistance,
      windEffect: windEffect,
      totalEffect: result.metrics.totalDistance + windEffect - targetDistance
    };

    function calculateWindEffect(
      distance: number,
      wind: { x: number, y: number, z: number },
      unit: 'yards' | 'meters'
    ): number {
      const windSpeed = Math.sqrt(wind.x * wind.x + wind.z * wind.z);
      const conversionFactor = unit === 'yards' ? 1.09361 : 1;
      return windSpeed * 0.07 * distance * conversionFactor; // 7% effect per m/s at full distance
    }

    res.json(adjustments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Calculation failed' });
  }
}
