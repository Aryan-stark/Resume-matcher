const path = require('path');
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.use('/api', routes);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[resume-matcher] listening on http://localhost:${PORT}`);
});

module.exports = app;
