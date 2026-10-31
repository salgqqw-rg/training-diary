// Куда можно перенаправлять после входа: только путь внутри сайта.
// «//host» и «/\host» браузер читает как чужой адрес — такие значения отбрасываем.
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
