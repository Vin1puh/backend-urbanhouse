import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import handleError from '../../src/utils/handleError';

// Подставной объект ответа: запоминает статус и тело
function fakeRes() {
    const state: { status?: number; body?: { success: boolean; error: string } } = {};
    const res = {
        status(code: number) {
            state.status = code;
            return res;
        },
        json(body: { success: boolean; error: string }) {
            state.body = body;
            return res;
        },
    };
    return { res: res as unknown as Response, state };
}

// handleError пишет в консоль ошибку, в тестах это только шум
test.before(() => {
    console.error = () => {};
});

test('23505 (дубликат) даёт 409 и текст по умолчанию', () => {
    const { res, state } = fakeRes();
    handleError(res, { code: '23505' });
    assert.equal(state.status, 409);
    assert.equal(state.body?.success, false);
    assert.equal(state.body?.error, 'Такая запись уже существует');
});

test('23505 использует свой текст, если он передан', () => {
    const { res, state } = fakeRes();
    handleError(res, { code: '23505' }, { conflict: 'Страна с таким кодом уже существует' });
    assert.equal(state.body?.error, 'Страна с таким кодом уже существует');
});

test('23503 (внешний ключ) даёт 409 и свой текст', () => {
    const { res, state } = fakeRes();
    handleError(res, { code: '23503' }, { fk: 'Страна не найдена' });
    assert.equal(state.status, 409);
    assert.equal(state.body?.error, 'Страна не найдена');
});

for (const code of ['22P02', '23502', '23514', '22001', '22003']) {
    test(`${code} (некорректные данные) даёт 400`, () => {
        const { res, state } = fakeRes();
        handleError(res, { code });
        assert.equal(state.status, 400);
        assert.equal(state.body?.error, 'Некорректные данные');
    });
}

test('неизвестная ошибка даёт 500', () => {
    const { res, state } = fakeRes();
    handleError(res, new Error('что-то сломалось'));
    assert.equal(state.status, 500);
    assert.equal(state.body?.success, false);
});

test('null и строка вместо ошибки не ломают обработчик', () => {
    for (const bad of [null, undefined, 'oops']) {
        const { res, state } = fakeRes();
        handleError(res, bad);
        assert.equal(state.status, 500);
    }
});
