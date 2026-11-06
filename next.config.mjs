/** @type {import('next').NextConfig} */
export default {
  // Фото уходят через серверные действия; на Vercel запрос не может быть больше 4,5 МБ,
  // поэтому браузер сжимает фото (components/photo-input.tsx), а лимит Next (по умолчанию 1 МБ) поднимаем до 4 МБ
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
