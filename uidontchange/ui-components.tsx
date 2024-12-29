import React, { useState } from 'react';

interface Club {
  name: string;
  distance: number;
}

interface ShotData {
  distance: number;
  adjustedDistance: number;
  suggestedClub: string;
  trajectory: string;
}

export const ClubDistanceSelector = () => {
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [shotData, setShotData] = useState<ShotData>({
    distance: 0,
    adjustedDistance: 0,
    suggestedClub: '',
    trajectory: ''
  });
  
  const clubs: Club[] = [
    { name: 'Driver', distance: 250 },
    { name: '3-Wood', distance: 230 },
    { name: '5-Wood', distance: 215 },
    { name: '4-Iron', distance: 200 },
    { name: '5-Iron', distance: 190 },
    { name: '6-Iron', distance: 180 },
    { name: '7-Iron', distance: 170 },
    { name: '8-Iron', distance: 160 },
    { name: '9-Iron', distance: 145 },
    { name: 'PW', distance: 135 },
    { name: 'GW', distance: 125 },
    { name: 'SW', distance: 110 },
    { name: 'LW', distance: 95 },
  ];

  const handleClubSelect = (club: Club) => {
    setSelectedClub(club);
    setShotData({
      distance: club.distance,
      adjustedDistance: Math.round(club.distance * 1.05),
      suggestedClub: club.name,
      trajectory: 'mid'
    });
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl">
      <h2 className="text-xl font-bold text-white mb-4">Select Club</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {clubs.map((club) => (
          <button
            key={club.name}
            onClick={() => handleClubSelect(club)}
            className={`p-3 rounded-xl transition-all duration-300 ${
              selectedClub?.name === club.name 
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <div className="text-sm font-medium">{club.name}</div>
            <div className="text-xs opacity-75">{club.distance} yds</div>
          </button>
        ))}
      </div>

      {selectedClub && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Adjusted Distance</div>
            <div className="text-lg font-semibold text-white">
              {shotData.adjustedDistance} yds
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Trajectory</div>
            <div className="text-lg font-semibold text-white capitalize">
              {shotData.trajectory}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default { ClubDistanceSelector };
