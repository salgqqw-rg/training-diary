import { MUSCLES, type Muscle } from "@/lib/exercise-catalog";

// Схема тела спереди и сзади. Основная мышца — яркая, вспомогательные — приглушённые.
type Shape = { m: Muscle; d: string; mirror?: boolean };

// Правая половина тела (x от 60 к 120); зеркальные фигуры отражаются относительно x=60
const FRONT: Shape[] = [
  { m: "shoulders", d: "M66 52 q14 -4 20 10 l-2 14 q-10 -4 -18 -6z", mirror: true },
  { m: "chest", d: "M62 56 q16 -2 22 8 q0 10 -10 14 q-10 0 -12 -8z", mirror: true },
  { m: "biceps", d: "M87 80 q6 2 6 12 l-1 12 q-6 0 -8 -4 q-2 -10 1 -20z", mirror: true },
  { m: "forearms", d: "M86 108 q6 2 9 22 l-3 6 q-6 -8 -8 -24z", mirror: true },
  { m: "abs", d: "M62 82 q10 -2 14 2 l-1 30 q-8 4 -13 0z", mirror: true },
  { m: "quads", d: "M62 124 q14 -4 18 8 l-3 44 q-10 4 -16 -2z", mirror: true },
  { m: "calves", d: "M64 184 q10 -2 12 6 l-3 36 q-6 2 -8 -2z", mirror: true },
];
const BACK: Shape[] = [
  { m: "traps", d: "M60 44 q12 2 20 12 l-8 10 q-8 -2 -12 -6z", mirror: true },
  { m: "shoulders", d: "M80 56 q8 -2 8 12 l-2 8 q-8 -2 -12 -8z", mirror: true },
  { m: "back", d: "M62 70 q14 -4 20 6 l-4 30 q-8 4 -16 0z", mirror: true },
  { m: "triceps", d: "M88 80 q6 2 6 12 l-1 14 q-6 0 -8 -4 q-2 -10 1 -20z", mirror: true },
  { m: "forearms", d: "M87 110 q6 2 9 22 l-3 6 q-6 -8 -8 -24z", mirror: true },
  { m: "glutes", d: "M62 116 q14 -4 18 8 l-1 16 q-10 4 -17 -2z", mirror: true },
  { m: "hamstrings", d: "M62 146 q14 -4 17 6 l-3 32 q-10 4 -14 -2z", mirror: true },
  { m: "calves", d: "M64 186 q10 -2 12 6 l-3 34 q-6 2 -8 -2z", mirror: true },
];

function Body({ shapes, main, also, label }: { shapes: Shape[]; main: Muscle; also: Muscle[]; label: string }) {
  const cls = (m: Muscle) => (m === main ? "mm-main" : also.includes(m) ? "mm-also" : "");
  return (
    <figure className="mm-fig">
      <svg viewBox="0 0 120 240" role="img" aria-label={`${label}: ${MUSCLES[main]}`}>
        {/* силуэт */}
        <g className="mm-body">
          <circle cx="60" cy="22" r="14" />
          <path d="M60 38 q-30 0 -34 22 l-6 52 q0 8 6 8 l6 18 l-2 36 l4 62 q0 6 6 6 h8 q4 0 4 -6 l2 -60 l2 0 l2 60 q0 6 4 6 h8 q6 0 6 -6 l4 -62 l-2 -36 l6 -18 q6 0 6 -8 l-6 -52 q-4 -22 -34 -22z" />
        </g>
        {shapes.map((s, i) => (
          <g key={i} className={cls(s.m)}>
            <path d={s.d} />
            {s.mirror && <path d={s.d} transform="translate(120 0) scale(-1 1)" />}
          </g>
        ))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({ main, also = [] }: { main: Muscle; also?: Muscle[] }) {
  if (main === "cardio") return null;
  return (
    <div className="mm">
      <Body shapes={FRONT} main={main} also={also} label="Спереди" />
      <Body shapes={BACK} main={main} also={also} label="Сзади" />
    </div>
  );
}
