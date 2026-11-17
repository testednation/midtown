import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CityLandmark, GameMode, Checkpoint } from '../types';
import { TrafficCar } from '../simulation/trafficSystem';
import { CHICAGO_LANDMARKS } from '../models/cityBuilder';
import {
  Compass,
  Navigation,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  MapPin,
  ChevronDown,
  ChevronUp,
  Crosshair,
} from 'lucide-react';

interface MiniMapOverlayProps {
  playerPos: { x: number; z: number; heading: number };
  speedMph: number;
  gameMode: GameMode;
  vehicleName: string;
  score: number;
  trafficCars: TrafficCar[];
  checkpoints: Checkpoint[];
  currentCheckpointIdx: number;
  blitzTimeRemaining: number;
  policeNearCount: number;
  lTrainX?: number;
  landmarks?: CityLandmark[];
  onTeleportToLandmark?: (x: number, z: number) => void;
}

const ROAD_COORDS = [-260, -156, -52, 52, 156, 260];
const BLOCK_CENTERS = [-208, -104, 0, 104, 208];
const ZOOM_SCALES = [
  { label: 'CITY', scale: 0.25 },
  { label: 'DIST', scale: 0.42 },
  { label: 'STRT', scale: 0.64 },
];

function getCardinalDirection(headingRad: number): string {
  // In our world: +Z is South (or forward at heading=0), let's normalize angle so 0..360 maps cleanly
  // When heading = 0, sin(0)=0, cos(0)=1 (+Z). Let's treat -Z as North or +Z as North consistently with map:
  // On our 2D map, -Z is UP (North) when North-Up is active!
  // Since player moves by: x += sin(heading)*d, z += cos(heading)*d:
  // Moving North (-Z) means cos(heading) = -1 => heading = PI.
  // Let's compute compass bearing where 0 deg = North (-Z), 90 deg = East (+X), 180 deg = South (+Z), 270 deg = West (-X):
  const dx = Math.sin(headingRad);
  const dz = Math.cos(headingRad);
  const angleDeg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(angleDeg / 45) % 8;
  return dirs[idx];
}

function getStreetName(x: number, z: number): string {
  if (Math.abs(z) < 26) {
    if (Math.abs(x - -52) < 22) return 'Michigan Ave Drawbridge';
    if (Math.abs(x - 156) < 22) return 'Lakeshore Stunt Bridge';
    return 'Chicago River Canal';
  }
  if (Math.abs(z - 104) < 18) return 'CTA Red Line Corridor';
  if (Math.abs(x - -52) < 18) return 'Michigan Avenue';
  if (Math.abs(x - 52) < 18) return 'State Street Loop';
  if (Math.abs(x - 156) < 18) return 'Lakeshore Drive';
  if (Math.abs(x - -156) < 18) return 'Wacker Drive West';
  if (Math.abs(z - -156) < 18) return 'Congress Parkway';
  if (Math.abs(z - 208) < 24) return 'North Loop Boulevard';
  return 'Midtown Chicago Grid';
}

export const MiniMapOverlay: React.FC<MiniMapOverlayProps> = ({
  playerPos,
  speedMph,
  gameMode,
  vehicleName,
  score,
  trafficCars,
  checkpoints,
  currentCheckpointIdx,
  blitzTimeRemaining,
  policeNearCount,
  lTrainX = 0,
  landmarks = CHICAGO_LANDMARKS,
  onTeleportToLandmark,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomIdx, setZoomIdx] = useState<number>(1); // Default: District zoom (0.42)
  const [isNorthUp, setIsNorthUp] = useState<boolean>(false); // Default: Heading-Up radar
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showLandmarkList, setShowLandmarkList] = useState<boolean>(false);
  const [pinnedLandmarkId, setPinnedLandmarkId] = useState<string>('willis_tower');

  // Breadcrumb trail of recent player positions
  const trailRef = useRef<{ x: number; z: number }[]>([]);

  // Keyboard shortcut 'M' to toggle expanded mini-map, 'N' to toggle North-Up
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        setIsExpanded((prev) => !prev);
      } else if (e.code === 'KeyN') {
        setIsNorthUp((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Record player breadcrumb trail
  useEffect(() => {
    const trail = trailRef.current;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(playerPos.x - last.x, playerPos.z - last.z) > 6) {
      trail.push({ x: playerPos.x, z: playerPos.z });
      if (trail.length > 28) {
        trail.shift();
      }
    }
  }, [playerPos.x, playerPos.z]);

  // Nearest landmark calculation
  const nearestLandmarkInfo = useMemo(() => {
    let best: CityLandmark = landmarks[0];
    let bestDist = Infinity;
    for (const lm of landmarks) {
      const d = Math.hypot(lm.x - playerPos.x, lm.z - playerPos.z);
      if (d < bestDist) {
        bestDist = d;
        best = lm;
      }
    }
    return { landmark: best, distance: Math.round(bestDist) };
  }, [landmarks, playerPos.x, playerPos.z]);

  const pinnedLandmark = useMemo(
    () => landmarks.find((l) => l.id === pinnedLandmarkId) || null,
    [landmarks, pinnedLandmarkId]
  );

  const pinnedDistance = useMemo(() => {
    if (!pinnedLandmark) return 0;
    return Math.round(Math.hypot(pinnedLandmark.x - playerPos.x, pinnedLandmark.z - playerPos.z));
  }, [pinnedLandmark, playerPos.x, playerPos.z]);

  const canvasSize = isExpanded ? 236 : 168;
  const mapScale = ZOOM_SCALES[zoomIdx].scale * (isExpanded ? 1.15 : 1.0);

  // Click directly on Mini-Map Canvas to pin the closest landmark
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left - canvas.width / 2;
    const clickY = e.clientY - rect.top - canvas.height / 2;

    // Inverse transform from canvas pixel offset to world (x, z)
    // In Heading-Up mode, the map is rotated by (Math.PI - playerPos.heading) so forward (+heading) points UP (-Y on canvas)
    const mapRotation = isNorthUp ? 0 : Math.PI - playerPos.heading;
    const cosR = Math.cos(-mapRotation);
    const sinR = Math.sin(-mapRotation);

    const worldDX = (clickX * cosR - clickY * sinR) / mapScale;
    const worldDZ = (clickX * sinR + clickY * cosR) / mapScale;

    const targetWorldX = (isNorthUp && zoomIdx === 0 ? 0 : playerPos.x) + worldDX;
    const targetWorldZ = (isNorthUp && zoomIdx === 0 ? 0 : playerPos.z) + worldDZ;

    let closestLm: CityLandmark | null = null;
    let minD = 75;
    for (const lm of landmarks) {
      const d = Math.hypot(lm.x - targetWorldX, lm.z - targetWorldZ);
      if (d < minD) {
        minD = d;
        closestLm = lm;
      }
    }
    if (closestLm) {
      setPinnedLandmarkId(closestLm.id);
    }
  };

  // Draw the persistent Mini-Map Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = cx - 4;

    ctx.clearRect(0, 0, w, h);

    // 1. Clip to rounded radar frame
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, h - 4, 16);
    ctx.clip();

    // Deep slate map background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Center reference: in Full City + North-Up mode, center on (0,0); otherwise center on player
    const centerWorldX = isNorthUp && zoomIdx === 0 ? 0 : playerPos.x;
    const centerWorldZ = isNorthUp && zoomIdx === 0 ? 0 : playerPos.z;

    // Rotation angle so that in Heading-Up mode, player's movement direction (+sin(h), +cos(h)) points UP (0, -1) on canvas
    const mapRotation = isNorthUp ? 0 : Math.PI - playerPos.heading;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mapRotation);

    // Helper to convert world (wx, wz) to local rotated map coordinates
    const toMapX = (wx: number) => (wx - centerWorldX) * mapScale;
    const toMapY = (wz: number) => (wz - centerWorldZ) * mapScale;

    // 2. Draw Subtle Grid & City Boundary
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      toMapX(-280),
      toMapY(-280),
      560 * mapScale,
      560 * mapScale
    );

    // 3. Draw Chicago River Canal (Z = -22 to +22)
    const canalTop = toMapY(-22);
    const canalHeight = 44 * mapScale;
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(toMapX(-320), canalTop, 640 * mapScale, canalHeight);

    // Riverbank concrete walls
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(toMapX(-320), canalTop);
    ctx.lineTo(toMapX(320), canalTop);
    ctx.moveTo(toMapX(-320), canalTop + canalHeight);
    ctx.lineTo(toMapX(320), canalTop + canalHeight);
    ctx.stroke();

    // 4. Draw City Blocks & Skyscraper Footprints
    for (let bx = 0; bx < 5; bx++) {
      for (let bz = 0; bz < 5; bz++) {
        const bcx = BLOCK_CENTERS[bx];
        const bcz = BLOCK_CENTERS[bz];
        if (Math.abs(bcz) < 40) continue; // River canal

        const blockW = 80 * mapScale;
        const x0 = toMapX(bcx - 40);
        const y0 = toMapY(bcz - 40);

        // Sidewalk footprint
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x0, y0, blockW, blockW);

        // Skyscraper building footprint
        const bldW = 52 * mapScale;
        const bx0 = toMapX(bcx - 26);
        const by0 = toMapY(bcz - 26);

        const isWillis = bx === 2 && bz === 3;
        const isHistoric = (bx + bz) % 3 === 0;

        ctx.fillStyle = isWillis ? '#451a03' : isHistoric ? '#27272a' : '#0f172a';
        ctx.strokeStyle = isWillis ? '#f59e0b' : isHistoric ? '#eab30888' : '#334155';
        ctx.lineWidth = isWillis ? 1.6 : 1;
        ctx.fillRect(bx0, by0, bldW, bldW);
        ctx.strokeRect(bx0, by0, bldW, bldW);
      }
    }

    // 5. Draw Avenues & Stunt Drawbridges
    const roadW = 24 * mapScale;
    ctx.fillStyle = '#27272a';

    for (let i = 0; i < ROAD_COORDS.length; i++) {
      const r = ROAD_COORDS[i];
      // N-S Avenue
      ctx.fillRect(toMapX(r - 12), toMapY(-272), roadW, 544 * mapScale);

      // E-W Avenue (if not overlapping canal)
      if (Math.abs(r) > 22) {
        ctx.fillRect(toMapX(-272), toMapY(r - 12), 544 * mapScale, roadW);
      }

      // Highlight Stunt Drawbridges at i === 2 (x = -52) and i === 4 (x = 156)
      const isStuntBridge = i === 2 || i === 4;
      if (isStuntBridge) {
        ctx.fillStyle = '#881337';
        ctx.fillRect(toMapX(r - 12), toMapY(-24), roadW, 48 * mapScale);
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(toMapX(r - 12), toMapY(-24), roadW, 48 * mapScale);
        ctx.fillStyle = '#27272a';
      } else {
        // Standard flat bridge deck
        ctx.fillStyle = '#475569';
        ctx.fillRect(toMapX(r - 12), toMapY(-24), roadW, 48 * mapScale);
        ctx.fillStyle = '#27272a';
      }
    }

    // 6. Draw CTA Elevated L-Train Track (Z = 104) & Live Moving Train
    const trackY = toMapY(104);
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(toMapX(-270), trackY);
    ctx.lineTo(toMapX(270), trackY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Moving 3-car CTA Red Line Train
    const trainMapX = toMapX(lTrainX);
    const trainLen = 62 * mapScale;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(trainMapX, trackY - 2.5, trainLen, 5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(trainMapX, trackY - 2.5, trainLen, 5);

    // 7. Draw Player Breadcrumb Trail
    const trail = trailRef.current;
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const tx = toMapX(trail[i].x);
        const ty = toMapY(trail[i].z);
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.lineTo(toMapX(playerPos.x), toMapY(playerPos.z));
      ctx.stroke();
    }

    // 8. Draw GPS Navigation Line to Pinned Landmark (or Active Blitz Checkpoint)
    if (gameMode === 'blitz' && checkpoints.length > 0) {
      const targetCp = checkpoints[currentCheckpointIdx % checkpoints.length];
      if (targetCp) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(toMapX(playerPos.x), toMapY(playerPos.z));
        ctx.lineTo(toMapX(targetCp.x), toMapY(targetCp.z));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (pinnedLandmark) {
      ctx.strokeStyle = pinnedLandmark.color;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(toMapX(playerPos.x), toMapY(playerPos.z));
      ctx.lineTo(toMapX(pinnedLandmark.x), toMapY(pinnedLandmark.z));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 9. Draw Blitz Checkpoints
    if (gameMode === 'blitz') {
      checkpoints.forEach((cp, idx) => {
        const isCurrent = idx === currentCheckpointIdx;
        if (!isCurrent && idx < currentCheckpointIdx) return;
        const cpx = toMapX(cp.x);
        const cpy = toMapY(cp.z);
        ctx.fillStyle = isCurrent ? '#22c55e' : '#15803d';
        ctx.beginPath();
        ctx.arc(cpx, cpy, isCurrent ? 5.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (isCurrent) {
          ctx.strokeStyle = '#bbf7d0';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    }

    // 10. Draw Traffic & Pursuing Police Cars
    for (const car of trafficCars) {
      const tx = toMapX(car.x);
      const ty = toMapY(car.z);
      if (Math.abs(tx) > cx + 10 || Math.abs(ty) > cy + 10) continue;

      if (car.isPolice) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(tx, ty, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(tx, ty, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore(); // Restore from rotated world space to screen-aligned mini-map space!

    // 11. Draw Key City Landmarks in Screen-Aligned Orientation (so text & icons are always upright and readable!)
    const cosR = Math.cos(mapRotation);
    const sinR = Math.sin(mapRotation);

    for (const lm of landmarks) {
      const rawX = (lm.x - centerWorldX) * mapScale;
      const rawY = (lm.z - centerWorldZ) * mapScale;

      // Rotate around map center
      let sx = rawX * cosR - rawY * sinR;
      let sy = rawX * sinR + rawY * cosR;

      const isPinned = pinnedLandmark?.id === lm.id;
      const maxEdge = radius - 10;
      const distFromCenter = Math.hypot(sx, sy);
      const isClamped = distFromCenter > maxEdge;

      if (isClamped) {
        // Only clamp pinned landmark or major towers/bridges so rim stays clean
        if (!isPinned && lm.category !== 'tower' && lm.category !== 'bridge') {
          continue;
        }
        const scaleBack = maxEdge / distFromCenter;
        sx *= scaleBack;
        sy *= scaleBack;
      }

      const drawX = cx + sx;
      const drawY = cy + sy;

      // Landmark marker diamond / badge
      ctx.save();
      ctx.translate(drawX, drawY);

      if (isPinned) {
        // Target ring around pinned landmark
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = lm.color;
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1.5;

      if (lm.category === 'tower') {
        // Star / Square badge for supertall tower
        ctx.fillRect(-4.5, -4.5, 9, 9);
        ctx.strokeRect(-4.5, -4.5, 9, 9);
      } else if (lm.category === 'bridge') {
        // Diamond badge for stunt drawbridges
        ctx.beginPath();
        ctx.moveTo(0, -5.5);
        ctx.lineTo(5.5, 0);
        ctx.lineTo(0, 5.5);
        ctx.lineTo(-5.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Circle badge for historic / transit / waterfront
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Crisp upright landmark short label
      if (!isClamped || isPinned || isExpanded) {
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const label = lm.shortLabel;
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
        ctx.fillRect(-textWidth / 2 - 2, -16, textWidth + 4, 10);

        ctx.fillStyle = isPinned ? '#ffffff' : lm.color;
        ctx.fillText(label, 0, -6.5);
      }

      ctx.restore();
    }

    // 12. Draw Player Marker & Heading FOV Cone
    const playerRawX = (playerPos.x - centerWorldX) * mapScale;
    const playerRawY = (playerPos.z - centerWorldZ) * mapScale;
    const px = cx + (playerRawX * cosR - playerRawY * sinR);
    const py = cy + (playerRawX * sinR + playerRawY * cosR);

    // Player chevron rotation on screen:
    // In Heading-Up mode, player always points UP (0 rad).
    // In North-Up mode, player points along their world heading: (Math.PI - playerPos.heading)
    const playerScreenAngle = isNorthUp ? Math.PI - playerPos.heading : 0;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(playerScreenAngle);

    // Translucent forward vision / headlight cone
    const coneGrad = ctx.createRadialGradient(0, 0, 2, 0, -28, 36);
    coneGrad.addColorStop(0, 'rgba(244, 63, 94, 0.42)');
    coneGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-18, -36);
    ctx.lineTo(18, -36);
    ctx.closePath();
    ctx.fill();

    // Crisp Player Vehicle Arrow
    ctx.fillStyle = '#f43f5e';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -8.5);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 13. Draw Compass North ('N') Indicator on Perimeter
    const northAngle = mapRotation - Math.PI / 2; // Since -Z (North) is at (0, -1) when mapRotation=0
    const nx = cx + Math.cos(northAngle) * (radius - 11);
    const ny = cy + Math.sin(northAngle) * (radius - 11);

    ctx.save();
    ctx.translate(nx, ny);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, 0.5);
    ctx.restore();

    // Outer frame border
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, h - 4, 16);
    ctx.stroke();

    ctx.restore();
  }, [
    playerPos,
    trafficCars,
    checkpoints,
    currentCheckpointIdx,
    gameMode,
    lTrainX,
    landmarks,
    pinnedLandmark,
    zoomIdx,
    isNorthUp,
    isExpanded,
    mapScale,
  ]);

  const cardinal = getCardinalDirection(playerPos.heading);
  const currentStreet = getStreetName(playerPos.x, playerPos.z);

  return (
    <div className="pointer-events-auto select-none flex flex-col space-y-2 z-30">
      {/* Main Persistent Mini-Map Card */}
      <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-2.5 shadow-2xl flex flex-col space-y-2">
        {/* Top Row: Map Canvas + Telemetry Readout */}
        <div className="flex items-start space-x-3">
          {/* Interactive Mini-Map Canvas */}
          <div className="relative shrink-0">
            <canvas
              ref={canvasRef}
              width={canvasSize}
              height={canvasSize}
              onClick={handleCanvasClick}
              title="Click any landmark on the map to set GPS waypoint"
              className="rounded-xl cursor-crosshair block"
              style={{ width: canvasSize, height: canvasSize }}
            />

            {/* Overlay Map Control Pill Buttons (Bottom of Map Canvas) */}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-auto">
              {/* Zoom Cycle Button */}
              <button
                onClick={() => setZoomIdx((prev) => (prev + 1) % ZOOM_SCALES.length)}
                title="Cycle Map Zoom Level"
                className="px-1.5 py-0.5 rounded bg-zinc-950/90 hover:bg-zinc-800 text-[10px] font-mono font-bold text-amber-400 border border-zinc-700/80 flex items-center space-x-1 transition cursor-pointer"
              >
                {zoomIdx === 2 ? <ZoomOut className="w-3 h-3" /> : <ZoomIn className="w-3 h-3" />}
                <span>{ZOOM_SCALES[zoomIdx].label}</span>
              </button>

              <div className="flex items-center space-x-1">
                {/* Heading-Up vs North-Up Toggle */}
                <button
                  onClick={() => setIsNorthUp((prev) => !prev)}
                  title="Toggle North-Up / Heading-Up Orientation [N]"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
                    isNorthUp
                      ? 'bg-sky-950/90 text-sky-300 border-sky-500/60'
                      : 'bg-zinc-950/90 text-zinc-300 border-zinc-700/80 hover:bg-zinc-800'
                  }`}
                >
                  {isNorthUp ? 'N-UP' : 'HDG'}
                </button>

                {/* Expand / Collapse Size Toggle */}
                <button
                  onClick={() => setIsExpanded((prev) => !prev)}
                  title="Expand / Collapse Tactical Map [M]"
                  className="p-1 rounded bg-zinc-950/90 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 transition cursor-pointer"
                >
                  {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Position, Street, & Landmark Telemetry */}
          <div className="flex flex-col justify-between font-mono min-w-[148px] max-w-[180px] space-y-1.5 py-0.5">
            {/* Mode & Vehicle Header */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {gameMode === 'blitz'
                      ? 'BLITZ RACE'
                      : gameMode === 'pursuit'
                      ? 'COP PURSUIT'
                      : 'CHICAGO GPS'}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 border border-zinc-800">
                  {cardinal}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 truncate mt-0.5">{vehicleName}</div>
            </div>

            {/* Current Street & Live Coordinates */}
            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-lg p-1.5 space-y-0.5">
              <div className="text-[9px] text-zinc-400 uppercase tracking-wider flex items-center space-x-1">
                <Navigation className="w-2.5 h-2.5 text-rose-400" />
                <span>Current Corridor</span>
              </div>
              <div className="text-[11px] font-bold text-white truncate" title={currentStreet}>
                {currentStreet}
              </div>
              <div className="text-[10px] text-zinc-400">
                POS: <span className="text-zinc-200">{Math.round(playerPos.x)}</span>,{' '}
                <span className="text-zinc-200">{Math.round(playerPos.z)}</span>
              </div>
            </div>

            {/* Nearest or Pinned Landmark Tracker */}
            {pinnedLandmark && (
              <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-lg p-1.5 space-y-0.5">
                <div className="flex items-center justify-between text-[9px] text-zinc-400 uppercase">
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-2.5 h-2.5" style={{ color: pinnedLandmark.color }} />
                    <span>GPS Target</span>
                  </span>
                  <span className="font-bold text-amber-300">{pinnedDistance}m</span>
                </div>
                <div className="text-[11px] font-bold truncate" style={{ color: pinnedLandmark.color }}>
                  {pinnedLandmark.name}
                </div>
                <div className="text-[9px] text-zinc-400 truncate">
                  Nearest: {nearestLandmarkInfo.landmark.shortLabel} ({nearestLandmarkInfo.distance}m)
                </div>
              </div>
            )}

            {/* Score & Mode-Specific Readout */}
            <div className="flex items-center justify-between pt-0.5 text-[11px]">
              <span className="text-amber-400 font-bold">SCORE: {score}</span>
              {gameMode === 'blitz' && (
                <span className="text-emerald-400 font-bold">
                  CP {currentCheckpointIdx + 1}/{checkpoints.length || 8} ({Math.ceil(blitzTimeRemaining)}s)
                </span>
              )}
              {gameMode === 'pursuit' && (
                <span className={policeNearCount > 0 ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                  {policeNearCount > 0 ? `${policeNearCount} COPS` : 'CLEAR'}
                </span>
              )}
            </div>

            {/* Toggle Landmarks Directory Drawer */}
            <button
              onClick={() => setShowLandmarkList((prev) => !prev)}
              className="w-full py-1 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[10px] font-semibold text-zinc-200 flex items-center justify-between transition cursor-pointer"
            >
              <span className="flex items-center space-x-1">
                <Compass className="w-3 h-3 text-amber-400" />
                <span>City Landmarks ({landmarks.length})</span>
              </span>
              {showLandmarkList ? (
                <ChevronUp className="w-3 h-3 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Key City Landmarks Directory & Fast-Pin / Teleport List */}
        {showLandmarkList && (
          <div className="pt-2 border-t border-zinc-800/90 space-y-1 max-h-52 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 px-1 mb-1">
              <span>CLICK TO PIN GPS WAYPOINT</span>
              <span>DIST / GO</span>
            </div>
            {landmarks.map((lm) => {
              const dist = Math.round(Math.hypot(lm.x - playerPos.x, lm.z - playerPos.z));
              const isPinned = pinnedLandmarkId === lm.id;
              return (
                <div
                  key={lm.id}
                  onClick={() => setPinnedLandmarkId(lm.id)}
                  className={`flex items-center justify-between p-1.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
                    isPinned
                      ? 'bg-zinc-800/95 border-amber-500/70 text-white'
                      : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: lm.color }}
                    />
                    <div className="truncate">
                      <div className="font-bold text-[11px] leading-tight truncate">{lm.name}</div>
                      <div className="text-[9px] text-zinc-400 truncate">{lm.description}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                    <span className="text-[10px] text-amber-400 font-bold">{dist}m</span>
                    {onTeleportToLandmark && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedLandmarkId(lm.id);
                          onTeleportToLandmark(lm.x, lm.z);
                        }}
                        title={`Drive straight to ${lm.name}`}
                        className="px-1.5 py-0.5 rounded bg-zinc-950 hover:bg-rose-600 text-[9px] font-bold text-zinc-200 hover:text-white border border-zinc-700 transition cursor-pointer flex items-center space-x-0.5"
                      >
                        <Crosshair className="w-2.5 h-2.5" />
                        <span>GO</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
