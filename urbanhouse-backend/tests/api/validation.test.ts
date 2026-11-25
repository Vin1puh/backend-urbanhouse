// Тесты HTTP-уровня БЕЗ базы данных: проверяем, что запросы отсекаются до обращения к БД
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, startServer } from '../helpers/server';
import type { TestServer } from '../helpers/server';

let server: TestServer;

before(async () => {
    console.error = () => {};
    server = await startServer();
});
after(async () => {
    await server.close();
});

test('GET /health отвечает 200', async () => {
    const r = await call(server.baseUrl, '/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
});

test('неизвестный маршрут даёт 404 в формате API', async () => {
    const r = await call(server.baseUrl, '/no-such-route');
    assert.equal(r.status, 404);
    assert.equal(r.body.success, false);
});

test('невалидный JSON даёт 400', async () => {
    const r = await call(server.baseUrl, '/login', { method: 'POST', rawBody: '{ это не json' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'Некорректный JSON');
});

test('регистрация: некорректный email даёт 400', async () => {
    const r = await call(server.baseUrl, '/register', {
        method: 'POST',
        body: { first_name: 'Ivan', last_name: 'Petrov', email: 'не-почта', password: 'secret123' },
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'Некорректный email');
});

test('регистрация: короткий пароль даёт 400', async () => {
    const r = await call(server.baseUrl, '/register', {
        method: 'POST',
        body: { first_name: 'Ivan', last_name: 'Petrov', email: 'ivan@example.com', password: '123' },
    });
    assert.equal(r.status, 400);
});

test('регистрация: без имени даёт 400', async () => {
    const r = await call(server.baseUrl, '/register', {
        method: 'POST',
        body: { email: 'ivan@example.com', password: 'secret123' },
    });
    assert.equal(r.status, 400);
});

test('вход без пароля даёт 400', async () => {
    const r = await call(server.baseUrl, '/login', { method: 'POST', body: { email: 'a@b.co' } });
    assert.equal(r.status, 400);
});

test('защищённые маршруты без токена дают 401', async () => {
    const paths: Array<[string, string]> = [
        ['GET', '/me'],
        ['GET', '/users'],
        ['GET', '/favorites'],
        ['GET', '/saved_searches'],
        ['GET', '/inquiries'],
        ['GET', '/contact_messages'],
        ['POST', '/create_countries'],
        ['DELETE', '/countries/1'],
        ['POST', '/properties'],
    ];
    for (const [method, path] of paths) {
        const r = await call(server.baseUrl, path, { method, body: method === 'GET' ? undefined : {} });
        assert.equal(r.status, 401, `${method} ${path} должен требовать вход`);
    }
});

test('поддельный токен даёт 401', async () => {
    const r = await call(server.baseUrl, '/me', { token: 'fake.token.value' });
    assert.equal(r.status, 401);
});
