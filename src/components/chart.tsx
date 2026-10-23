// Серверный линейный график (лаймовая линия с заливом — как в макете IRONLOG)
// values: значения по порядку; labels: подписи крайних точек; gradId: уникальный id градиента
export function Line({
  values,
  labels,
  height = 260,
  gradId = "lg",
}: {
  values: number[];
  labels?: string[];
  height?: number;
  gradId?: string;
}) {
  if (!values.length) return null;
  const W = 600;
  const pad = 14;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const px = (i: number) => (values.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (values.length - 1));
  const py = (v: number) => 14 + (1 - (v - min) / span) * (height - 30);
  const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const base = height - 10;
  const last = values.length - 1;

  return (
    <div className="line-wrap">
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a3e635" stopOpacity=".38" />
            <stop offset="1" stopColor="#a3e635" stopOpacity="0" />
          </linearGradient>
        </defs>
        {values.length >= 2 && (
          <polygon points={`${px(0)},${base} ${pts} ${px(last)},${base}`} fill={`url(#${gradId})`} />
        )}
        {values.length >= 2 && (
          <polyline points={pts} fill="none" stroke="#a3e635" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {values.map((v, i) => (
          <circle key={i} cx={px(i)} cy={py(v)} r={i === last ? 5.5 : 4} fill="#a3e635" />
        ))}
      </svg>
      {labels?.length === 2 && <div className="chart-labels"><span>{labels[0]}</span><span>{labels[1]}</span></div>}
    </div>
  );
}
