function dims(area: number): [number, number] {
  const w = Math.max(6, Math.round(Math.sqrt(area / 1.75)));
  return [w, Math.round(area / w)];
}

const STREETS: Record<string, string[]> = {
  "واجهة واحدة": ["b"],
  "ناصية": ["b", "s"],
  "دبل فيس": ["b", "t"],
  "تربل فيس": ["b", "t", "s"],
};
// Compass turned so the street-facing side (bottom) points the way the plot faces.
const ROT: Record<string, number> = { "قبلي": 0, "شرقي": 90, "بحري": 180, "غربي": -90 };

type Props = { area: number; pos?: string | null; dir?: string | null; front?: number | null; big?: boolean };

// Top-down sketch of the plot: streets on the sides the listing says face a street, neighbours elsewhere.
export default function Sketch({ area, pos, dir, front, big = false }: Props) {
  const [w, d] = dims(area);
  const S = Math.min(120 / w, 92 / d);
  const W = w * S, D = d * S;
  const x = (240 - W) / 2, y = (150 - D) / 2 - 6;
  const streets = STREETS[pos ?? ""] ?? ["b"];
  const road = "#E2E0D8";
  const label = (tx: number, ty: number, r = 0) => (
    <text x={tx} y={ty} fontSize="8" fill="#6B7570" textAnchor="middle" transform={r ? `rotate(${r} ${tx} ${ty})` : undefined}>شارع</text>
  );
  return (
    <svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true" fontFamily="Almarai, sans-serif">
      {streets.includes("b") && (<><rect x="0" y={y + D + 4} width="240" height="18" fill={road} />{label(120, y + D + 16)}</>)}
      {streets.includes("t") && (<><rect x="0" y={y - 22} width="240" height="18" fill={road} />{label(120, y - 10)}</>)}
      {streets.includes("s") && (<><rect x={x + W + 4} y="0" width="18" height="150" fill={road} />{label(x + W + 16, 75, 90)}</>)}
      <rect x={x - W * 0.8 - 4} y={y} width={W * 0.8} height={D} fill="#fff" stroke="#D3D0C5" />
      {!streets.includes("s") && <rect x={x + W + 4} y={y} width={W * 0.8} height={D} fill="#fff" stroke="#D3D0C5" />}
      {!streets.includes("t") && <rect x={x} y={y - D * 0.5 - 4} width={W} height={D * 0.5} fill="#fff" stroke="#D3D0C5" />}
      <rect x={x} y={y} width={W} height={D} fill="#FBF1D6" stroke="#0A3022" strokeWidth="1.6" />
      <text x={x + W / 2} y={y + D / 2 + 5} textAnchor="middle" fontSize={big ? 14 : 15} fontWeight="700" fill="#0A3022">{area} م²</text>
      {big && front ? <text x={x + W / 2} y={y + D - 6} textAnchor="middle" fontSize="7.5" fill="#A87E14">واجهة {front} م</text> : null}
      {dir && (
        <>
          <g transform="translate(20 20)">
            <circle r="12" fill="#fff" stroke="#D3D0C5" />
            <g transform={`rotate(${ROT[dir] ?? 0})`}><path d="M0-8 4 4 0 1-4 4Z" fill="#0A3022" /></g>
          </g>
          <text x="20" y="44" fontSize="7" fill="#6B7570" textAnchor="middle">{dir}</text>
        </>
      )}
    </svg>
  );
}
