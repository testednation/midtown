import React, { useState, useEffect, useRef } from 'react';
import { GameMode, VehicleConfig, CameraView } from '../types';
import { TrafficCar } from '../simulation/trafficSystem';
import {
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
} from 'lucide-react';
import { soundManager, VoiceCallout } from '../audio/soundManager';
import { SpeedometerGauge } from './SpeedometerGauge';

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
  cameraView,
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

  // Clear callout after 3.4 seconds
  useEffect(() => {
    if (!currentCallout) return;
    const timer = setTimeout(() => {
      setCurrentCallout(null);
    }, 3400);
    return () => clearTimeout(timer);
  }, [currentCallout]);

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
          <svg className="w-full h-full opacity-60">
            <line x1="0%" y1="0%" x2="25%" y2="25%" stroke="#ffffff" strokeWidth="2" strokeDasharray="30 15" />
            <line x1="100%" y1="0%" x2="75%" y2="25%" stroke="#ffffff" strokeWidth="2" strokeDasharray="30 15" />
            <line x1="0%" y1="100%" x2="25%" y2="75%" stroke="#ffffff" strokeWidth="2" strokeDasharray="30 15" />
            <line x1="100%" y1="100%" x2="75%" y2="75%" stroke="#ffffff" strokeWidth="2" strokeDasharray="30 15" />
            <line x1="50%" y1="0%" x2="50%" y2="20%" stroke="#38bdf8" strokeWidth="2" strokeDasharray="20 10" />
          </svg>
        </div>
      )}

      {/* Top Bar: Left slot reserved for Persistent MiniMapOverlay in GameCanvas, Center Voice Banner, Right Quick Actions */}
      <div className="flex items-start justify-between w-full relative z-20">
        {/* Top-Left Spacer (occupied by persistent MiniMapOverlay in GameCanvas) */}
        <div className="w-10 h-10 pointer-events-none" />

        {/* Top Center: Iconic Midtown Madness Radio & Cabbie Voice Callout Banner */}
        {currentCallout && (
          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-1 max-w-md w-full px-4">
            <div
              className={`flex items-center space-x-3 p-3 rounded-2xl border shadow-2xl ${
                currentCallout.speaker === 'cop'
                  ? 'bg-blue-950/95 border-blue-500/80 text-white'
                  : currentCallout.speaker === 'pedestrian'
                  ? 'bg-amber-950/95 border-amber-500/80 text-white'
                  : currentCallout.speaker === 'announcer'
                  ? 'bg-emerald-950/95 border-emerald-500/80 text-white'
                  : 'bg-rose-950/95 border-rose-500/80 text-white'
              }`}
            >
              <div className="p-2 rounded-xl bg-black/40 border border-white/10 shrink-0">
                {currentCallout.speaker === 'cop' ? (
                  <Radio className="w-5 h-5 text-sky-400" />
                ) : currentCallout.speaker === 'pedestrian' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
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
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-900/95 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 shadow-lg transition text-xs font-semibold cursor-pointer"
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
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-900/95 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 shadow-lg transition text-xs font-semibold cursor-pointer"
          >
            <Car className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Garage</span>
          </button>

          {/* Quick Audio Mute */}
          <button
            onClick={handleToggleMute}
            aria-label="Toggle Mute"
            className="p-2 rounded-xl bg-zinc-900/95 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 shadow-lg transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Center Damage Warning & Game Over Banner */}
      {isGameOver && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/85 z-50 p-6">
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
                  <Siren className="w-10 h-10 text-red-500" />
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

      {/* Main Midtown Dashboard Cluster: Analog/Digital Speedometer Gauge + Telemetry */}
      <div className="flex items-end justify-end w-full pointer-events-none mb-1">
        <SpeedometerGauge
          speedMph={speedMph}
          maxVehicleSpeedMph={vehicle.stats.topSpeedMph}
          rpm={rpm}
          gear={gear}
          damagePercent={damagePercent}
          nitroRemaining={nitroRemaining}
          nitroCapacity={vehicle.stats.nitroCapacity}
          isNitroActive={isNitroActive}
        />
      </div>


      {/* Ergonomic Collapsible Bottom Control Dock */}
      <div className="pointer-events-auto mx-auto mb-2 flex flex-col items-center">
        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="px-3 py-1 rounded-t-xl bg-zinc-900/95 hover:bg-zinc-800 text-zinc-400 hover:text-white border-t border-x border-zinc-700/60 text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer shadow-md"
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
          <div className="bg-zinc-950/95 border border-zinc-800/90 rounded-2xl px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-center gap-2 max-w-[min(940px,94vw)]">
            {/* Camera View Selector */}
            <div className="flex items-center space-x-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
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
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-blue-950/90 hover:bg-blue-900 text-sky-300 border border-blue-500/50 text-xs font-bold transition cursor-pointer"
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
            className="w-14 h-14 rounded-2xl bg-zinc-900/95 active:bg-rose-600 border border-zinc-700 text-white font-black text-xl flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            ◀
          </button>
          <button
            onPointerDown={() => setTouch({ steer: 1 })}
            onPointerUp={() => setTouch({ steer: 0 })}
            className="w-14 h-14 rounded-2xl bg-zinc-900/95 active:bg-rose-600 border border-zinc-700 text-white font-black text-xl flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            ▶
          </button>
        </div>

        <div className="flex space-x-2">
          <button
            onPointerDown={() => setTouch({ handbrake: true })}
            onPointerUp={() => setTouch({ handbrake: false })}
            className="w-12 h-12 rounded-2xl bg-amber-950/90 active:bg-amber-600 border border-amber-600 text-amber-300 font-bold text-xs flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            DRIFT
          </button>
          <button
            onPointerDown={() => setTouch({ throttle: -1 })}
            onPointerUp={() => setTouch({ throttle: 0 })}
            className="w-14 h-14 rounded-2xl bg-zinc-900/95 active:bg-rose-600 border border-zinc-700 text-white font-black text-xl flex items-center justify-center shadow-xl active:scale-95 transition"
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
