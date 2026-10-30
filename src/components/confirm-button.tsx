"use client";

import type { ButtonHTMLAttributes } from "react";

// Кнопка отправки формы с вопросом «точно удалить?» — для необратимых действий
export function ConfirmButton({ message, ...p }: { message: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }} />;
}
