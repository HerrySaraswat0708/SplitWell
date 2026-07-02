require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({ crossOriginResourcePolicy: false }));

// In dev, allow the Vite dev server. In prod, same origin so CORS not needed for API,
// but keep it open so external tools / mobile apps can hit the API.
app.use(cors({
  origin: isProd ? '*' : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  credentials: !isProd,
}));

app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json());

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/analytics', require('./routes/analytics'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ── Serve React build in production ──────────────────────────────────────────
if (isProd) {
  const distPath = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // Let React Router handle all non-API paths
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    console.warn('⚠ frontend/dist not found — run the build first');
  }
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

db.init()
  .then(() => app.listen(PORT, () => console.log(`✓ Server running on http://localhost:${PORT}`)))
  .catch(err => {
    console.error('❌ Failed to connect to the database:', err.message);
    process.exit(1);
  });
