import { headers } from "next/headers";

// Диагностика адресов возврата (для настройки Supabase Redirect URLs):
// показывает публичный адрес этой страницы и готовые строки для белого списка
export default async function DiagPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "?";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  return (
    <div className="card narrow">
      <h2>Диагностика адреса</h2>
      <p className="muted" style={{ fontSize: 13.5 }}>
        Открывай эту страницу там же, где будешь открывать ссылку из письма.
        В <b>Supabase → Authentication → URL Configuration → Redirect URLs</b> добавь строку:
      </p>
      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, margin: "10px 0 8px", wordBreak: "break-all" }}>
        {origin}/**
      </p>
      <p className="muted" style={{ fontSize: 13 }}>Рекомендуемый список целиком:</p>
      <ul style={{ margin: "4px 0 10px", paddingLeft: 18, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7 }}>
        <li style={{ fontFamily: "ui-monospace, monospace" }}>https://*.trycloudflare.com/**</li>
        <li style={{ fontFamily: "ui-monospace, monospace" }}>https://training-diary-lemon.vercel.app/**</li>
        <li style={{ fontFamily: "ui-monospace, monospace" }}>http://localhost:3000/**</li>
      </ul>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        Хост этой страницы: <span style={{ color: "var(--acc)", fontWeight: 700 }}>{host}</span>
      </p>
    </div>
  );
}
