import type { MetadataRoute } from "next";

// Манифест: на телефоне сайт можно «Установить» / добавить на экран и открывать как приложение
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Solo. — дневник тренировок",
    short_name: "Solo.",
    description: "Дневник тренировок, прогресс, питание и сон",
    lang: "ru",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060607",
    theme_color: "#060607",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
