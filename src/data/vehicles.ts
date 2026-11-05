import { VehicleConfig } from '../types';

export const VEHICLE_LIST: VehicleConfig[] = [
  {
    id: 'cruiser',
    name: 'City Bug GT',
    subtitle: 'Agile Urban Hatchback',
    description: 'Lightweight, nimble, and effortless to squeeze through tight Chicago alleyways and dense traffic jams.',
    category: 'Compact',
    defaultColor: '#e11d48', // Crimson Red
    availableColors: ['#e11d48', '#2563eb', '#16a34a', '#eab308', '#9333ea', '#f43f5e'],
    stats: {
      topSpeedMph: 110,
      acceleration: 75,
      handling: 94,
      durability: 55,
      mass: 1150,
      nitroCapacity: 10,
    },
    dimensions: {
      width: 1.8,
      height: 1.4,
      length: 3.6,
      wheelRadius: 0.38,
      wheelWidth: 0.28,
    },
    engineSoundProfile: {
      baseFreq: 110,
      maxFreq: 420,
      type: 'triangle',
      cylinderPulsing: 4,
    },
  },
  {
    id: 'taxi',
    name: 'Midtown Checker Cab',
    subtitle: 'The Chicago Street Legend',
    description: 'The definitive Midtown Madness icon. Built like a brick, floats smoothly through corners, and takes endless curb hops.',
    category: 'Sedan',
    defaultColor: '#facc15', // Cab Yellow
    availableColors: ['#facc15', '#f59e0b', '#fbbf24', '#ffffff', '#1e293b'],
    stats: {
      topSpeedMph: 125,
      acceleration: 70,
      handling: 82,
      durability: 80,
      mass: 1750,
      nitroCapacity: 12,
    },
    dimensions: {
      width: 2.0,
      height: 1.5,
      length: 4.8,
      wheelRadius: 0.42,
      wheelWidth: 0.3,
    },
    engineSoundProfile: {
      baseFreq: 95,
      maxFreq: 380,
      type: 'sawtooth',
      cylinderPulsing: 6,
    },
  },
  {
    id: 'muscle',
    name: 'Venom Fastback V8',
    subtitle: 'Pure American Muscle',
    description: 'Raw rear-wheel-drive brute force. High-displacement V8 with tire-smoking burnouts and ferocious straight-line speed.',
    category: 'Muscle',
    defaultColor: '#1d4ed8', // Royal Blue
    availableColors: ['#1d4ed8', '#b91c1c', '#0f172a', '#15803d', '#ea580c'],
    stats: {
      topSpeedMph: 155,
      acceleration: 90,
      handling: 65,
      durability: 72,
      mass: 1600,
      nitroCapacity: 14,
    },
    dimensions: {
      width: 2.1,
      height: 1.35,
      length: 4.7,
      wheelRadius: 0.44,
      wheelWidth: 0.34,
    },
    engineSoundProfile: {
      baseFreq: 80,
      maxFreq: 360,
      type: 'sawtooth',
      cylinderPulsing: 8,
    },
  },
  {
    id: 'supercar',
    name: 'Panoz Apex GT-1',
    subtitle: 'Le Mans Grand Tourer',
    description: 'Fierce aerodynamic downforce and staggering top speed. Demands surgical reflexes on city boulevards.',
    category: 'Exotic',
    defaultColor: '#f97316', // Neon Orange
    availableColors: ['#f97316', '#dc2626', '#10b981', '#06b6d4', '#4f46e5', '#fafafa'],
    stats: {
      topSpeedMph: 195,
      acceleration: 98,
      handling: 96,
      durability: 40,
      mass: 1280,
      nitroCapacity: 15,
    },
    dimensions: {
      width: 2.2,
      height: 1.15,
      length: 4.9,
      wheelRadius: 0.42,
      wheelWidth: 0.36,
    },
    engineSoundProfile: {
      baseFreq: 130,
      maxFreq: 520,
      type: 'sawtooth',
      cylinderPulsing: 10,
    },
  },
  {
    id: 'bus',
    name: 'Chicago Transit 3000',
    subtitle: 'Indomitable City Bus',
    description: 'Massive commuter fortress. Tramples lampposts, shoves police blockades, and sends traffic flying through intersections.',
    category: 'Heavy',
    defaultColor: '#0284c7', // Transit Blue & White
    availableColors: ['#0284c7', '#16a34a', '#d97706', '#dc2626', '#475569'],
    stats: {
      topSpeedMph: 90,
      acceleration: 45,
      handling: 48,
      durability: 100,
      mass: 8800,
      nitroCapacity: 16,
    },
    dimensions: {
      width: 2.6,
      height: 2.8,
      length: 9.5,
      wheelRadius: 0.55,
      wheelWidth: 0.42,
    },
    engineSoundProfile: {
      baseFreq: 55,
      maxFreq: 240,
      type: 'triangle',
      cylinderPulsing: 6,
    },
  },
  {
    id: 'police',
    name: 'Metro Police Interceptor',
    subtitle: 'Heavy Patrol Interceptor',
    description: 'Equipped with heavy-duty bullbar ramming bumper and active dual high-intensity strobe lightbars with piercing siren.',
    category: 'Emergency',
    defaultColor: '#09090b', // Gloss Black & White
    availableColors: ['#09090b', '#1e3a8a'],
    stats: {
      topSpeedMph: 145,
      acceleration: 85,
      handling: 85,
      durability: 88,
      mass: 2050,
      nitroCapacity: 12,
    },
    dimensions: {
      width: 2.1,
      height: 1.55,
      length: 5.0,
      wheelRadius: 0.44,
      wheelWidth: 0.32,
    },
    engineSoundProfile: {
      baseFreq: 90,
      maxFreq: 400,
      type: 'sawtooth',
      cylinderPulsing: 8,
    },
  },
  {
    id: 'truck',
    name: 'Goliath 18-Wheeler Rig',
    subtitle: 'Heavy Highway Tractor',
    description: 'Dual vertical chrome exhaust stacks, thunderous air horns, and immense kinetic punch to flatten roadblocks.',
    category: 'Rig',
    defaultColor: '#b45309', // Amber Bronze
    availableColors: ['#b45309', '#991b1b', '#1e293b', '#065f46', '#312e81'],
    stats: {
      topSpeedMph: 105,
      acceleration: 58,
      handling: 52,
      durability: 96,
      mass: 7500,
      nitroCapacity: 14,
    },
    dimensions: {
      width: 2.7,
      height: 3.4,
      length: 7.8,
      wheelRadius: 0.6,
      wheelWidth: 0.44,
    },
    engineSoundProfile: {
      baseFreq: 50,
      maxFreq: 220,
      type: 'sawtooth',
      cylinderPulsing: 6,
    },
  },
];

export function getVehicleConfig(id: string): VehicleConfig {
  return VEHICLE_LIST.find(v => v.id === id) || VEHICLE_LIST[0];
}
