'use client'

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ClubData {
  name: string;
  distance: number;
  loft: number;
  ballSpeed: number;
  launchAngle: number;
  spinRate: number;
}

const defaultClubs: ClubData[] = [
  { name: 'Driver', distance: 260, loft: 10.5, ballSpeed: 167, launchAngle: 14.2, spinRate: 2800 },
  { name: '3 Wood', distance: 235, loft: 15, ballSpeed: 158, launchAngle: 13.5, spinRate: 3400 },
  { name: '5 Iron', distance: 185, loft: 27, ballSpeed: 138, launchAngle: 17.8, spinRate: 5200 },
  { name: '6 Iron', distance: 175, loft: 30, ballSpeed: 134, launchAngle: 18.5, spinRate: 5600 },
  { name: '7 Iron', distance: 165, loft: 34, ballSpeed: 130, launchAngle: 19.2, spinRate: 6000 },
  { name: '8 Iron', distance: 155, loft: 38, ballSpeed: 126, launchAngle: 20.1, spinRate: 6400 },
  { name: '9 Iron', distance: 145, loft: 42, ballSpeed: 122, launchAngle: 21.0, spinRate: 6800 },
  { name: 'PW', distance: 135, loft: 46, ballSpeed: 118, launchAngle: 22.0, spinRate: 7200 },
  { name: 'GW', distance: 125, loft: 50, ballSpeed: 114, launchAngle: 23.0, spinRate: 7600 },
  { name: 'SW', distance: 115, loft: 56, ballSpeed: 110, launchAngle: 24.0, spinRate: 8000 }
];

const ClubSelection: React.FC = () => {
  const [selectedClub, setSelectedClub] = useState<ClubData | null>(null);
  const [clubs, setClubs] = useState<ClubData[]>(defaultClubs);

  const handleClubSelect = (club: ClubData): void => {
    setSelectedClub(club);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Club Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {clubs.map((club) => (
              <button
                key={club.name}
                onClick={() => handleClubSelect(club)}
                className={`p-4 rounded-lg transition-colors ${
                  selectedClub?.name === club.name
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-100'
                }`}
              >
                <h3 className="text-lg font-semibold">{club.name}</h3>
                <p className="text-sm opacity-80">{club.distance} yards</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedClub && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedClub.name} Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Loft</p>
                <p className="text-2xl font-bold">{selectedClub.loft}°</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Ball Speed</p>
                <p className="text-2xl font-bold">{selectedClub.ballSpeed} mph</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Launch Angle</p>
                <p className="text-2xl font-bold">{selectedClub.launchAngle}°</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Spin Rate</p>
                <p className="text-2xl font-bold">{selectedClub.spinRate} rpm</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Carry Distance</p>
                <p className="text-2xl font-bold">{selectedClub.distance} yards</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClubSelection;
