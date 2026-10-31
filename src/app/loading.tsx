// Мгновенный отклик при переходе между страницами, пока сервер собирает данные
export default function Loading() {
  return <div className="card" aria-busy="true" style={{ minHeight: 160, opacity: 0.6 }} />;
}
