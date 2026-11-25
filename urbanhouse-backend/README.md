# UrbanHouse backend

REST API платформы недвижимости UrbanHouse (учебный проект). Стек: Node.js 22, Express, TypeScript, PostgreSQL 16, JWT, Docker, Kubernetes.

- 70 маршрутов, префикс `/api`
- три роли: `user`, `agent`, `admin` (гость тоже может смотреть каталог и оставлять заявки)
- запуск тремя способами: локально, в Docker Compose, в Kubernetes

## Содержание

1. [Что нужно установить](#что-нужно-установить)
2. [Настройка .env](#настройка-env)
3. [Способ 1. Docker Compose (рекомендуется)](#способ-1-docker-compose-рекомендуется)
4. [Способ 2. Локально без Docker](#способ-2-локально-без-docker)
5. [Способ 3. Kubernetes](#способ-3-kubernetes)
6. [Проверка, что всё работает](#проверка-что-всё-работает)
7. [Тестовые пользователи](#тестовые-пользователи)
8. [Тесты](#тесты)
9. [Структура проекта](#структура-проекта)
10. [Частые проблемы](#частые-проблемы)

## Что нужно установить

| Способ запуска | Что нужно |
|---|---|
| Docker Compose | Docker Desktop (Windows/macOS) или Docker Engine + плагин Compose (Linux) |
| Локально | Node.js 22+, npm, PostgreSQL 16 |
| Kubernetes | Docker, kubectl и локальный кластер: minikube, kind или Kubernetes в Docker Desktop |

## Настройка .env

Файл `.env` лежит в корне проекта и в репозиторий не попадает.

```bash
# Linux / macOS / Git Bash
cp .env.example .env

# Windows (cmd или PowerShell)
copy .env.example .env
```

Откройте `.env` и задайте значения:

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `DB_USER` | пользователь PostgreSQL | `postgres` |
| `DB_PASSWORD` | пароль PostgreSQL, **обязательно** | нет |
| `DB_NAME` | имя базы | `urbanhouse` |
| `DB_HOST` | адрес сервера БД (в Compose подставляется сам) | `localhost` |
| `DB_PORT` | порт БД (в Compose подставляется сам) | `5432` |
| `JWT_SECRET` | секрет подписи токенов, **обязательно** | нет |
| `JWT_EXPIRES_IN` | срок жизни токена | `7d` |
| `PORT` | порт приложения | `3000` |

Сгенерировать секрет для `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Без `JWT_SECRET` приложение не запустится и напишет, что секрет не задан.

## Способ 1. Docker Compose (рекомендуется)

Поднимает сразу базу данных и приложение. Схема БД и тестовые данные загружаются автоматически при первом старте. Node.js и PostgreSQL на компьютере ставить не нужно.

```bash
# 1. Подготовить .env (см. выше), заполнить DB_PASSWORD и JWT_SECRET

# 2. Собрать образ и запустить
docker compose up -d --build

# 3. Убедиться, что обе службы в состоянии healthy
docker compose ps

# 4. Проверить API
curl http://localhost:3000/api/health
```

Приложение доступно на `http://localhost:3000/api`. База данных опубликована только на `127.0.0.1:5433` (чтобы не конфликтовать с локальным PostgreSQL), к ней можно подключиться из DBeaver, pgAdmin и т. п.

Полезные команды:

```bash
docker compose logs -f app     # журнал приложения
docker compose restart app     # перезапуск приложения
docker compose down            # остановить, данные БД сохраняются
docker compose down -v         # остановить и удалить данные БД
```

Скрипт `db/init/01-schema.sql` выполняется только на пустой базе. Если вы изменили схему, выполните `docker compose down -v` и запустите заново.

## Способ 2. Локально без Docker

1. Создайте базу и загрузите схему (пароль возьмите из `.env`):

   ```bash
   psql -U postgres -c "CREATE DATABASE urbanhouse;"
   psql -U postgres -d urbanhouse -f db/init/01-schema.sql
   ```

2. Установите зависимости и создайте `.env` (см. выше, `DB_HOST=localhost`, `DB_PORT=5432`):

   ```bash
   npm install
   ```

3. Запустите:

   ```bash
   npm run dev          # разработка, перезапуск при изменениях
   # или
   npm run build        # сборка TypeScript в dist/
   npm start            # запуск собранного приложения
   ```

Проверка типов без сборки: `npm run typecheck`.

## Способ 3. Kubernetes

Подойдёт minikube, kind или Docker Desktop с включённым Kubernetes. Манифесты лежат в каталоге `k8s/` и применяются одной командой через kustomize.

```bash
# 1. Собрать образ
docker build -t urbanhouse-backend:1.0.0 .

# 2. Передать образ в кластер (внешний реестр не используется)
minikube image load urbanhouse-backend:1.0.0         # minikube
kind load docker-image urbanhouse-backend:1.0.0      # kind
# Docker Desktop видит локальные образы сам, этот шаг пропускается

# 3. Применить манифесты
kubectl apply -k k8s/

# 4. Дождаться, пока все поды станут Running / Ready
kubectl get pods -n urbanhouse -w

# 5. Открыть доступ к API с компьютера
kubectl port-forward -n urbanhouse svc/backend 3000:80
curl http://localhost:3000/api/health
```

Что будет создано в пространстве имён `urbanhouse`:

| Объект | Назначение |
|---|---|
| StatefulSet `postgres` + том 1 ГиБ | база данных, схема загружается из ConfigMap `postgres-initdb` |
| Deployment `backend` (2 пода) | приложение, плавное обновление, пробы startup/liveness/readiness |
| Service `backend`, `postgres` | внутренние адреса |
| ConfigMap, Secret | настройки и пароли (учебные значения) |
| HorizontalPodAutoscaler | от 2 до 5 подов при загрузке CPU выше 70 % |
| PodDisruptionBudget | не даёт остановить сразу все поды приложения |
| Ingress | доступ по имени `urbanhouse.local` |
| NetworkPolicy | к БД можно подключаться только из подов приложения |

Дополнительно:

- Значения в `k8s/secret.yaml` учебные, для реального использования замените их.
- Для автомасштабирования нужен metrics-server: `minikube addons enable metrics-server`.
- Для Ingress нужен контроллер ingress-nginx: `minikube addons enable ingress`, затем добавьте строку `127.0.0.1 urbanhouse.local` в файл hosts (`C:\Windows\System32\drivers\etc\hosts` на Windows, `/etc/hosts` на Linux и macOS). Для minikube вместо `127.0.0.1` используйте адрес из `minikube ip`.
- Обновление приложения: пересоберите образ с новым тегом, измените тег в `k8s/backend.yaml` и снова выполните `kubectl apply -k k8s/`.

Удаление:

```bash
kubectl delete -k k8s/
kubectl delete pvc -n urbanhouse -l app=postgres    # удалить и данные БД
```

## Проверка, что всё работает

Примеры для `http://localhost:3000`.

```bash
# процесс жив
curl http://localhost:3000/api/health

# есть связь с базой данных (при недоступной БД вернётся 503)
curl http://localhost:3000/api/ready

# список стран, открытый маршрут
curl http://localhost:3000/api/countries

# вход, в ответе будет token
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@urbanouse.com","password":"Password123!"}'

# защищённый маршрут: подставьте токен из ответа на вход
curl http://localhost:3000/api/users -H "Authorization: Bearer <token>"
```

Без токена защищённые маршруты возвращают `401`, при нехватке прав `403`. Все ответы имеют вид `{ "success": true, "data": ... }` или `{ "success": false, "error": "..." }`.

На Windows в cmd вместо `\` в конце строки используйте `^`, а кавычки в JSON экранируйте или запускайте команды из PowerShell или Git Bash. Проще всего проверять запросы в Postman или Insomnia.

## Тестовые пользователи

Создаются скриптом схемы, пароль у всех `Password123!` (только для учебного стенда).

| Email | Роль |
|---|---|
| `admin@urbanouse.com` | admin |
| `jane.doe@urbanouse.com` | agent |
| `anna@example.com` | user |
| `john@example.com` | user |

## Тесты

Тесты построены по пирамиде тестирования. Используется встроенный раннер `node:test`, дополнительных библиотек нет.

| Уровень | Каталог | Тестов | Нужна БД |
|---|---|---|---|
| Модульные | `tests/unit` | 20 | нет |
| API | `tests/api` | 9 | нет |
| Интеграционные | `tests/integration` | 13 | да |
| Сквозные (E2E) | `tests/e2e` | 2 | да, запущенное приложение |

```bash
# модульные + API, база не нужна
npm run test:unit

# интеграционные: нужны DB_* в .env и загруженная схема
# Linux / macOS / Git Bash
RUN_DB_TESTS=1 npm run test:integration
# Windows PowerShell
$env:RUN_DB_TESTS=1; npm run test:integration

# сквозные: приложение уже запущено (Compose или Kubernetes)
E2E_BASE_URL=http://localhost:3000/api npm run test:e2e
# Windows PowerShell
$env:E2E_BASE_URL="http://localhost:3000/api"; npm run test:e2e
```

Без `RUN_DB_TESTS` интеграционные тесты пропускаются. Автозапуск в CI описан в `.gitverse/workflows/ci.yml`: проверка типов и модульные тесты, интеграционные тесты с PostgreSQL, сквозной тест через Docker Compose.

## Структура проекта

```
src/
├── index.ts              запуск сервера, корректное завершение по SIGTERM
├── app.ts                приложение Express и подключение маршрутов
├── env.ts                загрузка .env
├── db.ts                 пул соединений и типизированный query<T>()
├── types/                интерфейсы таблиц, форматы запросов и ответов
├── middleware/auth.ts    auth, optionalAuth, requireRole, signToken
├── utils/handleError.ts  преобразование ошибок БД в коды HTTP
└── routes/               по файлу на сущность; health.ts для проверок Docker и Kubernetes
db/init/01-schema.sql     схема БД (16 таблиц) и тестовые данные
tests/                    unit, api, integration, e2e
Dockerfile                многоэтапная сборка образа
docker-compose.yml        приложение + PostgreSQL
k8s/                      манифесты Kubernetes (kustomize)
.gitverse/workflows/      CI
```

## Частые проблемы

**«JWT_SECRET не задан в .env».** Файл `.env` не создан или лежит не в корне проекта, либо в нём нет строки `JWT_SECRET=...`. Создайте его из `.env.example`.

**`docker compose up` пишет, что DB_PASSWORD или JWT_SECRET не указаны.** Compose берёт значения из `.env` в той же папке, где лежит `docker-compose.yml`. Заполните обе переменные.

**Порт 3000 или 5433 занят.** Измените `PORT` в `.env` либо остановите программу, которая занимает порт.

**Схема БД изменилась, а в базе старая.** Скрипт инициализации выполняется только для пустой базы: `docker compose down -v` и запуск заново.

**В Kubernetes под в состоянии `ImagePullBackOff` или `ErrImageNeverPull`.** Образ не попал в кластер: выполните `minikube image load ...` или `kind load docker-image ...` и пересоздайте поды (`kubectl rollout restart deployment/backend -n urbanhouse`).

**Поды backend не становятся Ready.** Посмотрите журнал: `kubectl logs -n urbanhouse deploy/backend`. Обычно база данных ещё не запустилась или не применилась схема; проверьте `kubectl get pods -n urbanhouse`.

**HPA показывает `<unknown>` вместо загрузки.** В кластере не установлен metrics-server.

**Ответ 500 на запросы к БД.** Проверьте `GET /api/ready`: если вернулся 503, приложение не видит базу. Проверьте `DB_HOST`, `DB_PORT`, пароль и что база запущена.
