import { NextApiRequest, NextApiResponse } from 'next';
import { PhysicsEngine } from '@/services/physics/PhysicsEngine';
import { TrajectoryCache } from '@/services/cache/TrajectoryCache';

const cache = new TrajectoryCache();
const physicsEngine = new PhysicsEngine(cache);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await physicsEngine.calculateTrajectory(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Calculation failed' });
  }
}
