import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

// JWT_SECRET нужен до загрузки middleware/auth.ts
process.env.JWT_SECRET = 'unit-test-secret';

interface Captured {
    status?: number;
    body?: { success: boolean; error: string };
    nextCalled: boolean;
}

function run(handler: (req: Request, res: Response, next: NextFunction) => unknown, req: Partial<Request>): Promise<Captured> {
    return new Promise((resolve) => {
        const out: Captured = { nextCalled: false };
        const res = {
            status(code: number) {
                out.status = code;
                return res;
            },
            json(body: { success: boolean; error: string }) {
                out.body = body;
                resolve(out);
                return res;
            },
        };
        const next = () => {
            out.nextCalled = true;
            resolve(out);
        };
        Promise.resolve(handler(req as Request, res as unknown as Response, next)).catch(() => resolve(out));
    });
}

test('signToken кладёт в токен id и роль', async () => {
    const { signToken } = await import('../../src/middleware/auth');
    const token = signToken({ id: '42', role: 'agent' });
    const payload = jwt.verify(token, 'unit-test-secret') as { id: string; role: string };
    assert.equal(payload.id, '42');
    assert.equal(payload.role, 'agent');
});

test('токен, подписанный чужим секретом, не проходит проверку', async () => {
    const { signToken } = await import('../../src/middleware/auth');
    const token = signToken({ id: '1', role: 'admin' });
    assert.throws(() => jwt.verify(token, 'другой-секрет'));
});

test('requireRole пропускает нужную роль', async () => {
    const { requireRole } = await import('../../src/middleware/auth');
    const result = await run(requireRole('admin', 'agent'), { user: { role: 'agent' } as Request['user'] });
    assert.equal(result.nextCalled, true);
});

test('requireRole отвечает 403 обычному пользователю', async () => {
    const { requireRole } = await import('../../src/middleware/auth');
    const result = await run(requireRole('admin'), { user: { role: 'user' } as Request['user'] });
    assert.equal(result.status, 403);
    assert.equal(result.nextCalled, false);
});

test('requireRole отвечает 403, если пользователя нет', async () => {
    const { requireRole } = await import('../../src/middleware/auth');
    const result = await run(requireRole('admin'), {});
    assert.equal(result.status, 403);
});

test('auth отвечает 401 без заголовка Authorization', async () => {
    const { auth } = await import('../../src/middleware/auth');
    const result = await run(auth, { headers: {} });
    assert.equal(result.status, 401);
    assert.equal(result.body?.error, 'Токен не передан');
});

test('auth отвечает 401 на заголовок не в формате Bearer', async () => {
    const { auth } = await import('../../src/middleware/auth');
    const result = await run(auth, { headers: { authorization: 'Basic abc' } });
    assert.equal(result.status, 401);
});

test('auth отвечает 401 на мусорный токен', async () => {
    const { auth } = await import('../../src/middleware/auth');
    const result = await run(auth, { headers: { authorization: 'Bearer not.a.token' } });
    assert.equal(result.status, 401);
    assert.equal(result.body?.error, 'Недействительный токен');
});

test('auth отвечает 401 на просроченный токен', async () => {
    const { auth } = await import('../../src/middleware/auth');
    const expired = jwt.sign({ id: '1', role: 'user' }, 'unit-test-secret', { expiresIn: -10 });
    const result = await run(auth, { headers: { authorization: `Bearer ${expired}` } });
    assert.equal(result.status, 401);
    assert.equal(result.body?.error, 'Срок действия токена истёк');
});

test('optionalAuth пропускает гостя без токена', async () => {
    const { optionalAuth } = await import('../../src/middleware/auth');
    const req: Partial<Request> = { headers: {} };
    const result = await run(optionalAuth, req);
    assert.equal(result.nextCalled, true);
    assert.equal(req.user, null);
});
