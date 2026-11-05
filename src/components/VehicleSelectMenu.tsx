import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VEHICLE_LIST, getVehicleConfig } from '../data/vehicles';
import { VehicleConfig, VehicleId, GameMode } from '../types';
import { buildVehicleMesh, VehicleMeshBundle } from '../models/vehicleBuilder';
import { soundManager } from '../audio/soundManager';
import { Gauge, Zap, Shield, Compass, Weight, Play, Volume2, VolumeX, Sparkles, Flag, Siren } from 'lucide-react';

interface VehicleSelectMenuProps {
  onStartGame: (vehicleId: VehicleId, color: string, mode: GameMode) => void;
  initialVehicleId?: VehicleId;
}

export const VehicleSelectMenu: React.FC<VehicleSelectMenuProps> = ({
  onStartGame,
  initialVehicleId = 'taxi',
}) => {
  const [selectedId, setSelectedId] = useState<VehicleId>(initialVehicleId);
  const selectedVehicle = getVehicleConfig(selectedId);
  const [selectedColor, setSelectedColor] = useState<string>(selectedVehicle.defaultColor);
  const [selectedMode, setSelectedMode] = useState<GameMode>('cruise');
  const [isMuted, setIsMuted] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const currentBundleRef = useRef<VehicleMeshBundle | null>(null);
  const turntableGroupRef = useRef<THREE.Group | null>(null);
  const isDraggingRef = useRef(false);
  const prevMouseXRef = useRef(0);

  // When vehicle changes, reset default color
  const handleSelectVehicle = (v: VehicleConfig) => {
    setSelectedId(v.id);
    setSelectedColor(v.defaultColor);
    soundManager.playMenuClick();
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    soundManager.playMenuClick();
    if (currentBundleRef.current) {
      currentBundleRef.current.materials.paint.color.set(color);
    }
  };

  // 3D Turntable scene setup
  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Software WebGL check per Three.js skill
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
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x09090b, 0.015);

    // Studio HDRI reflection per Three.js skill
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.5, 2.2, 5.5);
    camera.lookAt(0, 0.6, 0);

    // Lighting rig: Key light + Rim light + Floor reflection
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.2);
    keyLight.position.set(6, 9, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-6, 4, -6);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x18181b, 0.6);
    scene.add(hemiLight);

    // Studio Turntable Platform
    const turntableGroup = new THREE.Group();
    scene.add(turntableGroup);
    turntableGroupRef.current = turntableGroup;

    // Platform disc
    const discGeo = new THREE.CylinderGeometry(3.6, 3.8, 0.25, 48);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.85,
      roughness: 0.2,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = -0.125;
    disc.receiveShadow = true;
    turntableGroup.add(disc);

    // Glowing perimeter neon ring on turntable
    const neonRingGeo = new THREE.RingGeometry(3.55, 3.65, 48);
    neonRingGeo.rotateX(-Math.PI / 2);
    const neonRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.0,
    });
    const neonRing = new THREE.Mesh(neonRingGeo, neonRingMat);
    neonRing.position.y = 0.01;
    turntableGroup.add(neonRing);

    let vehicleGroupNode: THREE.Group | null = null;

    // Load initial vehicle
    const bundle = buildVehicleMesh(selectedVehicle, selectedColor);
    currentBundleRef.current = bundle;
    vehicleGroupNode = bundle.group;
    turntableGroup.add(vehicleGroupNode);

    // Mouse / Touch drag to spin vehicle
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseXRef.current = e.clientX;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !turntableGroupRef.current) return;
      const deltaX = e.clientX - prevMouseXRef.current;
      prevMouseXRef.current = e.clientX;
      turntableGroupRef.current.rotation.y += deltaX * 0.008;
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Resize handler
    const onResize = () => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Render loop
    let animId = 0;
    const clock = new THREE.Clock();

    function tick() {
      const dt = clock.getDelta();
      // Auto-spin turntable slowly if user is not actively dragging
      if (!isDraggingRef.current && turntableGroupRef.current) {
        turntableGroupRef.current.rotation.y += dt * 0.35;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update vehicle model in 3D scene when selectedId changes
  useEffect(() => {
    if (!turntableGroupRef.current) return;
    const turntable = turntableGroupRef.current;

    // Remove old car mesh
    if (currentBundleRef.current) {
      turntable.remove(currentBundleRef.current.group);
    }

    const newCfg = getVehicleConfig(selectedId);
    const newBundle = buildVehicleMesh(newCfg, selectedColor);
    currentBundleRef.current = newBundle;
    turntable.add(newBundle.group);
  }, [selectedId]);

  const handleLaunch = () => {
    soundManager.playMenuClick();
    onStartGame(selectedId, selectedColor, selectedMode);
  };

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-radial from-zinc-900 via-zinc-950 to-black select-none font-sans">
      {/* Top Header & Branding */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500 via-rose-600 to-indigo-600 shadow-lg shadow-rose-900/40 border border-white/20">
            <span className="font-extrabold text-xl tracking-tighter text-white italic">MM</span>
          </div>
          <div>
            <h1 className="text-2xl font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-400 to-sky-300">
              MIDTOWN MADNESS <span className="text-white text-base font-semibold not-italic px-2 py-0.5 rounded bg-rose-600/60 border border-rose-500/50">3D</span>
            </h1>
            <p className="text-xs text-zinc-400 tracking-wider uppercase font-mono">
              Chicago Open City Arcade Simulator
            </p>
          </div>
        </div>

        {/* Audio Mute & Info */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggleMute}
            aria-label="Toggle Audio Mute"
            className="flex items-center justify-center p-2.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* Main Showcase Center Viewport */}
      <div className="relative flex-1 w-full h-full min-h-[320px]">
        {/* 3D WebGL Turntable Canvas */}
        <div ref={canvasRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Turntable Drag Hint */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-zinc-400 pointer-events-none flex items-center space-x-1.5 shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Click & drag to inspect vehicle 360°</span>
        </div>

        {/* Left Side: Vehicle Details & Spec Bars Card */}
        <div className="absolute top-6 left-6 w-80 max-w-[calc(100vw-3rem)] rounded-2xl bg-zinc-950/85 backdrop-blur-xl border border-zinc-800/80 p-5 shadow-2xl space-y-4 pointer-events-auto">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-rose-400 px-2 py-0.5 rounded bg-rose-950/50 border border-rose-800/40">
                {selectedVehicle.category}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {selectedVehicle.dimensions.length}m × {selectedVehicle.dimensions.width}m
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-1.5 tracking-tight">
              {selectedVehicle.name}
            </h2>
            <p className="text-xs text-amber-300/90 font-medium">
              {selectedVehicle.subtitle}
            </p>
            <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
              {selectedVehicle.description}
            </p>
          </div>

          {/* Vehicle Stats Bars */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80 text-xs font-mono">
            {/* Top Speed */}
            <div>
              <div className="flex justify-between items-center mb-1 text-zinc-300">
                <span className="flex items-center space-x-1.5">
                  <Gauge className="w-3.5 h-3.5 text-sky-400" />
                  <span>Top Speed</span>
                </span>
                <span className="font-bold text-sky-400">{selectedVehicle.stats.topSpeedMph} MPH</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${(selectedVehicle.stats.topSpeedMph / 200) * 100}%` }}
                />
              </div>
            </div>

            {/* Acceleration */}
            <div>
              <div className="flex justify-between items-center mb-1 text-zinc-300">
                <span className="flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Acceleration</span>
                </span>
                <span className="font-bold text-amber-400">{selectedVehicle.stats.acceleration}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300"
                  style={{ width: `${selectedVehicle.stats.acceleration}%` }}
                />
              </div>
            </div>

            {/* Handling */}
            <div>
              <div className="flex justify-between items-center mb-1 text-zinc-300">
                <span className="flex items-center space-x-1.5">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Handling & Grip</span>
                </span>
                <span className="font-bold text-emerald-400">{selectedVehicle.stats.handling}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${selectedVehicle.stats.handling}%` }}
                />
              </div>
            </div>

            {/* Durability */}
            <div>
              <div className="flex justify-between items-center mb-1 text-zinc-300">
                <span className="flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                  <span>Durability & Armor</span>
                </span>
                <span className="font-bold text-rose-400">{selectedVehicle.stats.durability}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-full transition-all duration-300"
                  style={{ width: `${selectedVehicle.stats.durability}%` }}
                />
              </div>
            </div>

            {/* Weight / Ramming mass */}
            <div>
              <div className="flex justify-between items-center mb-1 text-zinc-300">
                <span className="flex items-center space-x-1.5">
                  <Weight className="w-3.5 h-3.5 text-purple-400" />
                  <span>Curb Weight</span>
                </span>
                <span className="font-bold text-purple-400">{selectedVehicle.stats.mass.toLocaleString()} kg</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((selectedVehicle.stats.mass / 9000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Color Customizer */}
          <div className="pt-2 border-t border-zinc-800/80">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Body Finish Paint
            </span>
            <div className="flex items-center space-x-2">
              {selectedVehicle.availableColors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                    selectedColor === color ? 'scale-125 border-white shadow-lg shadow-white/20' : 'border-zinc-700 hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Showroom Sound Audition */}
          <div className="pt-2 border-t border-zinc-800/80">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Audition Original Sounds
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  soundManager.playHorn(selectedVehicle.id === 'bus' || selectedVehicle.id === 'truck');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-amber-300 border border-zinc-800 transition cursor-pointer font-mono"
              >
                📣 Horn
              </button>
              <button
                onClick={() => {
                  soundManager.triggerVoiceCallout('cabbie');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-rose-300 border border-zinc-800 transition cursor-pointer font-mono"
              >
                🗣️ Driver Voice
              </button>
              {selectedVehicle.id === 'police' && (
                <button
                  onClick={() => soundManager.togglePoliceSiren()}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-xs text-sky-300 border border-blue-500/40 transition cursor-pointer font-mono"
                >
                  🚨 Siren
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Game Mode Selection Card */}
        <div className="absolute top-6 right-6 w-72 max-w-[calc(100vw-3rem)] rounded-2xl bg-zinc-950/85 backdrop-blur-xl border border-zinc-800/80 p-5 shadow-2xl space-y-3 pointer-events-auto">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400 block">
            Select Game Mode
          </span>

          {/* Cruise Mode */}
          <button
            onClick={() => { setSelectedMode('cruise'); soundManager.playMenuClick(); }}
            className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${
              selectedMode === 'cruise'
                ? 'bg-rose-950/40 border-rose-500/80 text-white shadow-lg shadow-rose-950/30'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <Compass className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-sm text-white">Cruise (Free Roam)</div>
              <div className="text-xs text-zinc-400 mt-0.5">Explore Chicago, jump drawbridges, smash lampposts.</div>
            </div>
          </button>

          {/* Blitz Race Mode */}
          <button
            onClick={() => { setSelectedMode('blitz'); soundManager.playMenuClick(); }}
            className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${
              selectedMode === 'blitz'
                ? 'bg-amber-950/40 border-amber-500/80 text-white shadow-lg shadow-amber-950/30'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <Flag className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-sm text-white">Blitz Checkpoint Race</div>
              <div className="text-xs text-zinc-400 mt-0.5">Beat the countdown clock through 8 city checkpoints!</div>
            </div>
          </button>

          {/* Cops Pursuit Mode */}
          <button
            onClick={() => { setSelectedMode('pursuit'); soundManager.playMenuClick(); }}
            className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${
              selectedMode === 'pursuit'
                ? 'bg-blue-950/40 border-blue-500/80 text-white shadow-lg shadow-blue-950/30'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <Siren className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-sm text-white">Cops Pursuit</div>
              <div className="text-xs text-zinc-400 mt-0.5">Chicago police in hot pursuit! Avoid getting busted.</div>
            </div>
          </button>

          {/* Drive Launch Button */}
          <button
            onClick={handleLaunch}
            className="w-full mt-4 py-3.5 px-6 rounded-xl font-black text-base uppercase tracking-wider text-zinc-950 bg-gradient-to-r from-amber-400 via-rose-400 to-amber-300 hover:from-amber-300 hover:to-rose-300 shadow-xl shadow-rose-900/40 active:scale-95 transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-zinc-950 text-zinc-950" />
            <span>DRIVE NOW</span>
          </button>
        </div>
      </div>

      {/* Bottom Horizontal Vehicle Carousel Dock */}
      <footer className="relative z-10 w-full px-6 py-4 bg-gradient-to-t from-black via-zinc-950/90 to-transparent border-t border-zinc-800/80">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Vehicle Garage ({VEHICLE_LIST.length} Models)
            </span>
            <span className="text-xs text-zinc-500 hidden sm:inline">
              Controls: [W/A/S/D] Drive • [SPACE] Handbrake Drift • [SHIFT] Nitro • [H] Horn • [R] Reset
            </span>
          </div>

          {/* Vehicle Selection Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {VEHICLE_LIST.map((v) => {
              const isSelected = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  onClick={() => handleSelectVehicle(v)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-rose-950/60 border-rose-500 shadow-md shadow-rose-900/40 scale-[1.03]'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/70 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">
                      {v.category}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full border border-black/40"
                      style={{ backgroundColor: v.defaultColor }}
                    />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white truncate">{v.name}</div>
                    <div className="text-[11px] font-mono text-amber-400 mt-0.5">
                      {v.stats.topSpeedMph} MPH
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
};
