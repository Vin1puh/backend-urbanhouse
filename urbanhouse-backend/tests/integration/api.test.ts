// Интеграционные тесты: приложение + настоящая PostgreSQL с тестовыми данными из db/init/01-schema.sql.
// Запускаются только при RUN_DB_TESTS=1 (в CI; локально: docker compose up -d db и переменные DB_*).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, startServer } from '../helpers/server';
import type { TestServer } from '../helpers/server';

const enabled = process.env.RUN_DB_TESTS === '1';
const opts = { skip: enabled ? false : 'нет RUN_DB_TESTS=1 (нужна база данных)' };

let server: TestServer;
let adminToken = '';
const unique = Date.now().toString(36);

interface Auth { success: boolean; token: string; user: { id: string; role: string } }
interface List { success: boolean; data: Array<Record<string, unknown>> }
interface One { success: boolean; data: Record<string, unknown> }

before(async () => {
    if (!enabled) return;
    console.error = () => {};
    server = await startServer();
    const r = await call<Auth>(server.baseUrl, '/login', {
        method: 'POST',
        body: { email: 'admin@urbanouse.com', password: 'Password123!' },
    });
    adminToken = r.body.token;
});
after(async () => {
    if (server) await server.close();
});

test('GET /ready подтверждает соединение с БД', opts, async () => {
    const r = await call(server.baseUrl, '/ready');
    assert.equal(r.status, 200);
});

test('вход администратора возвращает токен и роль admin', opts, async () => {
    assert.ok(adminToken.length > 20);
    const me = await call<{ user: { role: string; email: string } }>(server.baseUrl, '/me', { token: adminToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.role, 'admin');
});

test('вход с неверным паролем даёт 401', opts, async () => {
    const r = await call(server.baseUrl, '/login', {
        method: 'POST',
        body: { email: 'admin@urbanouse.com', password: 'wrong-password' },
    });
    assert.equal(r.status, 401);
});

test('справочники отдают данные без авторизации', opts, async () => {
    for (const path of ['/countries', '/cities', '/property_types', '/amenities', '/agents', '/projects']) {
        const r = await call<List>(server.baseUrl, path);
        assert.equal(r.status, 200, path);
        assert.ok(r.body.data.length > 0, `${path} должен вернуть тестовые данные`);
    }
});

test('список объектов: фильтр по типу сделки работает', opts, async () => {
    const all = await call<List>(server.baseUrl, '/properties');
    const rent = await call<List>(server.baseUrl, '/properties?listing_type=rent');
    assert.equal(rent.status, 200);
    assert.ok(rent.body.data.every((p) => p.listing_type === 'rent'));
    assert.ok(rent.body.data.length <= all.body.data.length);
});

test('карточка объекта содержит фото и удобства', opts, async () => {
    const list = await call<List>(server.baseUrl, '/properties');
    const id = list.body.data[0].id;
    const r = await call<One>(server.baseUrl, `/properties/${id}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.data.images));
    assert.ok(Array.isArray(r.body.data.amenities));
});

test('несуществующий объект даёт 404', opts, async () => {
    const r = await call(server.baseUrl, '/properties/999999999');
    assert.equal(r.status, 404);
});

test('CRUD страны: создание, чтение, изменение, удаление (admin)', opts, async () => {
    const code = unique.slice(-2).toUpperCase().padStart(2, 'Q');
    const created = await call<One>(server.baseUrl, '/create_countries', {
        method: 'POST', token: adminToken, body: { name: `Testland ${unique}`, code },
    });
    assert.equal(created.status, 201);
    const id = created.body.data.id;

    const read = await call<One>(server.baseUrl, `/countries/${id}`);
    assert.equal(read.status, 200);
    assert.equal(read.body.data.name, `Testland ${unique}`);

    const updated = await call<One>(server.baseUrl, `/countries/${id}`, {
        method: 'PUT', token: adminToken, body: { name: `Testland ${unique} II`, code },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.name, `Testland ${unique} II`);

    const removed = await call(server.baseUrl, `/countries/${id}`, { method: 'DELETE', token: adminToken });
    assert.equal(removed.status, 200);
    const gone = await call(server.baseUrl, `/countries/${id}`);
    assert.equal(gone.status, 404);
});

test('дубликат страны даёт 409', opts, async () => {
    const r = await call(server.baseUrl, '/create_countries', {
        method: 'POST', token: adminToken, body: { name: 'Spain', code: 'ES' },
    });
    assert.equal(r.status, 409);
});

test('обычный пользователь не может создавать страны (403)', opts, async () => {
    const login = await call<Auth>(server.baseUrl, '/login', {
        method: 'POST', body: { email: 'anna@example.com', password: 'Password123!' },
    });
    assert.equal(login.body.user.role, 'user');
    const r = await call(server.baseUrl, '/create_countries', {
        method: 'POST', token: login.body.token, body: { name: 'Nowhere', code: 'NW' },
    });
    assert.equal(r.status, 403);
});

test('регистрация, вход и избранное нового пользователя', opts, async () => {
    const email = `student-${unique}@example.com`;
    const reg = await call<Auth>(server.baseUrl, '/register', {
        method: 'POST',
        body: { first_name: 'Test', last_name: 'Student', email, password: 'secret123' },
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.role, 'user', 'роль при регистрации всегда user');

    const dup = await call(server.baseUrl, '/register', {
        method: 'POST',
        body: { first_name: 'Test', last_name: 'Student', email, password: 'secret123' },
    });
    assert.equal(dup.status, 409);

    const login = await call<Auth>(server.baseUrl, '/login', { method: 'POST', body: { email, password: 'secret123' } });
    assert.equal(login.status, 200);
    const token = login.body.token;

    const list = await call<List>(server.baseUrl, '/properties');
    const propertyId = list.body.data[0].id;

    const add = await call(server.baseUrl, '/favorites', { method: 'POST', token, body: { property_id: propertyId } });
    assert.equal(add.status, 201);
    const favs = await call<List>(server.baseUrl, '/favorites', { token });
    assert.equal(favs.body.data.length, 1);
    const del = await call(server.baseUrl, `/favorites/${propertyId}`, { method: 'DELETE', token });
    assert.equal(del.status, 200);
    const again = await call(server.baseUrl, `/favorites/${propertyId}`, { method: 'DELETE', token });
    assert.equal(again.status, 404);
});

test('гость может оставить заявку на объект', opts, async () => {
    const list = await call<List>(server.baseUrl, '/properties');
    const r = await call<One>(server.baseUrl, '/inquiries', {
        method: 'POST',
        body: { property_id: list.body.data[0].id, type: 'ask_question', email: `guest-${unique}@example.com`, message: 'Здравствуйте!' },
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.status, 'new');
});

test('список заявок недоступен обычному пользователю', opts, async () => {
    const login = await call<Auth>(server.baseUrl, '/login', {
        method: 'POST', body: { email: 'john@example.com', password: 'Password123!' },
    });
    const r = await call(server.baseUrl, '/inquiries', { token: login.body.token });
    assert.equal(r.status, 403);
});
