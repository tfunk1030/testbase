import React, { useState } from 'react';
import { useEnvironmental } from '@/lib/hooks/use-environmental';
import { useSettings } from '@/lib/settings-context';
import { Target, Wind } from 'lucide-react';

interface Club {
  name: string;
  normalYardage: number;
  loft: number;
  type: 'wood' | 'iron' | 'wedge' | 'putter';
}

const defaultClubs: Club[] = [
  { name: 'Driver', normalYardage: 250, loft: 10.5, type: 'wood' },
  { name: '3-Wood', normalYardage: 230, loft: 15, type: 'wood' },
  { name: '5-Wood', normalYardage: 215, loft: 18, type: 'wood' },
  { name: '4-Iron', normalYardage: 200, loft: 21, type: 'iron' },
  { name: '5-Iron', normalYardage: 190, loft: 24, type: 'iron' },
  { name: '6-Iron', normalYardage: 180, loft: 27, type: 'iron' },
  { name: '7-Iron', normalYardage: 170, loft: 31, type: 'iron' },
  { name: '8-Iron', normalYardage: 160, loft: 35, type: 'iron' },
  { name: '9-Iron', normalYardage: 145, loft: 39, type: 'iron' },
  { name: 'PW', normalYardage: 135, loft: 44, type: 'wedge' },
  { name: 'GW', normalYardage: 125, loft: 48, type: 'wedge' },
  { name: 'SW', normalYardage: 110, loft: 54, type: 'wedge' },
  { name: 'LW', normalYardage: 95, loft: 58, type: 'wedge' },
];

export default function ClubRecommendations() {
  const { conditions, adjustments } = useEnvironmental();
  const { formatDistance } = useSettings();
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);

  const getAdjustedYardage = (club: Club) => {
    if (!adjustments) return club.normalYardage;

    // Calculate adjusted yardage based on environmental conditions
    const environmentalFactor = 1 + (adjustments.distanceAdjustment / 100);
    const loftFactor = 1 + (club.loft > 40 ? 0.05 : 0); // Higher lofted clubs are more affected
    
    return Math.round(club.normalYardage * environmentalFactor * loftFactor);
  };

  const getClubRecommendation = (targetYardage: number) => {
    let bestClub = defaultClubs[0];
    let minDiff = Math.abs(getAdjustedYardage(defaultClubs[0]) - targetYardage);

    defaultClubs.forEach(club => {
      const adjustedYardage = getAdjustedYardage(club);
      const diff = Math.abs(adjustedYardage - targetYardage);
      if (diff < minDiff) {
        minDiff = diff;
        bestClub = club;
      }
    });

    return bestClub;
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Club Recommendations</h1>

      {/* Club Selection Grid */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Club</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {defaultClubs.map((club) => (
            <button
              key={club.name}
              onClick={() => setSelectedClub(club)}
              className={`p-3 rounded-xl transition-all duration-300 ${
                selectedClub?.name === club.name 
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <div className="text-sm font-medium">{club.name}</div>
              <div className="text-xs opacity-75">
                {formatDistance(getAdjustedYardage(club))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Club Details */}
      {selectedClub && (
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Club Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400">Normal Distance</div>
              <div className="text-lg font-semibold">
                {formatDistance(selectedClub.normalYardage)}
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400">Adjusted Distance</div>
              <div className="text-lg font-semibold">
                {formatDistance(getAdjustedYardage(selectedClub))}
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400">Loft</div>
              <div className="text-lg font-semibold">{selectedClub.loft}°</div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400">Club Type</div>
              <div className="text-lg font-semibold capitalize">
                {selectedClub.type}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Environmental Effects */}
      {conditions && adjustments && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Playing Conditions</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                <span>Distance Effect</span>
              </div>
              <span className={`font-semibold ${adjustments.distanceAdjustment >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {adjustments.distanceAdjustment >= 0 ? '+' : ''}
                {adjustments.distanceAdjustment.toFixed(1)}%
              </span>
            </div>
            {Math.abs(adjustments.trajectoryShift) > 0 && (
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <Wind className="w-5 h-5 text-blue-400" />
                  <span>Wind Effect</span>
                </div>
                <span className="font-semibold">
                  {Math.abs(adjustments.trajectoryShift).toFixed(1)} yards 
                  {adjustments.trajectoryShift > 0 ? ' right' : ' left'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 