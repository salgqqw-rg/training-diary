// Supabase отдаёт не больше 1000 строк за запрос и молча обрезает остальное:
// без постраничного чтения у активного пользователя пропадали бы подходы из графиков и рекордов.
// page(from, to) должен строить новый запрос с .order(...) (стабильный порядок) и .range(from, to).
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000,
  max = 100_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}
