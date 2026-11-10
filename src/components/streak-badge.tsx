import { FlameIcon, DumbbellIcon } from "@/components/icons";

// 1 день, 2 дня, 5 дней, 21 день
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

// Питание: огонёк горит, если еда за сегодня записана; тлеет, если серия есть, а сегодня записей нет; серый без серии.
// Тренировки: счётчик записей, подряд не требуется.
export function StreakBadge({ food, workouts }: { food: { count: number; doneToday: boolean }; workouts: number }) {
  const state = food.count === 0 ? "off" : food.doneToday ? "on" : "risk";
  const hint = state === "off" ? "Запиши еду — начнётся серия" : state === "risk" ? "Запиши еду сегодня, чтобы не потерять серию" : "Серия идёт: еда за сегодня записана";
  return (
    <div className="streaks">
      <div className={`streak ${state}`} title={hint}>
        <FlameIcon />
        <div>
          <span>Питание</span>
          <b>{food.count} {plural(food.count, "день", "дня", "дней")} подряд</b>
        </div>
      </div>
      <div className={workouts ? "streak work" : "streak work off"}>
        <DumbbellIcon />
        <div>
          <span>Тренировки</span>
          <b>{workouts} {plural(workouts, "запись", "записи", "записей")}</b>
        </div>
      </div>
    </div>
  );
}
