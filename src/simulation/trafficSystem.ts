import * as THREE from 'three';
import { VEHICLE_LIST } from '../data/vehicles';
import { buildVehicleMesh, VehicleMeshBundle, updateVehicleWheelVisuals } from '../models/vehicleBuilder';
import { soundManager } from '../audio/soundManager';

export interface TrafficCar {
  id: number;
  meshBundle: VehicleMeshBundle;
  x: number;
  z: number;
  heading: number;
  speed: number;
  targetSpeed: number;
  isPolice: boolean;
  isSirenOn?: boolean;
}

export interface Pedestrian {
  id: number;
  mesh: THREE.Group;
  x: number;
  z: number;
  heading: number;
  isDiving: boolean;
  diveProgress: number;
}

export class TrafficSystem {
  public cars: TrafficCar[] = [];
  public pedestrians: Pedestrian[] = [];
  private scene: THREE.Object3D;
  private roadCoords: number[] = [-208, -104, 0, 104, 208];

  constructor(scene: THREE.Object3D, numCars = 14, numPedestrians = 16) {
    this.scene = scene;
    this.spawnTraffic(numCars);
    this.spawnPedestrians(numPedestrians);
  }

  private spawnTraffic(count: number) {
    const civilianConfigs = VEHICLE_LIST.filter(v => v.id === 'cruiser' || v.id === 'taxi' || v.id === 'muscle');

    for (let i = 0; i < count; i++) {
      const cfg = civilianConfigs[i % civilianConfigs.length];
      const meshBundle = buildVehicleMesh(cfg);

      // Place randomly on city road lanes
      const isNS = Math.random() > 0.5;
      const roadCoord = this.roadCoords[Math.floor(Math.random() * this.roadCoords.length)];
      const laneOffset = (Math.random() > 0.5 ? 1 : -1) * 6; // 6m lane offset from center
      const posAlongRoad = (Math.random() - 0.5) * 380;

      const x = isNS ? roadCoord + laneOffset : posAlongRoad;
      const z = isNS ? posAlongRoad : roadCoord + laneOffset;
      const heading = isNS ? (laneOffset > 0 ? 0 : Math.PI) : (laneOffset > 0 ? Math.PI / 2 : -Math.PI / 2);

      meshBundle.group.position.set(x, 0, z);
      meshBundle.group.rotation.y = heading;
      this.scene.add(meshBundle.group);

      this.cars.push({
        id: i,
        meshBundle,
        x,
        z,
        heading,
        speed: 8 + Math.random() * 6,
        targetSpeed: 10 + Math.random() * 6,
        isPolice: false,
      });
    }
  }

  public spawnPoliceSquad(count = 2) {
    const policeCfg = VEHICLE_LIST.find(v => v.id === 'police')!;
    for (let i = 0; i < count; i++) {
      const meshBundle = buildVehicleMesh(policeCfg);
      meshBundle.materials.paint.color.set(0x09090b);

      // Spawn behind or ahead of player on road
      const x = (Math.random() - 0.5) * 160;
      const z = (Math.random() - 0.5) * 160;

      meshBundle.group.position.set(x, 0, z);
      this.scene.add(meshBundle.group);

      this.cars.push({
        id: 1000 + i,
        meshBundle,
        x,
        z,
        heading: 0,
        speed: 18,
        targetSpeed: 28,
        isPolice: true,
        isSirenOn: true,
      });
    }
  }

  private spawnPedestrians(count: number) {
    // Procedural Pedestrian: torso + head + limbs
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.6 });

    for (let i = 0; i < count; i++) {
      const pGroup = new THREE.Group();

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
      torso.position.y = 0.95;

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), skinMat);
      head.position.y = 1.45;

      // Legs
      const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2);
      const legL = new THREE.Mesh(legGeo, bodyMat);
      legL.position.set(-0.14, 0.3, 0);
      const legR = legL.clone();
      legR.position.x = 0.14;

      pGroup.add(torso, head, legL, legR);

      // Position on sidewalk
      const rx = this.roadCoords[Math.floor(Math.random() * this.roadCoords.length)] + 14;
      const rz = (Math.random() - 0.5) * 360;

      pGroup.position.set(rx, 0.28, rz);
      this.scene.add(pGroup);

      this.pedestrians.push({
        id: i,
        mesh: pGroup,
        x: rx,
        z: rz,
        heading: Math.random() * Math.PI * 2,
        isDiving: false,
        diveProgress: 0,
      });
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerZ: number,
    playerSpeedMph: number,
    isPursuitMode: boolean
  ): {
    playerHitCar: boolean;
    bustedTimerProgress?: number;
    policeNearCount: number;
  } {
    let playerHitCar = false;
    let policeNearCount = 0;

    // 1. Update Traffic & Police AI
    for (const car of this.cars) {
      if (car.isPolice && isPursuitMode) {
        // Pursuit AI: Turn towards player
        const dx = playerX - car.x;
        const dz = playerZ - car.z;
        const distToPlayer = Math.hypot(dx, dz);
        const desiredHeading = Math.atan2(dx, dz);

        // Turn towards player smoothly
        let angleDiff = desiredHeading - car.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        car.heading += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.2 * dt);
        car.speed = Math.min(car.speed + 12 * dt, car.targetSpeed);

        if (distToPlayer < 25) {
          policeNearCount++;
        }
      } else {
        // Standard ambient lane cruise
        car.speed = car.targetSpeed;

        // Wrap around city limits so traffic is perpetual
        if (car.x > 260) car.x = -260;
        if (car.x < -260) car.x = 260;
        if (car.z > 260) car.z = -260;
        if (car.z < -260) car.z = 260;
      }

      // Move forward along heading
      const dist = car.speed * dt;
      car.x += Math.sin(car.heading) * dist;
      car.z += Math.cos(car.heading) * dist;

      car.meshBundle.group.position.set(car.x, 0, car.z);
      car.meshBundle.group.rotation.y = car.heading;

      updateVehicleWheelVisuals(car.meshBundle, 0, dist);

      // Check collision with player vehicle
      const distToPlayer = Math.hypot(playerX - car.x, playerZ - car.z);
      if (distToPlayer < 3.2) {
        playerHitCar = true;
        soundManager.playCrash(Math.max(playerSpeedMph, 35));

        // Shove ambient traffic car away with kinetic impulse
        car.x += Math.sin(car.heading + Math.PI / 2) * 4;
        car.speed *= 0.2;

        if (Math.random() < 0.4) {
          soundManager.triggerVoiceCallout('cabbie', Math.random() > 0.5 ? "Nice blinker, buddy!" : "Get outta the street!");
        }
      }
    }

    // 2. Pedestrian Midtown Madness Reaction (Dive sideways + scream!)
    for (const ped of this.pedestrians) {
      const dx = playerX - ped.x;
      const dz = playerZ - ped.z;
      const distToPlayer = Math.hypot(dx, dz);

      if (distToPlayer < 12 && !ped.isDiving && playerSpeedMph > 10) {
        // Trigger comical dive out of the way!
        ped.isDiving = true;
        ped.diveProgress = 0;
        soundManager.triggerVoiceCallout('pedestrian');
      }

      if (ped.isDiving) {
        ped.diveProgress += dt * 3.5;
        // Dive arc sideways
        ped.mesh.position.y = 0.28 + Math.sin(ped.diveProgress * Math.PI) * 0.8;
        ped.mesh.rotation.z = Math.sin(ped.diveProgress * Math.PI) * 1.4;

        if (ped.diveProgress >= 1.0) {
          ped.isDiving = false;
          ped.mesh.position.y = 0.28;
          ped.mesh.rotation.z = 0;
        }
      }
    }

    return {
      playerHitCar,
      policeNearCount,
    };
  }

  public dispose() {
    for (const car of this.cars) {
      this.scene.remove(car.meshBundle.group);
    }
    for (const ped of this.pedestrians) {
      this.scene.remove(ped.mesh);
    }
    this.cars = [];
    this.pedestrians = [];
  }
}
