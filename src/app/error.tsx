"use client";

import Link from "next/link";
import { useEffect } from "react";

// Страница ошибки вместо «голого» экрана Next, если запрос к базе или серверный код упал
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card narrow">
      <h2>Что-то пошло не так</h2>
      <p className="muted">
        Не удалось загрузить страницу. Попробуйте ещё раз — чаще всего это временный сбой связи с базой.
      </p>
      {error.digest && <p className="muted" style={{ fontSize: 12 }}>Код ошибки: {error.digest}</p>}
      <div className="row">
        <button className="primary" onClick={() => reset()}>Повторить</button>
        <Link href="/" className="sm-link">На главную</Link>
      </div>
    </div>
  );
}
