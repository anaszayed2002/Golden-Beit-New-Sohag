import { useId } from "react";

const DIMS: Record<number, [number, number]> = { 209: [11, 19], 276: [12, 23], 500: [20, 25], 600: [20, 30] };

function dims(area: number): [number, number] {
  if (DIMS[area]) return DIMS[area];
  const w = Math.max(4, Math.round(Math.sqrt(area / 1.7)));
  return [w, Math.max(4, Math.round(area / w))];
}

// Top-down sketch of the plot between two neighbours, facing the street. Drawn to scale.
export default function Plot({ area, big = false }: { area: number; big?: boolean }) {
  const pid = "h" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [w, d] = dims(area);
  const S = Math.min(150 / w, 110 / d);
  const W = w * S, D = d * S;
  const x = (240 - W) / 2, y = (150 - D) / 2 - 4;
  const font = "Almarai, sans-serif";
  return (
    <svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <pattern id={pid} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#E2B43A" strokeOpacity=".35" strokeWidth="3" />
        </pattern>
      </defs>
      <rect x="0" y={y + D + 6} width="240" height="30" fill="#E2E0D8" />
      <text x="120" y={y + D + 25} textAnchor="middle" fontSize="9" fill="#6B7570" fontFamily={font}>شارع</text>
      <rect x={x - W * 0.9} y={y} width={W * 0.82} height={D} fill="#fff" stroke="#D3D0C5" />
      <rect x={x + W * 1.08} y={y} width={W * 0.82} height={D} fill="#fff" stroke="#D3D0C5" />
      <rect x={x} y={y} width={W} height={D} fill="#FBF1D6" stroke="#0A3022" strokeWidth="1.6" />
      <rect x={x} y={y} width={W} height={D} fill={`url(#${pid})`} />
      <text x={x + W / 2} y={y + D / 2 + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#0A3022" fontFamily={font}>{area} م²</text>
      {big && (
        <>
          <line x1={x} y1={y - 6} x2={x + W} y2={y - 6} stroke="#0A3022" strokeWidth=".8" />
          <text x={x + W / 2} y={y - 9} textAnchor="middle" fontSize="8" fill="#0A3022" fontFamily={font}>{w} م</text>
          <line x1={x + W + 5} y1={y} x2={x + W + 5} y2={y + D} stroke="#0A3022" strokeWidth=".8" />
          <text x={x + W + 9} y={y + D / 2} fontSize="8" fill="#0A3022" fontFamily={font} textAnchor="middle" transform={`rotate(90 ${x + W + 9} ${y + D / 2})`}>{d} م</text>
        </>
      )}
    </svg>
  );
}
