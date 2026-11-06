"use client";

import type { InputHTMLAttributes } from "react";

const MAX_SIDE = 1600;
const SKIP_BELOW = 700 * 1024;

// Фото с телефона весят 3–10 МБ, а запрос на Vercel не может быть больше 4,5 МБ:
// сжимаем в браузере до 1600 px (JPEG). Любой сбой — отправляем файл как есть.
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < SKIP_BELOW) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Выбор фото: после выбора файлы в поле заменяются на уменьшенные
export function PhotoInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      accept="image/*"
      {...props}
      type="file"
      onChange={async (e) => {
        const input = e.currentTarget;
        const files = await Promise.all(Array.from(input.files ?? []).map(shrink));
        if (files.length) {
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          input.files = dt.files;
        }
        props.onChange?.(e);
      }}
    />
  );
}
