export function errorHandler(err, req, res, _next) {
  console.error('Error:', err.message);
  console.error(err.stack);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Data sudah ada (duplikat)' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referensi data tidak ditemukan' });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Format data tidak valid' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Terjadi kesalahan server internal',
  });
}
