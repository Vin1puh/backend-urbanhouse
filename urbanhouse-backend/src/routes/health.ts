import { Router } from 'express';
import type { Response } from 'express';
import { query } from '../db';
import type { Req } from '../types';

const router = Router();

interface HealthResponse {
    success: boolean;
    status: 'ok' | 'unavailable';
}

// Liveness: процесс жив и отвечает. Используется в HEALTHCHECK Docker и livenessProbe Kubernetes.
router.get('/health', (_req: Req, res: Response<HealthResponse>) => {
    res.json({ success: true, status: 'ok' });
});

// Readiness: приложение готово принимать трафик, то есть есть соединение с БД.
// Используется в readinessProbe Kubernetes: пока БД недоступна, под не получает запросы.
router.get('/ready', async (_req: Req, res: Response<HealthResponse>) => {
    try {
        await query('SELECT 1');
        res.json({ success: true, status: 'ok' });
    } catch (err) {
        console.error('Readiness check failed:', err);
        res.status(503).json({ success: false, status: 'unavailable' });
    }
});

export default router;
