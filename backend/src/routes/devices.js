import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const VALID_CARD_TYPES = ['', 'Prabayar', 'Pascabayar', 'IoT'];
const VALID_OPERATORS = ['', 'Telkomsel', 'Byu', 'Indosat', 'Tri', 'XL', 'Axis'];

// GET /api/devices
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query, params;

    if (req.user.role === 'viewer') {
      query = `SELECT d.*,
        CASE
          WHEN d.package_start_date IS NULL OR d.package_duration_days = 0 THEN 'none'
          WHEN (d.package_start_date + (d.package_duration_days || ' days')::interval) < NOW() THEN 'expired'
          WHEN (d.package_start_date + ((d.package_duration_days - 2) || ' days')::interval) < NOW() THEN 'critical'
          WHEN (d.package_start_date + ((d.package_duration_days - 6) || ' days')::interval) < NOW() THEN 'warning'
          ELSE 'safe'
        END as package_status,
        CASE
          WHEN d.package_start_date IS NULL OR d.package_duration_days = 0 THEN NULL
          ELSE d.package_duration_days - EXTRACT(DAY FROM NOW() - d.package_start_date)::int
        END as days_remaining
      FROM devices d
      ORDER BY d.created_at DESC`;
      params = [];
    } else {
      query = `SELECT d.*,
        CASE
          WHEN d.package_start_date IS NULL OR d.package_duration_days = 0 THEN 'none'
          WHEN (d.package_start_date + (d.package_duration_days || ' days')::interval) < NOW() THEN 'expired'
          WHEN (d.package_start_date + ((d.package_duration_days - 2) || ' days')::interval) < NOW() THEN 'critical'
          WHEN (d.package_start_date + ((d.package_duration_days - 6) || ' days')::interval) < NOW() THEN 'warning'
          ELSE 'safe'
        END as package_status,
        CASE
          WHEN d.package_start_date IS NULL OR d.package_duration_days = 0 THEN NULL
          ELSE d.package_duration_days - EXTRACT(DAY FROM NOW() - d.package_start_date)::int
        END as days_remaining
      FROM devices d
      ORDER BY d.created_at DESC`;
      params = [];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/devices/stats
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_devices,
        COALESCE(SUM(package_cost), 0) as total_cost,
        COUNT(*) FILTER (WHERE
          package_start_date IS NOT NULL AND package_duration_days > 0
          AND (package_start_date + (package_duration_days || ' days')::interval) >= NOW()
          AND (package_start_date + ((package_duration_days - 6) || ' days')::interval) > NOW()
        ) as safe_count,
        COUNT(*) FILTER (WHERE
          package_start_date IS NOT NULL AND package_duration_days > 0
          AND (package_start_date + ((package_duration_days - 6) || ' days')::interval) <= NOW()
          AND (package_start_date + ((package_duration_days - 2) || ' days')::interval) > NOW()
        ) as warning_count,
        COUNT(*) FILTER (WHERE
          package_start_date IS NOT NULL AND package_duration_days > 0
          AND (package_start_date + ((package_duration_days - 2) || ' days')::interval) <= NOW()
          AND (package_start_date + (package_duration_days || ' days')::interval) > NOW()
        ) as critical_count,
        COUNT(*) FILTER (WHERE
          package_start_date IS NOT NULL AND package_duration_days > 0
          AND (package_start_date + (package_duration_days || ' days')::interval) < NOW()
        ) as expired_count
      FROM devices
    `);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/devices/:id
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM devices WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perangkat tidak ditemukan' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/devices
router.post('/', authenticateToken, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const { name, phone, location, card_type, operator, package_amount_mb, package_start_date, package_duration_days, package_cost } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Nama perangkat wajib diisi' });
    if (!phone?.trim()) return res.status(400).json({ error: 'Nomor HP wajib diisi' });
    if (!location?.trim()) return res.status(400).json({ error: 'Lokasi wajib diisi' });

    if (card_type && !VALID_CARD_TYPES.includes(card_type)) {
      return res.status(400).json({ error: 'Tipe kartu tidak valid' });
    }
    if (operator && !VALID_OPERATORS.includes(operator)) {
      return res.status(400).json({ error: 'Operator tidak valid' });
    }

    const result = await pool.query(
      `INSERT INTO devices (user_id, name, phone, location, card_type, operator, package_amount_mb, package_start_date, package_duration_days, package_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id,
        name.trim(),
        phone.trim(),
        location.trim(),
        card_type || '',
        operator || '',
        Number(package_amount_mb) || 0,
        package_start_date || null,
        Number(package_duration_days) || 0,
        Number(package_cost) || 0,
      ]
    );

    const device = result.rows[0];

    await pool.query(
      `INSERT INTO device_history (device_id, user_id, action, device_name, phone, location)
       VALUES ($1, $2, 'add', $3, $4, $5)`,
      [device.id, req.user.id, device.name, device.phone, device.location]
    );

    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
});

// PUT /api/devices/:id
router.put('/:id', authenticateToken, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, location, card_type, operator, package_amount_mb, package_start_date, package_duration_days, package_cost } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Nama perangkat wajib diisi' });
    if (!phone?.trim()) return res.status(400).json({ error: 'Nomor HP wajib diisi' });
    if (!location?.trim()) return res.status(400).json({ error: 'Lokasi wajib diisi' });

    const existing = await pool.query('SELECT id FROM devices WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Perangkat tidak ditemukan' });
    }

    const result = await pool.query(
      `UPDATE devices SET
        name = $1, phone = $2, location = $3, card_type = $4, operator = $5,
        package_amount_mb = $6, package_start_date = $7, package_duration_days = $8, package_cost = $9
       WHERE id = $10
       RETURNING *`,
      [
        name.trim(), phone.trim(), location.trim(),
        card_type || '', operator || '',
        Number(package_amount_mb) || 0,
        package_start_date || null,
        Number(package_duration_days) || 0,
        Number(package_cost) || 0,
        id,
      ]
    );

    const device = result.rows[0];

    await pool.query(
      `INSERT INTO device_history (device_id, user_id, action, device_name, phone, location)
       VALUES ($1, $2, 'update', $3, $4, $5)`,
      [device.id, req.user.id, device.name, device.phone, device.location]
    );

    res.json(device);
  } catch (err) {
    next(err);
  }
});

// PUT /api/devices/:id/package
router.put('/:id/package', authenticateToken, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { package_amount_mb, package_start_date, package_duration_days, package_cost } = req.body;

    const existing = await pool.query('SELECT id FROM devices WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Perangkat tidak ditemukan' });
    }

    const result = await pool.query(
      `UPDATE devices SET
        package_amount_mb = $1, package_start_date = $2, package_duration_days = $3, package_cost = $4
       WHERE id = $5
       RETURNING *`,
      [
        Number(package_amount_mb) || 0,
        package_start_date || null,
        Number(package_duration_days) || 0,
        Number(package_cost) || 0,
        id,
      ]
    );

    const device = result.rows[0];

    await pool.query(
      `INSERT INTO device_history (device_id, user_id, action, device_name, phone, location)
       VALUES ($1, $2, 'package_update', $3, $4, $5)`,
      [device.id, req.user.id, device.name, device.phone, device.location]
    );

    res.json(device);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/devices/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Perangkat tidak ditemukan' });
    }

    const device = existing.rows[0];

    await pool.query(
      `INSERT INTO device_history (device_id, user_id, action, device_name, phone, location)
       VALUES ($1, $2, 'delete', $3, $4, $5)`,
      [device.id, req.user.id, device.name, device.phone, device.location]
    );

    await pool.query('DELETE FROM devices WHERE id = $1', [id]);
    res.json({ message: 'Perangkat berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});

// POST /api/devices/import (CSV)
router.post('/import', authenticateToken, requireRole('admin', 'operator'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File CSV wajib diupload' });
    }

    const content = req.file.buffer.toString('utf-8');
    let records;
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (e) {
      return res.status(400).json({ error: 'Format CSV tidak valid: ' + e.message });
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const name = r.nama || r.name || '';
      const phone = r.phone || r.nomor_hp || r.nomor || '';
      const location = r.lokasi || r.location || '';
      const cardType = r.tipe_kartu || r.card_type || '';
      const operator = r.operator || '';

      if (!name || !phone || !location) {
        errors.push({ row: i + 1, error: 'Nama, phone, dan lokasi wajib diisi' });
        continue;
      }

      try {
        const result = await pool.query(
          `INSERT INTO devices (user_id, name, phone, location, card_type, operator, package_amount_mb, package_start_date, package_duration_days, package_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, name, phone`,
          [
            req.user.id,
            name, phone, location,
            VALID_CARD_TYPES.includes(cardType) ? cardType : '',
            VALID_OPERATORS.includes(operator) ? operator : '',
            Number(r.package_amount_mb || r.jumlah_paket || 0),
            r.package_start_date || r.tanggal_pengisian || null,
            Number(r.package_duration_days || r.durasi || 0),
            Number(r.package_cost || r.biaya || 0),
          ]
        );
        imported.push(result.rows[0]);
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    res.json({ imported: imported.length, errors, total: records.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/devices/export/csv
router.get('/export/csv', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM devices ORDER BY created_at DESC');

    const data = result.rows.map(d => ({
      nama: d.name,
      phone: d.phone,
      lokasi: d.location,
      tipe_kartu: d.card_type,
      operator: d.operator,
      jumlah_paket_mb: d.package_amount_mb,
      tanggal_pengisian: d.package_start_date ? d.package_start_date.toISOString().slice(0, 10) : '',
      durasi_hari: d.package_duration_days,
      biaya: d.package_cost,
    }));

    const csv = stringify(data, { header: true });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="devices_export_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/devices/export/json
router.get('/export/json', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM devices ORDER BY created_at DESC');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="devices_export_${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
