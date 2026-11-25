import './env'; // должен быть первым импортом: загружает .env до остальных файлов
import app from './app';
import pool from './db';

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Корректная остановка: Docker и Kubernetes шлют SIGTERM, перед выключением
// закрываем HTTP-сервер и соединения с БД, чтобы не обрывать запросы на середине.
const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
        pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
