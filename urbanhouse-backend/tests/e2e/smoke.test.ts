// Сквозной smoke-тест уже запущенного приложения (docker compose или Kubernetes).
// Запуск: E2E_BASE_URL=http://localhost:3000/api npm run test:e2e
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.E2E_BASE_URL;
const opts = { skip: base ? false : 'нет E2E_BASE_URL' };

async function get(path: string, token?: string) {
    const res = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: res.status, body: (await res.json()) as Record<string, any> };
}

test('приложение живо и готово к работе', opts, async () => {
    assert.equal((await get('/health')).status, 200);
    assert.equal((await get('/ready')).status, 200);
});

test('пользовательский сценарий: вход и просмотр каталога', opts, async () => {
    const res = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'anna@example.com', password: 'Password123!' }),
    });
    const login = (await res.json()) as { token: string };
    assert.equal(res.status, 200);

    const me = await get('/me', login.token);
    assert.equal(me.body.user.email, 'anna@example.com');

    const properties = await get('/properties');
    assert.equal(properties.status, 200);
    assert.ok(properties.body.data.length > 0);
});
