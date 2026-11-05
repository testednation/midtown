import * as THREE from 'three';
import { VehicleConfig, DestructibleProp } from '../types';
import { CityEnvironment } from '../models/cityBuilder';
import { soundManager } from '../audio/soundManager';

export interface VehiclePhysicsState {
  x: number;
  y: number;
  z: number;
  speed: number;           // in meters/second (+ forward, - reverse)
  heading: number;         // in radians (yaw)
  pitch: number;           // body tilt forward/back
  roll: number;            // body tilt left/right
  steeringAngle: number;   // front wheels yaw
  angularVelocity: number; // yaw rotation rate
  rpm: number;             // 1000 - 7500
  gear: number | 'R' | 'N';
  damagePercent: number;
  nitroRemaining: number;
  isDrifting: boolean;
  isGrounded: boolean;
  verticalVelocity: number;
  airtime: number;
  lateralG: number;
  distanceTraveledDelta: number;
}

export interface DriveInput {
  throttle: number; // -1 to 1
  steer: number;    // -1 (left) to 1 (right)
  handbrake: boolean;
  nitro: boolean;
}

export class PhysicsEngine {
  private config: VehicleConfig;
  private state: VehiclePhysicsState;
  private city: CityEnvironment;
  private prevThrottle: number = 0;
  private lastBackfireTime: number = 0;
  private lastAirBrakeTime: number = 0;

  constructor(config: VehicleConfig, city: CityEnvironment, startX = 0, startZ = -140) {
    this.config = config;
    this.city = city;
    this.state = {
      x: startX,
      y: 0,
      z: startZ,
      speed: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      steeringAngle: 0,
      angularVelocity: 0,
      rpm: 1000,
      gear: 1,
      damagePercent: 0,
      nitroRemaining: config.stats.nitroCapacity,
      isDrifting: false,
      isGrounded: true,
      verticalVelocity: 0,
      airtime: 0,
      lateralG: 0,
      distanceTraveledDelta: 0,
    };
  }

  public setConfig(config: VehicleConfig) {
    this.config = config;
    this.state.nitroRemaining = config.stats.nitroCapacity;
  }

  public getState(): VehiclePhysicsState {
    return this.state;
  }

  public resetPosition(x = 0, z = -140, heading = 0) {
    this.state.x = x;
    this.state.y = 0;
    this.state.z = z;
    this.state.speed = 0;
    this.state.heading = heading;
    this.state.pitch = 0;
    this.state.roll = 0;
    this.state.steeringAngle = 0;
    this.state.angularVelocity = 0;
    this.state.rpm = 1000;
    this.state.verticalVelocity = 0;
    this.state.airtime = 0;
    this.state.isDrifting = false;
    this.state.isGrounded = true;
  }

  public repairVehicle() {
    this.state.damagePercent = 0;
    this.state.nitroRemaining = this.config.stats.nitroCapacity;
  }

  public update(dt: number, input: DriveInput): {
    speedMph: number;
    rpm: number;
    gear: number | string;
    damagePercent: number;
    isDrifting: boolean;
    hitProp?: DestructibleProp;
    crashSpeed?: number;
    jumpLandingAirtime?: number;
    fellInRiver?: boolean;
    screenShakeIntensity?: number;
  } {
    const s = this.state;
    const stats = this.config.stats;
    const maxSpeedMps = (stats.topSpeedMph * 0.44704) * (input.nitro && s.nitroRemaining > 0 ? 1.25 : 1.0);
    const accelRate = (stats.acceleration / 100) * 16.0;
    const brakeRate = 24.0;
    const friction = 2.4;

    let screenShakeIntensity = 0;

    // 1. Nitro consumption & sound
    const isNitroFiring = input.nitro && s.nitroRemaining > 0 && input.throttle > 0 && s.speed > 2;
    if (isNitroFiring) {
      s.nitroRemaining = Math.max(0, s.nitroRemaining - dt);
      soundManager.setNitroBoost(true);
    } else {
      soundManager.setNitroBoost(false);
    }

    // 2. Mechanical Audio Cues: Backfire, Turbo Blow-off, Air Brakes
    const speedMphRaw = Math.abs(s.speed) * 2.23694;
    const nowMs = Date.now();

    // Throttle lift-off backfire or turbo blow-off
    if (this.prevThrottle > 0.5 && input.throttle <= 0 && speedMphRaw > 40) {
      if (nowMs - this.lastBackfireTime > 1200) {
        this.lastBackfireTime = nowMs;
        if (this.config.id === 'supercar') {
          soundManager.playTurboBlowOff();
        } else {
          soundManager.playExhaustBackfire();
        }
      }
    }

    // Heavy Air Brakes for Bus / Semi Rig
    if ((this.config.id === 'bus' || this.config.id === 'truck') && input.throttle < 0 && speedMphRaw > 15) {
      if (nowMs - this.lastAirBrakeTime > 2500) {
        this.lastAirBrakeTime = nowMs;
        soundManager.playAirBrakesRelease();
      }
    }
    this.prevThrottle = input.throttle;

    // 3. Longitudinal acceleration & braking
    if (input.throttle > 0) {
      if (s.speed < 0) {
        s.speed += brakeRate * dt;
        if (s.speed > 0) s.speed = 0;
      } else {
        const powerFactor = Math.max(0.2, 1.0 - (s.speed / maxSpeedMps) * 0.75);
        const boostMult = isNitroFiring ? 1.8 : 1.0;
        s.speed = Math.min(maxSpeedMps, s.speed + accelRate * powerFactor * boostMult * dt);
      }
    } else if (input.throttle < 0) {
      if (s.speed > 0) {
        const handbrakeExtra = input.handbrake ? 1.6 : 1.0;
        s.speed = Math.max(0, s.speed - brakeRate * handbrakeExtra * dt);
      } else {
        const maxReverseMps = 14.0;
        s.speed = Math.max(-maxReverseMps, s.speed - accelRate * 0.6 * dt);
      }
    } else {
      if (s.speed > 0) {
        s.speed = Math.max(0, s.speed - friction * dt);
      } else if (s.speed < 0) {
        s.speed = Math.min(0, s.speed + friction * dt);
      }
    }

    if (input.handbrake && input.throttle === 0) {
      if (s.speed > 0) s.speed = Math.max(0, s.speed - brakeRate * 0.8 * dt);
      else if (s.speed < 0) s.speed = Math.min(0, s.speed + brakeRate * 0.8 * dt);
    }

    // 4. Steering & Drift Dynamics
    const maxSteerAngle = 0.58;
    const speedRatio = Math.min(Math.abs(s.speed) / 25, 1.0);
    const speedSensitiveLimit = maxSteerAngle * (1.0 - speedRatio * 0.45);
    const targetSteer = input.steer * speedSensitiveLimit;
    s.steeringAngle = THREE.MathUtils.damp(s.steeringAngle, targetSteer, 14, dt);

    const gripThreshold = (stats.handling / 100) * 0.8;
    const isHardTurn = Math.abs(input.steer) > 0.65 && Math.abs(s.speed) > 14;
    s.isDrifting = (input.handbrake && Math.abs(s.speed) > 7) || (isHardTurn && gripThreshold < 0.72);

    const driftSlipFactor = s.isDrifting ? 1.85 : 1.0;
    const turnSensitivity = (stats.handling / 100) * 2.8 * driftSlipFactor;

    if (Math.abs(s.speed) > 0.2) {
      const direction = s.speed >= 0 ? 1 : -1;
      const yawDelta = s.steeringAngle * turnSensitivity * (s.speed / 18) * direction * dt;
      s.heading += yawDelta;
      s.lateralG = (s.speed * s.speed * (s.steeringAngle / 20)) / 9.81;
    } else {
      s.lateralG = 0;
    }

    // Skid audio
    const skidIntensity = s.isDrifting ? Math.min(Math.abs(s.speed) / 20, 1.0) : Math.abs(s.lateralG) > 1.2 ? 0.4 : 0;
    soundManager.setSkidIntensity(skidIntensity);

    // 5. Update Position & Delta
    const moveDist = s.speed * dt;
    s.distanceTraveledDelta = Math.abs(moveDist);
    s.x += Math.sin(s.heading) * moveDist;
    s.z += Math.cos(s.heading) * moveDist;

    // 6. Drawbridge Stunt Jumps & Airborne Gravity Physics
    const isOverCanal = Math.abs(s.z) < 22;
    const nearestRoadX = Math.round(s.x / 104) * 104;
    const isNearStuntBridge = Math.abs(s.x - nearestRoadX) < 12 && (nearestRoadX === 0 || Math.abs(nearestRoadX) === 208);

    // If approaching drawbridge incline ramp at speed
    if (isNearStuntBridge && isOverCanal && s.isGrounded && Math.abs(s.speed) > 12) {
      const rampDistance = 22 - Math.abs(s.z);
      if (rampDistance > 4 && rampDistance < 18) {
        // Vehicle launches into the air!
        s.verticalVelocity = Math.abs(s.speed) * 0.32;
        s.isGrounded = false;
        s.airtime = 0.01;
      }
    }

    let jumpLandingAirtime: number | undefined;

    // Apply airborne vertical velocity and gravity
    if (!s.isGrounded) {
      s.airtime += dt;
      s.y += s.verticalVelocity * dt;
      s.verticalVelocity -= 18 * dt; // Gravity

      // Airborne rotation roll/pitch
      s.pitch = THREE.MathUtils.damp(s.pitch, -s.verticalVelocity * 0.04, 4, dt);

      // Landing check
      if (s.y <= 0) {
        s.y = 0;
        s.isGrounded = true;
        s.verticalVelocity = 0;
        jumpLandingAirtime = s.airtime;

        // Big stunt landing!
        if (s.airtime > 0.4) {
          soundManager.playSuspensionLandThud();
          screenShakeIntensity = Math.min(s.airtime * 0.8, 1.0);
          soundManager.triggerVoiceCallout('cabbie', Math.random() > 0.5 ? "Check that airtime!" : "Hold on to your coffee!");
        }
        s.airtime = 0;
      }
    } else {
      s.y = 0;
    }

    // 7. Suspension Pitch & Roll Kinematics
    if (s.isGrounded) {
      const targetPitch = (input.throttle * -0.06 * (s.speed >= 0 ? 1 : -1)) + (input.throttle < 0 && s.speed > 5 ? 0.08 : 0);
      s.pitch = THREE.MathUtils.damp(s.pitch, targetPitch, 8, dt);

      const targetRoll = -s.steeringAngle * Math.min(Math.abs(s.speed) / 15, 1.2) * 0.12;
      s.roll = THREE.MathUtils.damp(s.roll, targetRoll, 8, dt);
    }

    // 8. Transmission & RPM Simulation
    const speedMph = Math.abs(s.speed) * 2.23694;
    if (s.speed < -0.5) {
      s.gear = 'R';
      s.rpm = 1000 + (Math.abs(speedMph) / 30) * 4500;
    } else if (speedMph < 0.5) {
      s.gear = 'N';
      s.rpm = input.throttle > 0 ? 4500 : 1000;
    } else {
      const gearRatios = [25, 50, 80, 120, 220];
      let currGear = 1;
      let prevThreshold = 0;
      for (let g = 0; g < gearRatios.length; g++) {
        if (speedMph <= gearRatios[g] || g === gearRatios.length - 1) {
          currGear = g + 1;
          const range = gearRatios[g] - prevThreshold;
          const progress = Math.min((speedMph - prevThreshold) / range, 1.0);
          s.rpm = 2200 + progress * 5200;
          break;
        }
        prevThreshold = gearRatios[g];
      }
      s.gear = currGear;
    }

    soundManager.updateEngine(
      (s.rpm - 1000) / 6500,
      input.throttle,
      speedMph,
      this.config.engineSoundProfile.baseFreq,
      this.config.engineSoundProfile.maxFreq
    );

    // 9. Collision Detection: Solid City Buildings
    const carW = this.config.dimensions.width;
    const carL = this.config.dimensions.length;
    const carRadius = Math.max(carW, carL) * 0.5;

    let crashSpeed: number | undefined;

    for (const bld of this.city.buildingColliders) {
      const nearestX = Math.max(bld.minX, Math.min(s.x, bld.maxX));
      const nearestZ = Math.max(bld.minZ, Math.min(s.z, bld.maxZ));
      const dx = s.x - nearestX;
      const dz = s.z - nearestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < carRadius * carRadius) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = carRadius - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        s.x += nx * overlap;
        s.z += nz * overlap;

        const impactSpeed = Math.abs(s.speed) * 2.23694;
        if (impactSpeed > 8) {
          crashSpeed = impactSpeed;
          screenShakeIntensity = Math.min(impactSpeed / 70, 1.2);
          soundManager.playCrash(impactSpeed);

          const armorMitigation = (stats.durability / 100) * 0.6;
          const damageTaken = (impactSpeed / 120) * 25 * (1.0 - armorMitigation);
          s.damagePercent = Math.min(100, s.damagePercent + damageTaken);

          // Cabbie commentary on big crash
          if (impactSpeed > 35) {
            soundManager.triggerVoiceCallout('cabbie', Math.random() > 0.5 ? "Watch the paint job!" : "Hey, I'm drivin' here!");
          }
        }

        s.speed = -s.speed * 0.35;
        break;
      }
    }

    // 10. Collision Detection: Destructible Street Props
    let hitProp: DestructibleProp | undefined;
    for (const prop of this.city.props) {
      if (prop.knocked) continue;
      const dx = s.x - prop.x;
      const dz = s.z - prop.z;
      const dist = Math.hypot(dx, dz);

      if (dist < carRadius + 0.9) {
        prop.knocked = true;
        hitProp = prop;

        const impulse = Math.max(s.speed, 6) * (stats.mass / 2500);
        prop.vx = Math.sin(s.heading) * impulse * (0.8 + Math.random() * 0.4);
        prop.vy = 4 + Math.random() * 5;
        prop.vz = Math.cos(s.heading) * impulse * (0.8 + Math.random() * 0.4);
        prop.rx = (Math.random() - 0.5) * 12;
        prop.ry = (Math.random() - 0.5) * 12;
        prop.rz = (Math.random() - 0.5) * 12;

        // Specific prop original audio!
        if (prop.type === 'hydrant') {
          soundManager.playHydrantGeyser();
        } else if (prop.type === 'barrier') {
          soundManager.playWoodSplinter();
        } else if (prop.type === 'lamppost') {
          soundManager.playGlassShatter();
          soundManager.playCrash(25);
        } else if (prop.type === 'trashcan') {
          soundManager.playTrashCanClatter();
        } else {
          soundManager.playCrash(Math.min(speedMph, 30));
        }

        screenShakeIntensity = 0.25;

        // Cabbie one-liner on prop destruction
        if (Math.random() < 0.25) {
          soundManager.triggerVoiceCallout('cabbie');
        }

        const slowdownFactor = Math.max(0.02, 0.25 - (stats.mass / 10000));
        s.speed *= (1.0 - slowdownFactor);
        break;
      }
    }

    // 11. Update Knocked Props Physics (fly and bounce)
    for (const prop of this.city.props) {
      if (!prop.knocked) continue;
      if (prop.y <= 0.28 && Math.abs(prop.vx) < 0.1 && Math.abs(prop.vz) < 0.1) continue;

      prop.x += prop.vx * dt;
      prop.y += prop.vy * dt;
      prop.z += prop.vz * dt;

      prop.vy -= 18 * dt;

      if (prop.y < 0.28) {
        prop.y = 0.28;
        prop.vy = -prop.vy * 0.4;
        prop.vx *= 0.7;
        prop.vz *= 0.7;
      }

      const pMesh = this.city.propMeshes.get(prop.id);
      if (pMesh) {
        pMesh.position.set(prop.x, prop.y, prop.z);
        pMesh.rotation.x += prop.rx * dt;
        pMesh.rotation.y += prop.ry * dt;
        pMesh.rotation.z += prop.rz * dt;
      }
    }

    // 12. River Canal Hazard
    let fellInRiver = false;
    const isWaterZ = Math.abs(s.z) < 20;
    const bridgeX = Math.round(s.x / 104) * 104;
    const isOnBridge = Math.abs(s.x - bridgeX) < 12;

    if (isWaterZ && !isOnBridge && s.y <= 0.2) {
      fellInRiver = true;
      soundManager.playCrash(40);
      s.damagePercent = Math.min(100, s.damagePercent + 15);
      screenShakeIntensity = 0.8;
      soundManager.triggerVoiceCallout('cabbie', "Whoa! Took a swim in the river!");
      this.resetPosition(bridgeX, -30, 0);
    }

    // City Boundary Clamp
    const b = this.city.cityBounds;
    if (s.x < b.minX) { s.x = b.minX; s.speed = 0; }
    if (s.x > b.maxX) { s.x = b.maxX; s.speed = 0; }
    if (s.z < b.minZ) { s.z = b.minZ; s.speed = 0; }
    if (s.z > b.maxZ) { s.z = b.maxZ; s.speed = 0; }

    return {
      speedMph,
      rpm: s.rpm,
      gear: s.gear,
      damagePercent: Math.round(s.damagePercent),
      isDrifting: s.isDrifting,
      hitProp,
      crashSpeed,
      jumpLandingAirtime,
      fellInRiver,
      screenShakeIntensity,
    };
  }
}
