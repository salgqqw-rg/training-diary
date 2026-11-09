// Столбики по дням с линией нормы. Серверный компонент: подписи обычным текстом, чтобы читались на телефоне.
// values[i] === null — в этот день данных нет (пустое место, не нулевой столбик).
export function Bars({
  values,
  labels,
  target,
  height = 170,
}: {
  values: (number | null)[];
  labels: string[];
  target?: number;
  height?: number;
}) {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  const top = Math.max(...nums, target ?? 0) * 1.12;
  const pct = (v: number) => `${Math.max(2, (v / top) * 100)}%`;
  // Плотные ряды (30 дней): подпись у каждого пятого и у последнего
  const every = values.length > 8;
  const showLabel = (i: number) => !every || i % 5 === 0 || i === values.length - 1;

  return (
    <div className="bars-wrap">
      {target ? <p className="bars-legend"><i />норма {Math.round(target)}</p> : null}
      <div className="bars" style={{ height }} role="img" aria-label="Столбики по дням">
        {target ? <div className="bars-target" style={{ bottom: `${(target / top) * 100}%` }} /> : null}
        {values.map((v, i) => (
          <div key={i} className="bars-col">
            {v !== null && <i className={target && v > target ? "over" : undefined} style={{ height: pct(v) }} title={`${labels[i]}: ${Math.round(v)}`} />}
          </div>
        ))}
      </div>
      <div className="bars-labels">
        {labels.map((l, i) => <span key={i}>{showLabel(i) ? l : ""}</span>)}
      </div>
    </div>
  );
}
