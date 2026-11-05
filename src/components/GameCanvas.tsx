import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameMode, VehicleConfig, CameraView, VehicleId } from '../types';
import { getVehicleConfig } from '../data/vehicles';
import { buildVehicleMesh, VehicleMeshBundle, updateVehicleWheelVisuals } from '../models/vehicleBuilder';
import { buildChicagoCity, CityEnvironment } from '../models/cityBuilder';
import { PhysicsEngine, DriveInput } from '../simulation/physicsEngine';
import { TrafficSystem } from '../simulation/trafficSystem';
import { ParticleManager } from '../simulation/particles';
import { SkidMarkManager } from '../simulation/skidMarks';
import { soundManager } from '../audio/soundManager';
import { GameHUD } from './GameHUD';

interface GameCanvasProps {
  vehicleId: VehicleId;
  vehicleColor: string;
  gameMode: GameMode;
  onReturnToMenu: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  vehicleId,
  vehicleColor,
  gameMode,
  onReturnToMenu,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const vehicleConfig = getVehicleConfig(vehicleId);

  // HUD State
  const [speedMph, setSpeedMph] = useState(0);
  const [rpm, setRpm] = useState(1000);
  const [gear, setGear] = useState<number | string>(1);
  const [damagePercent, setDamagePercent] = useState(0);
  const [nitroRemaining, setNitroRemaining] = useState(vehicleConfig.stats.nitroCapacity);
  const [isNitroActive, setIsNitroActive] = useState(false);
  const [cameraView, setCameraView] = useState<CameraView>('chase_far');
  const [playerPos, setPlayerPos] = useState({ x: 0, z: -140, heading: 0 });
  const [score, setScore] = useState(0);
  const [currentCheckpointIdx, setCurrentCheckpointIdx] = useState(0);
  const [blitzTimeRemaining, setBlitzTimeRemaining] = useState(60);
  const [policeNearCount, setPoliceNearCount] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<'wrecked' | 'busted' | 'victory' | 'time_out' | undefined>();

  // Engine refs
  const physicsEngineRef = useRef<PhysicsEngine | null>(null);
  const trafficSystemRef = useRef<TrafficSystem | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const skidMarkManagerRef = useRef<SkidMarkManager | null>(null);
  const cityEnvRef = useRef<CityEnvironment | null>(null);
  const vehicleBundleRef = useRef<VehicleMeshBundle | null>(null);
  const isSirenOnRef = useRef(false);
  const cameraShakeRef = useRef(0);

  // Touch & Key Inputs
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const touchInputRef = useRef<{ throttle: number; steer: number; handbrake: boolean; nitro: boolean }>({
    throttle: 0,
    steer: 0,
    handbrake: false,
    nitro: false,
  });

  // Reusable vectors for camera
  const _camTarget = useRef(new THREE.Vector3());
  const _camPos = useRef(new THREE.Vector3());

  // Reset Car Action
  const handleResetCar = useCallback(() => {
    if (physicsEngineRef.current) {
      physicsEngineRef.current.resetPosition(0, -140, 0);
      soundManager.playMenuClick();
      soundManager.triggerVoiceCallout('cabbie', "Back on four wheels!");
    }
  }, []);

  // Repair Car Action
  const handleRepairCar = useCallback(() => {
    if (physicsEngineRef.current) {
      physicsEngineRef.current.repairVehicle();
      setDamagePercent(0);
      setNitroRemaining(vehicleConfig.stats.nitroCapacity);
      soundManager.playCheckpointChime();
      soundManager.triggerVoiceCallout('cabbie', "Good as new, baby!");
    }
  }, [vehicleConfig]);

  // Honk Horn Action
  const handleHonk = useCallback(() => {
    const isHeavy = vehicleConfig.id === 'bus' || vehicleConfig.id === 'truck';
    soundManager.playHorn(isHeavy);
    if (Math.random() < 0.4) {
      soundManager.triggerVoiceCallout('cabbie', Math.random() > 0.5 ? "Move it or lose it!" : "Get outta the street!");
    }
  }, [vehicleConfig]);

  // Siren Action
  const handleToggleSiren = useCallback(() => {
    const active = soundManager.togglePoliceSiren();
    isSirenOnRef.current = active;
  }, []);

  // Restart Mode Action
  const handleRestartMode = useCallback(() => {
    setIsGameOver(false);
    setGameOverReason(undefined);
    setScore(0);
    setCurrentCheckpointIdx(0);
    setBlitzTimeRemaining(60);
    if (physicsEngineRef.current) {
      physicsEngineRef.current.resetPosition(0, -140, 0);
      physicsEngineRef.current.repairVehicle();
    }
    soundManager.playMenuClick();
  }, []);

  // Set camera view
  const handleSetCameraView = useCallback((view: CameraView) => {
    setCameraView(view);
    soundManager.playMenuClick();
  }, []);

  // Keyboard Event Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;

      // Single trigger actions
      if (e.code === 'KeyR') {
        handleResetCar();
      } else if (e.code === 'KeyH') {
        handleHonk();
      } else if (e.code === 'KeyC') {
        setCameraView(prev => {
          const views: CameraView[] = ['chase_far', 'chase_close', 'hood', 'orbit'];
          const nextIdx = (views.indexOf(prev) + 1) % views.length;
          return views[nextIdx];
        });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleResetCar, handleHonk]);

  // Main 3D Simulation Setup
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Software WebGL Detection per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Midtown twilight sky
    scene.fog = new THREE.FogExp2(0x0f172a, 0.0055); // Horizon atmospheric fog

    // Mandatory RoomEnvironment Studio reflection per Three.js skill
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.2, 800);
    camera.position.set(0, 4, -148);

    // Warm Key Sun Light + Cool Hemisphere Fill
    const sunLight = new THREE.DirectionalLight(0xfff1db, 2.0);
    sunLight.position.set(120, 180, 80);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    const d = 120;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.7);
    scene.add(hemiLight);

    // Build Chicago City Environment
    const city = buildChicagoCity();
    scene.add(city.sceneGroup);
    cityEnvRef.current = city;

    // Build Player Vehicle
    const vehicleBundle = buildVehicleMesh(vehicleConfig, vehicleColor);
    scene.add(vehicleBundle.group);
    vehicleBundleRef.current = vehicleBundle;

    // Initialize Physics Engine
    const physics = new PhysicsEngine(vehicleConfig, city, 0, -140);
    physicsEngineRef.current = physics;

    // Initialize City Traffic System & Police Pursuit Squad
    const traffic = new TrafficSystem(scene, 14, 16);
    if (gameMode === 'pursuit') {
      traffic.spawnPoliceSquad(3);
    }
    trafficSystemRef.current = traffic;

    // Initialize Particle Systems (Drift smoke, crash sparks, water geysers, splinters, shards)
    const particles = new ParticleManager(scene);
    particleManagerRef.current = particles;

    // Initialize Persistent Tire Skid Mark Ribbon Manager
    const skidMarks = new SkidMarkManager(scene);
    skidMarkManagerRef.current = skidMarks;

    // Start Procedural Audio Engine
    soundManager.startEngine(
      vehicleConfig.engineSoundProfile.type,
      vehicleConfig.engineSoundProfile.baseFreq
    );

    // Initial voice greeting based on mode
    setTimeout(() => {
      if (gameMode === 'pursuit') {
        soundManager.triggerVoiceCallout('cop', "All units, we have a 10-43 in progress in Midtown!");
      } else if (gameMode === 'blitz') {
        soundManager.triggerVoiceCallout('announcer', "Ready, set, GO!");
      } else {
        soundManager.triggerVoiceCallout('cabbie', "Let's see what this baby can do!");
      }
    }, 800);

    // Window Resize Handler
    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Game loop variables
    let frameId = 0;
    const clock = new THREE.Clock();
    let lTrainX = -200;
    let blitzTime = 60;
    let localScore = 0;
    let currentCp = 0;
    let bustedTimer = 0;
    let isTerminated = false;
    let copChatterTimer = 0;

    // Software WebGL pacing helper per Three.js skill
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    // MAIN SIMULATION TICK
    function tick() {
      const dt = Math.min(clock.getDelta(), 0.05);

      // Collect inputs from Keyboard & Touch
      const keys = keysRef.current;
      const touch = touchInputRef.current;

      let throttle = touch.throttle;
      if (keys['KeyW'] || keys['ArrowUp']) throttle = 1;
      if (keys['KeyS'] || keys['ArrowDown']) throttle = -1;

      let steer = touch.steer;
      if (keys['KeyA'] || keys['ArrowLeft']) steer = -1;
      if (keys['KeyD'] || keys['ArrowRight']) steer = 1;

      const handbrake = Boolean(keys['Space'] || touch.handbrake);
      const nitro = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || touch.nitro);

      const driveInput: DriveInput = { throttle, steer, handbrake, nitro };

      // Update Physics
      const physResult = physics.update(dt, driveInput);
      const pState = physics.getState();

      // Screen camera shake triggering
      if (physResult.screenShakeIntensity && physResult.screenShakeIntensity > 0) {
        cameraShakeRef.current = Math.max(cameraShakeRef.current, physResult.screenShakeIntensity);
      }

      // 1. Persistent Tire Skid Marks & Drift Smoke
      const isBurningRubber = (pState.isDrifting && Math.abs(pState.speed) > 4) ||
                              (driveInput.throttle > 0 && Math.abs(pState.speed) < 3.5 && driveInput.handbrake);

      if (isBurningRubber) {
        const trackW = vehicleConfig.dimensions.width * 0.85;
        const rearWheelOffset = vehicleConfig.dimensions.length * 0.35;
        const cosH = Math.cos(pState.heading);
        const sinH = Math.sin(pState.heading);

        const centerRearX = pState.x - sinH * rearWheelOffset;
        const centerRearZ = pState.z - cosH * rearWheelOffset;

        const lx = centerRearX - cosH * (trackW / 2);
        const lz = centerRearZ + sinH * (trackW / 2);

        const rx = centerRearX + cosH * (trackW / 2);
        const rz = centerRearZ - sinH * (trackW / 2);

        skidMarks.addSkidPair(lx, lz, rx, rz, pState.heading);
        particles.emitDriftSmoke(centerRearX, 0.1, centerRearZ, 2);
      } else {
        skidMarks.breakStreak();
      }

      // 2. Crash Sparks on hard hit
      if (physResult.crashSpeed && physResult.crashSpeed > 20) {
        particles.emitCrashSparks(pState.x, 0.6, pState.z, 22);
        localScore += Math.round(physResult.crashSpeed * 5);
      }

      // 3. Destructible Prop Specific Splinters & Shards
      if (physResult.hitProp) {
        const hp = physResult.hitProp;
        if (hp.type === 'barrier') {
          particles.emitWoodSplinters(hp.x, hp.y, hp.z, 22);
          localScore += 300;
        } else if (hp.type === 'lamppost') {
          particles.emitGlassShards(hp.x, hp.y, hp.z, 24);
          particles.emitCrashSparks(hp.x, hp.y, hp.z, 15);
          localScore += 450;
        } else if (hp.type === 'hydrant') {
          localScore += 500;
        } else {
          localScore += 200;
        }
      }

      // Active water fountains for knocked hydrants
      for (const prop of city.props) {
        if (prop.knocked && prop.type === 'hydrant') {
          particles.emitHydrantWater(prop.x, prop.z, 5);
        }
      }

      // 4. Engine Damage Smoke if heavily damaged
      if (pState.damagePercent > 65) {
        const hoodOffset = vehicleConfig.dimensions.length * 0.35;
        const hx = pState.x + Math.sin(pState.heading) * hoodOffset;
        const hz = pState.z + Math.cos(pState.heading) * hoodOffset;
        particles.emitEngineDamageSmoke(hx, 0.8, hz);
      }

      // Update Vehicle 3D Visual Mesh
      vehicleBundle.group.position.set(pState.x, pState.y, pState.z);
      vehicleBundle.group.rotation.set(pState.pitch, pState.heading, pState.roll, 'YXZ');
      updateVehicleWheelVisuals(vehicleBundle, pState.steeringAngle, pState.distanceTraveledDelta);

      // Animate Overhead CTA L-Train
      if (city.lTrainGroup) {
        lTrainX += dt * 32;
        if (lTrainX > 250) lTrainX = -250;
        city.lTrainGroup.position.x = lTrainX;
      }

      // Animate Blitz Checkpoints
      for (let i = 0; i < city.checkpointMeshes.length; i++) {
        const cpMesh = city.checkpointMeshes[i];
        if (cpMesh.visible) {
          cpMesh.rotation.y += dt * 1.8;
          const cp = city.checkpoints[i];
          const dist = Math.hypot(pState.x - cp.x, pState.z - cp.z);
          if (dist < cp.radius) {
            soundManager.playCheckpointChime();
            cpMesh.visible = false;
            localScore += 1000;
            blitzTime += 15;
            currentCp++;

            soundManager.triggerVoiceCallout('announcer', "Checkpoint cleared!");

            if (currentCp >= city.checkpoints.length) {
              soundManager.playVictoryFanfare();
              setIsGameOver(true);
              setGameOverReason('victory');
              soundManager.triggerVoiceCallout('cabbie', "Woohoo! We conquered Chicago!");
            } else if (city.checkpointMeshes[currentCp]) {
              city.checkpointMeshes[currentCp].visible = true;
            }
            setCurrentCheckpointIdx(currentCp);
          }
        }
      }

      // Blitz Mode Countdown
      if (gameMode === 'blitz' && !isTerminated) {
        blitzTime -= dt;
        setBlitzTimeRemaining(blitzTime);
        if (blitzTime <= 0) {
          soundManager.playCrash(50);
          setIsGameOver(true);
          setGameOverReason('time_out');
          isTerminated = true;
          soundManager.triggerVoiceCallout('announcer', "Time expired!");
        }
      }

      // Update City Traffic & Police Pursuit AI
      const trafficResult = traffic.update(
        dt,
        pState.x,
        pState.z,
        physResult.speedMph,
        gameMode === 'pursuit'
      );
      if (trafficResult.playerHitCar) {
        localScore += 250;
      }
      setPoliceNearCount(trafficResult.policeNearCount);

      // Periodic Cop Radio Chatter during pursuit
      if (gameMode === 'pursuit' && !isTerminated) {
        copChatterTimer += dt;
        if (copChatterTimer > 14) {
          copChatterTimer = 0;
          soundManager.triggerVoiceCallout('cop');
        }
      }

      // Cop Pursuit Busted Check
      if (gameMode === 'pursuit' && trafficResult.policeNearCount > 0 && Math.abs(pState.speed) < 2) {
        bustedTimer += dt;
        if (bustedTimer > 3.0 && !isTerminated) {
          soundManager.playCrash(30);
          setIsGameOver(true);
          setGameOverReason('busted');
          isTerminated = true;
          soundManager.triggerVoiceCallout('cop', "Code 4, suspect in custody!");
        }
      } else {
        bustedTimer = Math.max(0, bustedTimer - dt * 2);
      }

      // Totaled / Wrecked Check
      if (pState.damagePercent >= 100 && !isTerminated) {
        soundManager.playCrash(60);
        setIsGameOver(true);
        setGameOverReason('wrecked');
        isTerminated = true;
        soundManager.triggerVoiceCallout('cabbie', "She's totaled, pal!");
      }

      // Update Particles
      particles.update(dt);

      // Camera Follow System (Chase Far, Chase Close, Hood, Orbit)
      const camTarget = _camTarget.current;
      const camPos = _camPos.current;

      const targetX = pState.x;
      const targetY = pState.y + 1.2;
      const targetZ = pState.z;
      camTarget.set(targetX, targetY, targetZ);

      const lookAhead = Math.min(Math.abs(pState.speed) * 0.2, 5);
      const forwardX = Math.sin(pState.heading);
      const forwardZ = Math.cos(pState.heading);

      if (cameraView === 'chase_far') {
        const dist = 7.5;
        const height = 3.2;
        const desiredX = pState.x - forwardX * dist;
        const desiredY = pState.y + height;
        const desiredZ = pState.z - forwardZ * dist;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, 10, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, 10, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, 10, dt);
        camera.lookAt(targetX + forwardX * lookAhead, targetY, targetZ + forwardZ * lookAhead);
      } else if (cameraView === 'chase_close') {
        const dist = 5.2;
        const height = 2.1;
        const desiredX = pState.x - forwardX * dist;
        const desiredY = pState.y + height;
        const desiredZ = pState.z - forwardZ * dist;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, 14, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, 14, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, 14, dt);
        camera.lookAt(targetX + forwardX * (lookAhead + 2), targetY, targetZ + forwardZ * (lookAhead + 2));
      } else if (cameraView === 'hood') {
        const hoodX = pState.x + forwardX * (vehicleConfig.dimensions.length * 0.2);
        const hoodY = pState.y + vehicleConfig.dimensions.height * 0.85;
        const hoodZ = pState.z + forwardZ * (vehicleConfig.dimensions.length * 0.2);

        camera.position.set(hoodX, hoodY, hoodZ);
        camera.lookAt(hoodX + forwardX * 25, hoodY, hoodZ + forwardZ * 25);
      } else {
        const angle = clock.getElapsedTime() * 0.5;
        camera.position.set(targetX + Math.sin(angle) * 8, targetY + 3, targetZ + Math.cos(angle) * 8);
        camera.lookAt(targetX, targetY, targetZ);
      }

      // Apply dynamic camera shake
      if (cameraShakeRef.current > 0.01) {
        camera.position.x += (Math.random() - 0.5) * cameraShakeRef.current * 0.5;
        camera.position.y += (Math.random() - 0.5) * cameraShakeRef.current * 0.5;
        cameraShakeRef.current = THREE.MathUtils.damp(cameraShakeRef.current, 0, 8, dt);
      }

      // Update React HUD state
      setSpeedMph(physResult.speedMph);
      setRpm(physResult.rpm);
      setGear(physResult.gear);
      setDamagePercent(physResult.damagePercent);
      setNitroRemaining(pState.nitroRemaining);
      setIsNitroActive(driveInput.nitro && pState.nitroRemaining > 0);
      setPlayerPos({ x: pState.x, z: pState.z, heading: pState.heading });
      setScore(localScore);

      // Render
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      soundManager.stopEngine();
      soundManager.togglePoliceSiren(false);
      renderer.dispose();
      traffic.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [vehicleConfig, vehicleColor, gameMode]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Interactive HUD Overlay */}
      <GameHUD
        vehicle={vehicleConfig}
        speedMph={speedMph}
        rpm={rpm}
        gear={gear}
        damagePercent={damagePercent}
        nitroRemaining={nitroRemaining}
        isNitroActive={isNitroActive}
        gameMode={gameMode}
        cameraView={cameraView}
        playerPos={playerPos}
        trafficCars={trafficSystemRef.current?.cars || []}
        currentCheckpointIdx={currentCheckpointIdx}
        totalCheckpoints={cityEnvRef.current?.checkpoints.length || 8}
        blitzTimeRemaining={blitzTimeRemaining}
        policeNearCount={policeNearCount}
        isGameOver={isGameOver}
        gameOverReason={gameOverReason}
        score={score}
        onSetCameraView={handleSetCameraView}
        onResetVehicle={handleResetCar}
        onRepairVehicle={handleRepairCar}
        onHonkHorn={handleHonk}
        onToggleSiren={handleToggleSiren}
        onReturnToMenu={onReturnToMenu}
        onRestartMode={handleRestartMode}
        onTouchInput={(input) => {
          touchInputRef.current = input;
        }}
      />
    </div>
  );
};
