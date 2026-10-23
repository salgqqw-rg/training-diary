"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/icons";

// Поле пароля с иконкой замка слева и глазком-переключателем справа (как в макете)
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <LockIcon className="p-ico" />
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="eye"
        onClick={() => setShow(!show)}
        aria-label={show ? "Скрыть пароль" : "Показать пароль"}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
