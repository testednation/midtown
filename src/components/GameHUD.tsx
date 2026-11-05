import React, { useState, useEffect, useRef } from 'react';
import { GameMode, VehicleConfig, CameraView } from '../types';
import { TrafficCar } from '../simulation/trafficSystem';
import {
  Compass,
  RotateCcw,
  Volume2,
  VolumeX,
  Camera,
  Car,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Flag,
  Siren,
  Radio,
  MessageSquare,
  Wrench,
  Wind,
} from 'lucide-react';
import { soundManager, VoiceCallout } from '../audio/soundManager';

interface GameHUDProps {
  vehicle: VehicleConfig;
  speedMph: number;
  rpm: number;
  gear: number | string;
  damagePercent: number;
  nitroRemaining: number;
  isNitroActive: boolean;
  gameMode: GameMode;
  cameraView: CameraView;
  playerPos: { x: number; z: number; heading: number };
  trafficCars: TrafficCar[];
  currentCheckpointIdx: number;
  totalCheckpoints: number;
  blitzTimeRemaining: number;
  policeNearCount: number;
  isGameOver: boolean;
  gameOverReason?: 'wrecked' | 'busted' | 'victory' | 'time_out';
  score: number;
  onSetCameraView: (view: CameraView) => void;
  onResetVehicle: () => void;
  onRepairVehicle: () => void;
  onHonkHorn: () => void;
  onToggleSiren: () => void;
  onReturnToMenu: () => void;
  onRestartMode: () => void;
  onTouchInput?: (input: { throttle: number; steer: number; handbrake: boolean; nitro: boolean }) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  vehicle,
  speedMph,
  rpm,
  gear,
  damagePercent,
  nitroRemaining,
  isNitroActive,
  gameMode,
  cameraView,
  playerPos,
  trafficCars,
  currentCheckpointIdx,
  totalCheckpoints,
  blitzTimeRemaining,
  policeNearCount,
  isGameOver,
  gameOverReason,
  score,
  onSetCameraView,
  onResetVehicle,
  onRepairVehicle,
  onHonkHorn,
  onToggleSiren,
  onReturnToMenu,
  onRestartMode,
  onTouchInput,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceOn, setIsVoiceOn] = useState(true);
  const [sirenMode, setSirenMode] = useState<'wail' | 'yelp'>('wail');
  const [currentCallout, setCurrentCallout] = useState<VoiceCallout | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Touch control states
  const touchStateRef = useRef({ throttle: 0, steer: 0, handbrake: false, nitro: false });

  const setTouch = (changes: Partial<typeof touchStateRef.current>) => {
    touchStateRef.current = { ...touchStateRef.current, ...changes };
    if (onTouchInput) onTouchInput(touchStateRef.current);
  };

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleVoice = () => {
    const v = soundManager.toggleVoice();
    setIsVoiceOn(v);
  };

  const handleSwitchSiren = () => {
    const next = soundManager.switchSirenMode();
    setSirenMode(next);
  };

  // Register voice callout callback for comic radio banner
  useEffect(() => {
    soundManager.setVoiceCallback((callout) => {
      setCurrentCallout(callout);
    });
  }, []);

  // Clear callout after 3.2 seconds
  useEffect(() => {
    if (!currentCallout) return;
    const timer = setTimeout(() => {
      setCurrentCallout(null);
    }, 3400);
    return () => clearTimeout(timer);
  }, [currentCallout]);

  // Minimap radar rendering (drawing roads, player arrow, traffic dots, checkpoints, cops)
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const mapScale = 0.45; // pixels per world meter

    ctx.clearRect(0, 0, w, h);

    // Radar circular background
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#09090bee';
    ctx.fillRect(0, 0, w, h);

    ctx.translate(cx, cy);
    ctx.rotate(-playerPos.heading);

    // Draw city roads relative to player
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 14 * mapScale;

    const roads = [-208, -104, 0, 104, 208];
    for (const r of roads) {
      const rx = (r - playerPos.x) * mapScale;
      ctx.beginPath();
      ctx.moveTo(rx, -200);
      ctx.lineTo(rx, 200);
      ctx.stroke();

      const rz = (r - playerPos.z) * mapScale;
      ctx.beginPath();
      ctx.moveTo(-200, rz);
      ctx.lineTo(200, rz);
      ctx.stroke();
    }

    // Draw River canal
    ctx.fillStyle = '#0284c755';
    const riverY = (0 - playerPos.z) * mapScale;
    ctx.fillRect(-200, riverY - (22 * mapScale), 400, 44 * mapScale);

    // Draw traffic cars
    for (const car of trafficCars) {
      const tx = (car.x - playerPos.x) * mapScale;
      const tz = (car.z - playerPos.z) * mapScale;
      if (Math.hypot(tx, tz) > cx - 6) continue;

      ctx.fillStyle = car.isPolice ? '#38bdf8' : '#eab308';
      ctx.beginPath();
      ctx.arc(tx, tz, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw checkpoint if in blitz mode
    if (gameMode === 'blitz') {
      const cpPositions = [
        { x: -160, z: -160 }, { x: -50, z: -160 }, { x: 50, z: -160 },
        { x: 160, z: -80 }, { x: 160, z: 0 }, { x: 50, z: 104 },
        { x: -100, z: 120 }, { x: -160, z: 0 },
      ];
      const targetCp = cpPositions[currentCheckpointIdx % cpPositions.length];
      if (targetCp) {
        const cpx = (targetCp.x - playerPos.x) * mapScale;
        const cpz = (targetCp.z - playerPos.z) * mapScale;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(cpx, cpz, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Draw static player vehicle chevron arrow in center pointing UP
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();

    // Radar rim border
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, cx - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [playerPos, trafficCars, gameMode, currentCheckpointIdx]);

  const speedIntensity = Math.max(0, (speedMph - 70) / 90);
  const showSpeedWarp = speedIntensity > 0 || isNitroActive;

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-4 overflow-hidden font-sans">
      {/* High-Speed Radial Motion Warp Lines (Original Midtown Speed Effect) */}
      {showSpeedWarp && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: Math.min(speedIntensity * 1.2 + (isNitroActive ? 0.6 : 0), 0.85),
            background: 'radial-gradient(circle, transparent 40%, rgba(56, 189, 248, 0.15) 80%, rgba(225, 29, 72, 0.25) 100%)',
          }}
        >
          {/* Subtle speed streak lines */}
          <svg className="w-full h-full opacity-60">
            <line x1="0%" y1="0%" x2="25%" y2="25%" stroke="#ffffff" strokeWidth="2" strokeDasharray="30 15" />
            <line x1="100%" y1="0%" x2="75%" y2="25%" stroke="#ffffff" strokeWidth="2" strokeDasharray="30 15" />
            <line x1="0%" y1="100%" x2="25%" y2="75%" stroke="#ffffff" strokeWidth="2" strokeDasharray="30 15" />
            <line x1="100%" y1="100%" x2="75%" y2="75%" stroke="#ffffff" strokeWidth="2" strokeDasharray="30 15" />
            <line x1="50%" y1="0%" x2="50%" y2="20%" stroke="#38bdf8" strokeWidth="2" strokeDasharray="20 10" />
          </svg>
        </div>
      )}

      {/* Top Bar: Mode Status, Radar, Voice Banner & Menu Button */}
      <div className="flex items-start justify-between w-full relative z-20">
        {/* Top-Left: Minimap Radar & City Info */}
        <div className="pointer-events-auto flex items-center space-x-3 bg-zinc-950/85 backdrop-blur-md p-2.5 rounded-2xl border border-zinc-800/80 shadow-2xl">
          <canvas
            ref={minimapCanvasRef}
            width={110}
            height={110}
            className="w-[110px] h-[110px] rounded-xl border border-zinc-800"
          />
          <div className="space-y-1 font-mono pr-2">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {gameMode === 'blitz' ? 'BLITZ RACE' : gameMode === 'pursuit' ? 'COP PURSUIT' : 'CRUISE CITY'}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate max-w-[120px]">
              {vehicle.name}
            </div>
            <div className="text-[11px] text-amber-400 font-bold">
              SCORE: {score}
            </div>

            {/* Blitz Countdown */}
            {gameMode === 'blitz' && (
              <div className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                <Flag className="w-3.5 h-3.5" />
                <span>CP: {currentCheckpointIdx + 1}/{totalCheckpoints}</span>
                <span className="text-amber-400 ml-1">⏱ {Math.ceil(blitzTimeRemaining)}s</span>
              </div>
            )}

            {/* Pursuit Alert */}
            {gameMode === 'pursuit' && (
              <div className={`text-xs font-bold flex items-center space-x-1 ${policeNearCount > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}>
                <Siren className="w-3.5 h-3.5" />
                <span>{policeNearCount > 0 ? `🚨 HEAT: ${policeNearCount} COPS` : 'PATROL EVADED'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Top Center: Iconic Midtown Madness Radio & Cabbie Voice Callout Banner */}
        {currentCallout && (
          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-1 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
            <div
              className={`flex items-center space-x-3 p-3 rounded-2xl border shadow-2xl backdrop-blur-xl ${
                currentCallout.speaker === 'cop'
                  ? 'bg-blue-950/90 border-blue-500/80 text-white'
                  : currentCallout.speaker === 'pedestrian'
                  ? 'bg-amber-950/90 border-amber-500/80 text-white'
                  : currentCallout.speaker === 'announcer'
                  ? 'bg-emerald-950/90 border-emerald-500/80 text-white'
                  : 'bg-rose-950/90 border-rose-500/80 text-white'
              }`}
            >
              <div className="p-2 rounded-xl bg-black/40 border border-white/10 shrink-0">
                {currentCallout.speaker === 'cop' ? (
                  <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
                ) : currentCallout.speaker === 'pedestrian' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />
                ) : currentCallout.speaker === 'announcer' ? (
                  <Flag className="w-5 h-5 text-emerald-400" />
                ) : (
                  <MessageSquare className="w-5 h-5 text-rose-400" />
                )}
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-zinc-300">
                  {currentCallout.speaker === 'cop'
                    ? '🚨 CHICAGO POLICE DISPATCH'
                    : currentCallout.speaker === 'pedestrian'
                    ? '🏃 CHICAGO CITIZEN'
                    : currentCallout.speaker === 'announcer'
                    ? '🏁 RACE CONTROL'
                    : '🚕 DRIVER / CABBIE'}
                </div>
                <div className="text-sm font-black italic tracking-wide text-white truncate">
                  "{currentCallout.text}"
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top-Right: Quick Actions */}
        <div className="pointer-events-auto flex items-center space-x-2">
          {/* Voice commentary toggle */}
          <button
            onClick={handleToggleVoice}
            title={isVoiceOn ? 'Voice Callouts: Enabled' : 'Voice Callouts: Muted'}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 shadow-lg transition text-xs font-semibold cursor-pointer"
          >
            <MessageSquare className={`w-3.5 h-3.5 ${isVoiceOn ? 'text-amber-400' : 'text-zinc-500'}`} />
            <span className="hidden sm:inline">Voice:</span>
            <span className={isVoiceOn ? 'text-emerald-400 font-mono' : 'text-zinc-500 font-mono'}>
              {isVoiceOn ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Pause / Garage Menu Return */}
          <button
            onClick={onReturnToMenu}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 shadow-lg transition text-xs font-semibold cursor-pointer"
          >
            <Car className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Garage</span>
          </button>

          {/* Quick Audio Mute */}
          <button
            onClick={handleToggleMute}
            aria-label="Toggle Mute"
            className="p-2 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 shadow-lg transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Center Damage Warning & Game Over Banner */}
      {isGameOver && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md z-50 p-6">
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            {gameOverReason === 'victory' ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-3xl font-black italic text-emerald-400 tracking-wide">
                  BLITZ VICTORY!
                </h2>
                <p className="text-zinc-300 text-sm">
                  You conquered Chicago with <span className="text-white font-bold">{vehicle.name}</span>!
                </p>
                <div className="text-xl font-mono font-bold text-amber-400">
                  Final Score: {score}
                </div>
              </>
            ) : gameOverReason === 'busted' ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                  <Siren className="w-10 h-10 text-red-500 animate-bounce" />
                </div>
                <h2 className="text-3xl font-black italic text-red-500 tracking-wide">
                  BUSTED!
                </h2>
                <p className="text-zinc-300 text-sm">
                  The Chicago Police boxed you in!
                </p>
              </>
            ) : gameOverReason === 'time_out' ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-amber-400" />
                </div>
                <h2 className="text-3xl font-black italic text-amber-400 tracking-wide">
                  TIME'S UP!
                </h2>
                <p className="text-zinc-300 text-sm">
                  The blitz checkpoint timer expired.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                  <Flame className="w-10 h-10 text-rose-500" />
                </div>
                <h2 className="text-3xl font-black italic text-rose-500 tracking-wide">
                  TOTALED!
                </h2>
                <p className="text-zinc-300 text-sm">
                  Your car took 100% catastrophic damage.
                </p>
              </>
            )}

            <div className="flex items-center space-x-3 pt-3">
              <button
                onClick={onRestartMode}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-zinc-950 uppercase tracking-wider shadow-lg transition cursor-pointer"
              >
                Drive Again
              </button>
              <button
                onClick={onReturnToMenu}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-zinc-800 hover:bg-zinc-700 text-white uppercase tracking-wider border border-zinc-700 transition cursor-pointer"
              >
                Change Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Midtown Dashboard Cluster: Speedometer + Tachometer + Damage Bar */}
      <div className="flex items-end justify-between w-full pointer-events-none mb-1">
        {/* Speedometer & Gear Display */}
        <div className="bg-zinc-950/85 backdrop-blur-md p-3.5 rounded-2xl border border-zinc-800/80 shadow-2xl flex items-center space-x-4 font-mono pointer-events-auto">
          {/* Digital Speed & Gear */}
          <div className="text-center">
            <div className="text-3xl font-black tracking-tighter text-white">
              {Math.round(speedMph)}
            </div>
            <div className="text-[10px] text-zinc-400 tracking-wider">MPH</div>
          </div>

          <div className="h-10 w-[1px] bg-zinc-800" />

          {/* Gear Indicator */}
          <div className="text-center">
            <div className={`text-2xl font-black ${gear === 'R' ? 'text-rose-400' : 'text-amber-400'}`}>
              {gear}
            </div>
            <div className="text-[10px] text-zinc-400">GEAR</div>
          </div>

          <div className="h-10 w-[1px] bg-zinc-800" />

          {/* RPM Bar */}
          <div className="w-24">
            <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
              <span>RPM</span>
              <span className="text-zinc-300 font-bold">{Math.round(rpm)}</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  rpm > 6500 ? 'bg-rose-500' : rpm > 4500 ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${Math.min(((rpm - 1000) / 6500) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Damage Meter & Nitro Boost Meter */}
        <div className="bg-zinc-950/85 backdrop-blur-md p-3.5 rounded-2xl border border-zinc-800/80 shadow-2xl space-y-2 font-mono w-48 pointer-events-auto">
          {/* Damage Gauge */}
          <div>
            <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-0.5">
              <span>DAMAGE</span>
              <span className={`font-bold ${damagePercent > 75 ? 'text-rose-500' : damagePercent > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {damagePercent}%
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  damagePercent > 75 ? 'bg-rose-600' : damagePercent > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${damagePercent}%` }}
              />
            </div>
          </div>

          {/* Nitro Gauge */}
          <div>
            <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-0.5">
              <span className="flex items-center space-x-1">
                <Flame className={`w-3 h-3 ${isNitroActive ? 'text-cyan-400 animate-pulse' : 'text-cyan-500'}`} />
                <span>NITRO BOOST</span>
              </span>
              <span className="font-bold text-cyan-400">{Math.ceil(nitroRemaining)}s</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100 rounded-full"
                style={{ width: `${(nitroRemaining / vehicle.stats.nitroCapacity) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ergonomic Collapsible Bottom Control Dock */}
      <div className="pointer-events-auto mx-auto mb-2 flex flex-col items-center">
        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="px-3 py-1 rounded-t-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border-t border-x border-zinc-700/60 text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer shadow-md"
        >
          {isDockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Show Controls & Audio Effects Dock</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              <span>Hide Dock (Cinema Mode)</span>
            </>
          )}
        </button>

        {/* Dock Bar Content */}
        {!isDockCollapsed && (
          <div className="bg-zinc-950/90 backdrop-blur-xl border border-zinc-800/90 rounded-2xl px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-center gap-2 max-w-[min(940px,94vw)]">
            {/* Camera View Selector */}
            <div className="flex items-center space-x-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
              <Camera className="w-3.5 h-3.5 text-zinc-400 ml-1.5 mr-0.5" />
              {(['chase_far', 'chase_close', 'hood', 'orbit'] as CameraView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => onSetCameraView(v)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                    cameraView === v
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {v === 'chase_far' ? 'Chase Far' : v === 'chase_close' ? 'Chase Close' : v === 'hood' ? 'Hood' : 'Orbit'}
                </button>
              ))}
            </div>

            {/* Core Action Buttons */}
            <div className="flex items-center space-x-1.5">
              {/* Reset Car */}
              <button
                onClick={onResetVehicle}
                title="Reset vehicle upright on road (R)"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-semibold transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset [R]</span>
              </button>

              {/* Repair Car */}
              <button
                onClick={onRepairVehicle}
                title="Repair damage & refill nitro"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-semibold transition cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span>Repair</span>
              </button>

              {/* Honk Horn */}
              <button
                onClick={onHonkHorn}
                title="Honk vehicle horn (H)"
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-semibold transition cursor-pointer"
              >
                📣 Horn [H]
              </button>

              {/* Police Siren Toggle */}
              {vehicle.id === 'police' && (
                <>
                  <button
                    onClick={onToggleSiren}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-sky-300 border border-blue-500/50 text-xs font-bold transition cursor-pointer"
                  >
                    <Siren className="w-3.5 h-3.5 text-sky-400" />
                    <span>Siren</span>
                  </button>
                  <button
                    onClick={handleSwitchSiren}
                    className="px-2 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono border border-zinc-700 transition cursor-pointer"
                  >
                    {sirenMode === 'wail' ? 'Mode: Wail' : 'Mode: Yelp'}
                  </button>
                </>
              )}
            </div>

            {/* Original Sound Effects Preview Triggers */}
            <div className="flex items-center space-x-1 pl-1 border-l border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-500 uppercase px-1 hidden md:inline">
                SFX:
              </span>
              <button
                onClick={() => soundManager.triggerVoiceCallout('cabbie')}
                title="Cabbie Commentary"
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 text-xs font-mono transition cursor-pointer"
              >
                🗣️ Cabbie
              </button>
              <button
                onClick={() => soundManager.triggerVoiceCallout('cop')}
                title="Police Radio Dispatch"
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-zinc-800 text-xs font-mono transition cursor-pointer"
              >
                📻 Dispatch
              </button>
              <button
                onClick={() => soundManager.playExhaustBackfire()}
                title="Exhaust Backfire Pop"
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-rose-300 border border-zinc-800 text-xs font-mono transition cursor-pointer"
              >
                💥 Pop
              </button>
              <button
                onClick={() => soundManager.playAirBrakesRelease()}
                title="Air Brakes Pssshh"
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border border-zinc-800 text-xs font-mono transition cursor-pointer hidden sm:inline"
              >
                💨 Brakes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* On-Screen Touch Driving Controls for Mobile */}
      <div className="sm:hidden pointer-events-auto flex justify-between items-end pb-1 w-full">
        <div className="flex space-x-2">
          <button
            onPointerDown={() => setTouch({ steer: -1 })}
            onPointerUp={() => setTouch({ steer: 0 })}
            className="w-14 h-14 rounded-2xl bg-zinc-900/90 active:bg-rose-600 border border-zinc-700 text-white font-black text-xl flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            ◀
          </button>
          <button
            onPointerDown={() => setTouch({ steer: 1 })}
            onPointerUp={() => setTouch({ steer: 0 })}
            className="w-14 h-14 rounded-2xl bg-zinc-900/90 active:bg-rose-600 border border-zinc-700 text-white font-black text-xl flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            ▶
          </button>
        </div>

        <div className="flex space-x-2">
          <button
            onPointerDown={() => setTouch({ handbrake: true })}
            onPointerUp={() => setTouch({ handbrake: false })}
            className="w-12 h-12 rounded-2xl bg-amber-950/80 active:bg-amber-600 border border-amber-600 text-amber-300 font-bold text-xs flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            DRIFT
          </button>
          <button
            onPointerDown={() => setTouch({ throttle: -1 })}
            onPointerUp={() => setTouch({ throttle: 0 })}
            className="w-14 h-14 rounded-2xl bg-zinc-900/90 active:bg-rose-600 border border-zinc-700 text-white font-black text-xl flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            ▼
          </button>
          <button
            onPointerDown={() => setTouch({ throttle: 1 })}
            onPointerUp={() => setTouch({ throttle: 0 })}
            className="w-14 h-14 rounded-2xl bg-gradient-to-t from-emerald-600 to-teal-500 active:scale-95 text-zinc-950 font-black text-2xl flex items-center justify-center shadow-xl transition"
          >
            ▲
          </button>
        </div>
      </div>
    </div>
  );
};
