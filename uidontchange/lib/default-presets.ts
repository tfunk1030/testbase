import { ShotPreset } from './preset-context';

export const DEFAULT_PRESETS: ShotPreset[] = [
  // Driver Presets
  {
    id: 'driver-power',
    name: 'Power Driver',
    distance: 280,
    height: 35,
    spin: 2200,
    launchAngle: 11.5,
    clubType: 'driver'
  },
  {
    id: 'driver-control',
    name: 'Control Driver',
    distance: 260,
    height: 32,
    spin: 2800,
    launchAngle: 10.5,
    clubType: 'driver'
  },
  {
    id: 'driver-draw',
    name: 'Draw Driver',
    distance: 270,
    height: 33,
    spin: 2500,
    launchAngle: 11,
    clubType: 'driver'
  },
  
  // Woods
  {
    id: '3-wood-standard',
    name: '3-Wood Standard',
    distance: 245,
    height: 30,
    spin: 3200,
    launchAngle: 13,
    clubType: '3-wood'
  },
  {
    id: '5-wood-standard',
    name: '5-Wood Standard',
    distance: 230,
    height: 32,
    spin: 3500,
    launchAngle: 14,
    clubType: '5-wood'
  },
  
  // Long Irons
  {
    id: '4-iron-standard',
    name: '4-Iron Standard',
    distance: 200,
    height: 28,
    spin: 4500,
    launchAngle: 15,
    clubType: '4-iron'
  },
  {
    id: '5-iron-standard',
    name: '5-Iron Standard',
    distance: 185,
    height: 29,
    spin: 5000,
    launchAngle: 16,
    clubType: '5-iron'
  },
  
  // Mid Irons
  {
    id: '7-iron-standard',
    name: '7-Iron Standard',
    distance: 165,
    height: 31,
    spin: 6000,
    launchAngle: 17,
    clubType: '7-iron'
  },
  {
    id: '7-iron-high',
    name: '7-Iron High Flight',
    distance: 160,
    height: 35,
    spin: 6500,
    launchAngle: 19,
    clubType: '7-iron'
  },
  
  // Short Irons
  {
    id: '9-iron-standard',
    name: '9-Iron Standard',
    distance: 145,
    height: 33,
    spin: 7000,
    launchAngle: 20,
    clubType: '9-iron'
  },
  
  // Wedges
  {
    id: 'pw-full',
    name: 'PW Full Shot',
    distance: 135,
    height: 34,
    spin: 7500,
    launchAngle: 22,
    clubType: 'pw'
  },
  {
    id: 'pw-control',
    name: 'PW Control Shot',
    distance: 125,
    height: 32,
    spin: 8000,
    launchAngle: 24,
    clubType: 'pw'
  },
  {
    id: 'sw-full',
    name: 'SW Full Shot',
    distance: 110,
    height: 36,
    spin: 8500,
    launchAngle: 26,
    clubType: 'sw'
  },
  {
    id: 'sw-finesse',
    name: 'SW Finesse Shot',
    distance: 90,
    height: 34,
    spin: 9000,
    launchAngle: 28,
    clubType: 'sw'
  },
  
  // Specialty Shots
  {
    id: 'low-runner',
    name: 'Low Runner',
    distance: 220,
    height: 25,
    spin: 2000,
    launchAngle: 8,
    clubType: 'driver'
  },
  {
    id: 'high-soft',
    name: 'High Soft Landing',
    distance: 150,
    height: 38,
    spin: 7500,
    launchAngle: 24,
    clubType: '7-iron'
  },
  {
    id: 'punch-shot',
    name: 'Punch Shot',
    distance: 160,
    height: 20,
    spin: 4000,
    launchAngle: 12,
    clubType: '5-iron'
  },
  {
    id: 'flop-shot',
    name: 'Flop Shot',
    distance: 60,
    height: 40,
    spin: 10000,
    launchAngle: 32,
    clubType: 'lw'
  }
];
