import React, { useState, useEffect } from 'react';
import { Flame, ShieldAlert } from 'lucide-react';

interface SpeedometerGaugeProps {
  speedMph: number;
  maxVehicleSpeedMph: number;
  rpm: number;
  gear: number | string;
  damagePercent: number;
  nitroRemaining: number;
  nitroCapacity: number;
  isNitroActive: boolean;
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  speedMph,
  maxVehicleSpeedMph,
  rpm,
  gear,
  damagePercent,
  nitroRemaining,
  nitroCapacity,
  isNitroActive,
}) => {
  const [unit, setUnit] = useState<'MPH' | 'KMH'>('MPH');
  const [peakSpeedMph, setPeakSpeedMph] = useState<number>(0);

  useEffect(() => {
    if (speedMph > peakSpeedMph) {
      setPeakSpeedMph(speedMph);
    }
  }, [speedMph, peakSpeedMph]);

  // Dial scale: 0 to 220 MPH (or 0 to 160 MPH for heavy vehicles so the needle uses the full sweep)
  const maxDialMph = maxVehicleSpeedMph <= 125 ? 160 : 220;
  const displaySpeed = unit === 'MPH' ? Math.round(speedMph) : Math.round(speedMph * 1.60934);
  const displayPeak = unit === 'MPH' ? Math.round(peakSpeedMph) : Math.round(peakSpeedMph * 1.60934);

  // Angle geometry: 240-degree sweep from -210 deg (bottom-left) to +30 deg (bottom-right)
  const startAngleDeg = -210;
  const endAngleDeg = 30;
  const totalSweepDeg = endAngleDeg - startAngleDeg; // 240 degrees

  const clampedSpeed = Math.min(Math.max(speedMph, 0), maxDialMph);
  const speedRatio = clampedSpeed / maxDialMph;
  const needleAngleDeg = startAngleDeg + speedRatio * totalSweepDeg;

  // RPM ratio (1000 to 7500 RPM)
  const rpmRatio = Math.min(Math.max((rpm - 1000) / 6500, 0), 1);
  const isRedlineRpm = rpm >= 6400;

  // SVG dimensions
  const size = 196;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const outerRadius = 78;
  const rpmRadius = 56;

  // Polar to Cartesian helper (angle in degrees where 0 is +X right, -90 is UP)
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  // SVG Arc path generator
  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  // Generate tick marks every 10 MPH (minor) and 20 MPH (major)
  const ticks = [];
  const stepMph = 10;
  for (let s = 0; s <= maxDialMph; s += stepMph) {
    const ratio = s / maxDialMph;
    const angle = startAngleDeg + ratio * totalSweepDeg;
    const isMajor = s % 20 === 0;
    const isOverTopSpeed = s > maxVehicleSpeedMph;

    const innerTickR = isMajor ? outerRadius - 10 : outerRadius - 5;
    const outerTickR = outerRadius - 1;
    const p1 = polarToCartesian(cx, cy, innerTickR, angle);
    const p2 = polarToCartesian(cx, cy, outerTickR, angle);

    const labelPos = polarToCartesian(cx, cy, outerRadius - 20, angle);
    const labelValue = unit === 'MPH' ? s : Math.round(s * 1.60934);

    ticks.push({
      s,
      isMajor,
      isOverTopSpeed,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      lx: labelPos.x,
      ly: labelPos.y,
      labelValue,
    });
  }

  // Active speed arc color
  const speedArcColor = isNitroActive
    ? '#22d3ee'
    : speedMph > maxVehicleSpeedMph * 0.88
    ? '#f43f5e'
    : speedMph > maxVehicleSpeedMph * 0.55
    ? '#f59e0b'
    : '#10b981';

  const activeSpeedEndAngle = startAngleDeg + Math.max(speedRatio, 0.005) * totalSweepDeg;
  const activeRpmEndAngle = startAngleDeg + Math.max(rpmRatio, 0.005) * totalSweepDeg;

  // Top speed redline arc start
  const redlineStartRatio = Math.min(maxVehicleSpeedMph / maxDialMph, 0.98);
  const redlineStartAngle = startAngleDeg + redlineStartRatio * totalSweepDeg;

  // Needle tip & tail coordinates
  const needleTip = polarToCartesian(cx, cy, outerRadius - 6, needleAngleDeg);
  const needleTail = polarToCartesian(cx, cy, -14, needleAngleDeg);
  const needleLeft = polarToCartesian(cx, cy, 4.5, needleAngleDeg - 90);
  const needleRight = polarToCartesian(cx, cy, 4.5, needleAngleDeg + 90);

  const nitroPercent = Math.min(Math.max((nitroRemaining / Math.max(nitroCapacity, 1)) * 100, 0), 100);

  return (
    <div className="pointer-events-auto select-none flex items-end space-x-2.5 font-mono">
      {/* Left Side Compact Telemetry Stack: Damage & Nitro Bars */}
      <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3 shadow-2xl w-44 space-y-2.5">
        {/* Vehicle Damage Meter */}
        <div>
          <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
            <span className="flex items-center space-x-1 font-bold tracking-wider">
              <ShieldAlert
                className={`w-3.5 h-3.5 ${
                  damagePercent > 75
                    ? 'text-rose-500'
                    : damagePercent > 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              />
              <span>CHASSIS DMG</span>
            </span>
            <span
              className={`font-bold ${
                damagePercent > 75
                  ? 'text-rose-500'
                  : damagePercent > 40
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {damagePercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                damagePercent > 75
                  ? 'bg-rose-600'
                  : damagePercent > 40
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${damagePercent}%` }}
            />
          </div>
        </div>

        {/* Nitro Boost Meter */}
        <div>
          <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
            <span className="flex items-center space-x-1 font-bold tracking-wider">
              <Flame className={`w-3.5 h-3.5 ${isNitroActive ? 'text-cyan-300' : 'text-cyan-500'}`} />
              <span>NITRO N2O</span>
            </span>
            <span className="font-bold text-cyan-400">{ nitroRemaining.toFixed(1) }s</span>
          </div>
          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100 rounded-full"
              style={{ width: `${nitroPercent}%` }}
            />
          </div>
        </div>

        {/* Session Peak Speed & RPM Digital Sub-Readout */}
        <div className="pt-1.5 border-t border-zinc-800/90 flex items-center justify-between text-[10px]">
          <div>
            <span className="text-zinc-500 block">PEAK SPEED</span>
            <span className="text-amber-400 font-bold">
              {displayPeak} {unit}
            </span>
          </div>
          <div className="text-right">
            <span className="text-zinc-500 block">ENGINE RPM</span>
            <span className={`font-bold ${isRedlineRpm ? 'text-rose-400' : 'text-zinc-200'}`}>
              {Math.round(rpm).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Analog + Digital Speedometer Dial Gauge */}
      <div className="relative bg-zinc-950/95 border-2 border-zinc-800 rounded-full shadow-2xl p-1.5 flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
          <defs>
            <radialGradient id="dialFaceGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#18181b" />
              <stop offset="75%" stopColor="#09090b" />
              <stop offset="100%" stopColor="#050507" />
            </radialGradient>
          </defs>

          {/* Outer Metallic Bezel Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={outerRadius + 8}
            fill="url(#dialFaceGrad)"
            stroke="#27272a"
            strokeWidth="3"
          />

          {/* Background Speed Track Arc */}
          <path
            d={describeArc(cx, cy, outerRadius, startAngleDeg, endAngleDeg)}
            fill="none"
            stroke="#27272a"
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Over-Top-Speed Boost Zone Arc */}
          <path
            d={describeArc(cx, cy, outerRadius, redlineStartAngle, endAngleDeg)}
            fill="none"
            stroke="rgba(244, 63, 94, 0.35)"
            strokeWidth="7"
            strokeLinecap="butt"
          />

          {/* Active Real-Time Speed Sweep Arc */}
          <path
            d={describeArc(cx, cy, outerRadius, startAngleDeg, activeSpeedEndAngle)}
            fill="none"
            stroke={speedArcColor}
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Inner Concentric Tachometer (RPM) Background Track */}
          <path
            d={describeArc(cx, cy, rpmRadius, startAngleDeg, endAngleDeg)}
            fill="none"
            stroke="#18181b"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* Inner Concentric Tachometer (RPM) Active Sweep */}
          <path
            d={describeArc(cx, cy, rpmRadius, startAngleDeg, activeRpmEndAngle)}
            fill="none"
            stroke={isRedlineRpm ? '#f43f5e' : '#38bdf8'}
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* Dial Tick Marks & Speed Numbers */}
          {ticks.map((t) => (
            <g key={t.s}>
              <line
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.isOverTopSpeed ? '#f43f5e' : t.isMajor ? '#f4f4f5' : '#71717a'}
                strokeWidth={t.isMajor ? '2.2' : '1.2'}
              />
              {t.isMajor && (
                <text
                  x={t.lx}
                  y={t.ly}
                  fill={t.isOverTopSpeed ? '#fb7185' : '#d4d4d8'}
                  fontSize="9.5"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {t.labelValue}
                </text>
              )}
            </g>
          ))}

          {/* RPM Label on Inner Ring */}
          <text
            x={cx}
            y={cy - 28}
            fill="#71717a"
            fontSize="7.5"
            fontWeight="700"
            letterSpacing="1.2"
            textAnchor="middle"
          >
            x1000 RPM
          </text>

          {/* Gear Indicator Box (Upper Center-Right of Dial) */}
          <g transform={`translate(${cx - 13}, ${cy - 22})`}>
            <rect
              x="0"
              y="0"
              width="26"
              height="22"
              rx="5"
              fill="#18181b"
              stroke={isRedlineRpm ? '#f43f5e' : '#3f3f46'}
              strokeWidth="1.5"
            />
            <text
              x="13"
              y="15"
              fill={gear === 'R' ? '#fb7185' : isRedlineRpm ? '#f43f5e' : '#facc15'}
              fontSize="14"
              fontWeight="900"
              textAnchor="middle"
            >
              {gear}
            </text>
          </g>

          {/* Sweeping Analog Speedometer Needle */}
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleLeft.x},${needleLeft.y} ${needleTail.x},${needleTail.y} ${needleRight.x},${needleRight.y}`}
            fill={isNitroActive ? '#22d3ee' : '#f43f5e'}
            stroke="#ffffff"
            strokeWidth="0.6"
          />

          {/* Center Metallic Spindle Cap */}
          <circle cx={cx} cy={cy} r="9" fill="#27272a" stroke="#71717a" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="3.5" fill={isNitroActive ? '#22d3ee' : '#f43f5e'} />
        </svg>

        {/* Bottom Digital LCD Speed Readout Window & Unit Toggle */}
        <button
          onClick={() => setUnit((prev) => (prev === 'MPH' ? 'KMH' : 'MPH'))}
          title="Click to toggle between MPH and KM/H"
          className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-zinc-900/95 hover:bg-zinc-800 border border-zinc-700/90 rounded-xl px-3 py-1 flex flex-col items-center shadow-inner transition cursor-pointer"
        >
          <span className="text-2xl font-black leading-none tracking-tight text-white">
            {displaySpeed}
          </span>
          <span className="text-[9px] font-bold tracking-widest text-amber-400 mt-0.5">
            {unit === 'MPH' ? 'MPH' : 'KM/H'}
          </span>
        </button>
      </div>
    </div>
  );
};
