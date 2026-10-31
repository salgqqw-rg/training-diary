import { redirect } from "next/navigation";

// «Статистика» объединена с «Прогрессом»: старые ссылки ведут на вкладку «Обзор»
export default function StatsPage() {
  return redirect("/progress?tab=overview");
}
