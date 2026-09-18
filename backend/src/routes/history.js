import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /api/history
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT h.*, u.username
       FROM device_history h
       LEFT JOIN users u ON h.user_id = u.id
       ORDER BY h.timestamp DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) as total FROM device_history');
    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/history/device/:deviceId
router.get('/device/:deviceId', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT h.*, u.username
       FROM device_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.device_id = $1
       ORDER BY h.timestamp DESC
       LIMIT 50`,
      [req.params.deviceId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
