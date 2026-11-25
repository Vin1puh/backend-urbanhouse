import path from 'path';
import dotenv from 'dotenv';

// Загружаем .env из корня проекта независимо от того, откуда запущен процесс.
// В Docker и Kubernetes файла .env нет: переменные приходят от окружения, dotenv это игнорирует.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
