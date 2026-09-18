import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, full_name, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username minimal 3 karakter' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    const validRoles = ['admin', 'operator', 'viewer'];
    const userRole = validRoles.includes(role) ? role : 'operator';

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, role, is_active, created_at`,
      [username.toLowerCase().trim(), passwordHash, full_name || '', userRole]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username sudah digunakan' });
    }
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    delete user.password_hash;
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, role, is_active, last_login, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/users (admin only)
router.get('/users', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/users/:id (admin only)
router.put('/users/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, role, is_active, password } = req.body;

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password minimal 6 karakter' });
      }
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE users SET full_name = COALESCE($1, full_name), role = COALESCE($2, role), is_active = COALESCE($3, is_active), password_hash = $4 WHERE id = $5',
        [full_name, role, is_active, hash, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET full_name = COALESCE($1, full_name), role = COALESCE($2, role), is_active = COALESCE($3, is_active) WHERE id = $4',
        [full_name, role, is_active, id]
      );
    }

    const result = await pool.query(
      'SELECT id, username, full_name, role, is_active, last_login, created_at FROM users WHERE id = $1',
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/users/:id (admin only)
router.delete('/users/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/password (change own password)
router.put('/password', authenticateToken, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Password lama salah' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password berhasil diubah' });
  } catch (err) {
    next(err);
  }
});

export default router;
