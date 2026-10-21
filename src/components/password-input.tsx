"use client";

import { useState } from "react";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="sm"
        onClick={() => setShow(!show)}
        aria-label={show ? "Скрыть пароль" : "Показать пароль"}
      >
        {show ? "Скрыть" : "Показать"}
      </button>
    </div>
  );
}