// PGA Tour averages from Trackman
export interface ClubData {
  name: string;
  ballSpeed: number;  // mph
  launchAngle: number;  // degrees
  spinRate: number;  // rpm
  carry: number;  // yards
}

export const clubData: ClubData[] = [
  { name: "Driver", ballSpeed: 171, launchAngle: 10.4, spinRate: 2545, carry: 282 },
  { name: "3-Wood", ballSpeed: 158, launchAngle: 11.2, spinRate: 3275, carry: 255 },
  { name: "5-Wood", ballSpeed: 148, launchAngle: 12.8, spinRate: 3850, carry: 235 },
  { name: "4-Iron", ballSpeed: 139, launchAngle: 14.2, spinRate: 4800, carry: 208 },
  { name: "5-Iron", ballSpeed: 133, launchAngle: 15.0, spinRate: 5400, carry: 195 },
  { name: "6-Iron", ballSpeed: 127, launchAngle: 15.6, spinRate: 6200, carry: 183 },
  { name: "7-Iron", ballSpeed: 123, launchAngle: 16.1, spinRate: 7123, carry: 176 },
  { name: "8-Iron", ballSpeed: 118, launchAngle: 17.8, spinRate: 7700, carry: 165 },
  { name: "9-Iron", ballSpeed: 113, launchAngle: 19.2, spinRate: 8300, carry: 154 },
  { name: "PW", ballSpeed: 108, launchAngle: 21.5, spinRate: 9000, carry: 140 },
];
