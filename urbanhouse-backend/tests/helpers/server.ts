import type { Server } from 'http';
import type { AddressInfo } from 'net';

export interface TestServer {
    baseUrl: string;
    close: () => Promise<void>;
}

// Поднимает приложение на свободном порту. Переменные окружения задаём ДО импорта приложения,
// потому что middleware/auth.ts читает JWT_SECRET в момент загрузки.
export async function startServer(): Promise<TestServer> {
    process.env.JWT_SECRET ??= 'test-secret-for-automated-tests';
    const { default: app } = await import('../../src/app');
    const { default: pool } = await import('../../src/db');

    const server: Server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;

    return {
        baseUrl: `http://127.0.0.1:${port}/api`,
        close: () =>
            new Promise<void>((resolve) => {
                server.close(() => {
                    pool.end().finally(resolve);
                });
            }),
    };
}

export interface ApiReply<T = Record<string, unknown>> {
    status: number;
    body: T;
}

// Короткая обёртка над fetch: возвращает статус и разобранный JSON
export async function call<T = Record<string, unknown>>(
    baseUrl: string,
    path: string,
    options: { method?: string; token?: string; body?: unknown; rawBody?: string } = {}
): Promise<ApiReply<T>> {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    let body: string | undefined;
    if (options.rawBody !== undefined) {
        body = options.rawBody;
        headers['Content-Type'] = 'application/json';
    } else if (options.body !== undefined) {
        body = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(baseUrl + path, { method: options.method || 'GET', headers, body });
    return { status: res.status, body: (await res.json()) as T };
}
