# Курсовая UrbanHouse: журнал выполнения (для продолжения работы с места остановки)

Задача пользователя: оформить курсовую по методичке (docs/metodichka-digest.md) + добавить Docker и Kubernetes в бэкенд.
НЕ нужно: публиковать на gitverse. Фронт у пользователя есть. Печатная работа (docx/pdf).
Требования преподавателя: приложение работает; тесты (пирамида тестирования) отрабатывают; коммиты с ветками; презентация по методичке; устная защита; в работе описаны Docker, БД, Kubernetes.

## Этапы
- [x] Этап 1. Изучены методичка и вложения, конспект docs/metodichka-digest.md, план.
- [x] Этап 2. Docker: src/env.ts, src/routes/health.ts, graceful shutdown в index.ts, Dockerfile (4 этапа), .dockerignore, docker-compose.yml, .env.example, db/init/01-schema.sql (схема пользователя + тестовые данные).
- [x] Этап 3. Kubernetes (k8s/, kustomize): namespace, configmap, secret, postgres StatefulSet+PVC, backend Deployment/Service/PDB, HPA, Ingress, NetworkPolicy, initdb ConfigMap (копия схемы).
- [x] Этап 4. Тесты (node:test + tsx): tests/unit (handleError 10 шт. прогнан и проходит, auth), tests/api (валидация без БД), tests/integration (с PostgreSQL, RUN_DB_TESTS=1), tests/e2e (smoke по E2E_BASE_URL), tests/helpers/server.ts; src/app.ts отделён от index.ts; CI .gitverse/workflows/ci.yml (3 джоба); раздел «Тесты» в README. Прогнан только handleError: остальным нужны пакеты express/pg/jsonwebtoken, их в сессии нет.
- [x] Этап 5. Курсовая, часть А: генератор docx (docs/coursework/build.js), титул, содержание, введение.
- [x] Этап 6. Курсовая, часть Б: глава 1 (теория: REST, PostgreSQL, Docker, Kubernetes, JWT) со сносками.
- [x] Этап 7. Курсовая, часть В: глава 2 (проектирование и разработка: архитектура, БД, API, безопасность), рисунки (mermaid), таблицы.
- [x] Этап 8. Курсовая, часть Г: глава 3 (Docker, Kubernetes, тесты), заключение, список источников, приложения.
- [x] Этап 9. Сборка итогового docx (+pdf для проверки), проверка по методичке, упаковка zip.
- [x] Этап 10 (по желанию). Презентация для защиты.

## Заметки
- Неизвестно, пока не сказал пользователь: ФИО, группа, преподаватель, дисциплина/МДК, отделение/кафедра. На титуле пока шаблонные значения в квадратных скобках.
- Окружение сессии: нет сети для npm/pip, нет docker-демона, нет kubectl; код TS полностью проверить нельзя (нет @types/express и т.д.), YAML проверяется парсером.
- Семена БД: пароль тестовых пользователей Password123! (admin@urbanouse.com — admin, jane.doe@urbanouse.com — agent).
- Тема курсовой (рабочая): «Разработка и контейнеризация REST API платформы недвижимости UrbanHouse с развёртыванием в Kubernetes».
