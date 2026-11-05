export type VehicleId = 
  | 'cruiser'
  | 'taxi'
  | 'muscle'
  | 'supercar'
  | 'bus'
  | 'police'
  | 'truck';

export interface VehicleStats {
  topSpeedMph: number;     // Max speed in MPH (e.g. 95 - 190)
  acceleration: number;    // 0-100 rating
  handling: number;        // Grip & turn sharpness rating (0-100)
  durability: number;      // Armor against crashes (0-100)
  mass: number;            // Weight in kg (affects ramming & collisions)
  nitroCapacity: number;   // Boost seconds
}

export interface VehicleConfig {
  id: VehicleId;
  name: string;
  subtitle: string;
  description: string;
  category: 'Compact' | 'Sedan' | 'Muscle' | 'Exotic' | 'Heavy' | 'Emergency' | 'Rig';
  stats: VehicleStats;
  defaultColor: string;
  availableColors: string[];
  dimensions: {
    width: number;
    height: number;
    length: number;
    wheelRadius: number;
    wheelWidth: number;
  };
  engineSoundProfile: {
    baseFreq: number;
    maxFreq: number;
    type: OscillatorType;
    cylinderPulsing: number;
  };
}

export type GameMode = 'cruise' | 'blitz' | 'pursuit';

export interface Checkpoint {
  x: number;
  z: number;
  radius: number;
  passed: boolean;
}

export interface GameState {
  mode: GameMode;
  selectedVehicleId: VehicleId;
  vehicleColor: string;
  isDriving: boolean;
  score: number;
  speedMph: number;
  rpm: number;
  gear: number | string;
  damagePercent: number;
  nitroRemaining: number;
  isNitroActive: boolean;
  heatLevel: number; // 0 to 5 for police pursuit
  blitzTimeRemaining: number;
  blitzTotalCheckpoints: number;
  blitzCurrentCheckpoint: number;
  isGameOver: boolean;
  gameOverReason?: 'wrecked' | 'busted' | 'victory' | 'time_out';
}

export type CameraView = 'chase_far' | 'chase_close' | 'hood' | 'orbit';

export interface DestructibleProp {
  id: number;
  type: 'hydrant' | 'lamppost' | 'trashcan' | 'barrier' | 'mailbox';
  x: number;
  y: number;
  z: number;
  knocked: boolean;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
}
