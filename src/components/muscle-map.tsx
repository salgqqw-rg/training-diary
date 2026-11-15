import { MUSCLES, type Muscle } from "@/lib/exercise-catalog";

// Схема тела спереди и сзади. Основная мышца — яркая, вспомогательные — приглушённые.
// Рисуем правую половину (x от 100 к 200), левая — зеркальное отражение относительно x = 100.
type Shape = { m: Muscle; d: string };

// Силуэт (правая половина): торс, рука, нога
const TORSO = "M100 62 C112 62 126 66 138 74 C144 80 143 92 140 104 C138 120 134 140 130 160 C132 172 134 180 134 190 L100 190 Z";
const ARM = "M138 76 C150 76 158 86 159 100 C160 118 162 140 163 158 C164 172 164 184 161 194 L149 194 C148 176 148 160 147 146 C146 130 145 112 143 100 C141 92 138 86 138 76 Z";
const LEG = "M102 186 L134 186 C138 220 136 250 130 285 C128 300 128 322 126 346 C126 366 126 382 129 394 L106 394 C106 370 104 340 104 300 C103 260 102 220 102 186 Z";

const DELT = "M128 68 C140 66 152 74 153 92 L148 104 C142 98 136 88 130 78 Z";
const ARM_UPPER_FRONT = "M148 104 C154 102 160 110 160 124 C160 134 160 140 159 146 C154 148 149 146 148 140 C146 128 146 114 148 104 Z";
const ARM_UPPER_BACK = "M148 100 C155 98 160 106 160 122 C160 134 159 142 158 148 C153 150 149 148 148 142 C146 128 146 112 148 100 Z";
const FOREARM = "M149 152 C155 150 162 152 163 164 C164 176 163 186 160 192 L150 192 C149 178 148 164 149 152 Z";

const FRONT: Shape[] = [
  { m: "shoulders", d: DELT },
  { m: "chest", d: "M102 78 C112 74 126 76 134 82 C136 92 130 104 118 106 C108 106 102 100 102 94 Z" },
  { m: "biceps", d: ARM_UPPER_FRONT },
  { m: "forearms", d: FOREARM },
  { m: "abs", d: "M102 110 C108 108 116 108 120 112 L119 156 C114 160 106 160 102 158 Z" },
  { m: "abs", d: "M123 114 C129 118 132 132 130 150 C128 156 124 158 121 158 Z" },
  { m: "quads", d: "M104 196 C114 192 130 194 134 208 C136 230 134 252 128 272 C120 278 110 276 106 266 C102 240 102 214 104 196 Z" },
  { m: "calves", d: "M110 296 C118 290 126 292 128 304 C128 326 126 342 123 354 C116 358 111 352 110 340 C108 322 108 308 110 296 Z" },
];

const BACK: Shape[] = [
  { m: "traps", d: "M101 56 C112 60 126 68 134 76 C126 84 114 96 101 118 Z" },
  { m: "shoulders", d: DELT },
  { m: "back", d: "M102 122 C108 104 124 90 134 88 C138 100 136 122 124 144 C116 150 108 144 102 138 Z" },
  { m: "back", d: "M102 146 C110 150 118 152 124 152 L124 168 C114 170 106 168 102 166 Z" },
  { m: "triceps", d: ARM_UPPER_BACK },
  { m: "forearms", d: FOREARM },
  { m: "glutes", d: "M102 170 C112 166 130 168 134 184 C134 198 126 206 114 206 C106 206 102 198 102 190 Z" },
  { m: "hamstrings", d: "M104 212 C114 210 130 212 134 226 C136 246 132 264 126 276 C118 280 110 278 106 268 C102 246 102 228 104 212 Z" },
  { m: "calves", d: "M110 292 C120 286 128 292 128 306 C128 322 125 338 121 352 C114 356 110 348 109 334 C107 318 108 304 110 292 Z" },
];

const MIRROR = "translate(200 0) scale(-1 1)";

function Both({ d }: { d: string }) {
  return (
    <>
      <path d={d} />
      <path d={d} transform={MIRROR} />
    </>
  );
}

function Body({ shapes, main, also, label }: { shapes: Shape[]; main: Muscle; also: Muscle[]; label: string }) {
  const cls = (m: Muscle) => (m === main ? "mm-main" : also.includes(m) ? "mm-also" : "mm-idle");
  return (
    <figure className="mm-fig">
      <svg viewBox="0 0 200 400" role="img" aria-label={`${label}: ${MUSCLES[main]}`}>
        {/* силуэт */}
        <g className="mm-body">
          <ellipse cx="100" cy="30" rx="17" ry="21" />
          <rect x="92" y="46" width="16" height="20" rx="5" />
          <Both d={TORSO} />
          <Both d={ARM} />
          <Both d={LEG} />
        </g>
        {/* мышцы: сначала приглушённые, потом выбранные — чтобы подсветка была сверху */}
        {(["mm-idle", "mm-also", "mm-main"] as const).map((c) => (
          <g key={c} className={c}>
            {shapes.filter((s) => cls(s.m) === c).map((s, i) => <Both key={i} d={s.d} />)}
          </g>
        ))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({ main, also = [] }: { main: Muscle; also?: Muscle[] }) {
  if (main === "cardio") return null;
  const extra = also.filter((m) => m !== main && m !== "cardio");
  return (
    <div className="mm-wrap">
      <div className="mm">
        <Body shapes={FRONT} main={main} also={extra} label="Спереди" />
        <Body shapes={BACK} main={main} also={extra} label="Сзади" />
      </div>
      <ul className="mm-legend">
        <li><i className="mm-dot main" />{MUSCLES[main]}</li>
        {extra.length > 0 && <li><i className="mm-dot also" />{extra.map((m) => MUSCLES[m]).join(", ")}</li>}
      </ul>
    </div>
  );
}
