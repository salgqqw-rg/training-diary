import Link from "next/link";

// Своя страница 404 — вместо технического текста Next.js
export default function NotFound() {
  return (
    <div className="card narrow" style={{ textAlign: "center" }}>
      <h2>Страница не найдена</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        Такой страницы нет — возможно, ссылка устарела или план был удалён.
      </p>
      <Link
        href="/"
        className="banner-btn"
        style={{ display: "inline-block", margin: "10px 0 0" }}
      >
        На главную
      </Link>
    </div>
  );
}
