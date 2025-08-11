// Απλό Node/Express backend για demo "Keno-like"
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const POOL_SIZE = 80;
const DRAW_COUNT = 20;
const START_BALANCE = 1000;

const users = {};
const draws = {};

function createUser(id) {
  if (!users[id]) {
    users[id] = { balance: START_BALANCE, history: [] };
  }
  return users[id];
}

function commitDraw() {
  const seed = crypto.randomBytes(32).toString('hex');
  const commitHash = crypto.createHash('sha256').update(seed).digest('hex');
  const drawId = crypto.randomBytes(8).toString('hex');
  draws[drawId] = { commitHash, seed: null, numbers: null, timestamp: Date.now() };
  draws[drawId]._secret = seed;
  return { drawId, commitHash };
}

function revealDraw(drawId) {
  const d = draws[drawId];
  if (!d) throw new Error('Invalid drawId');
  if (d.seed) return d;
  const seed = d._secret;
  const numbers = [];
  let counter = 0;
  while (numbers.length < DRAW_COUNT) {
    const h = crypto.createHmac('sha256', seed).update(String(counter)).digest();
    for (let i = 0; i < h.length && numbers.length < DRAW_COUNT; i += 2) {
      const val = (h.readUInt16BE(i) % POOL_SIZE) + 1;
      if (!numbers.includes(val)) numbers.push(val);
    }
    counter++;
  }
  d.seed = seed;
  d.numbers = numbers;
  d.revealedAt = Date.now();
  return d;
}

const PAYOUTS = {
  1: {1: 2},
  2: {2: 6, 1: 0},
  3: {3: 15, 2: 2, 1: 0},
  4: {4: 50, 3: 8, 2: 1, 1: 0},
  5: {5: 120, 4: 20, 3: 5, 2: 1},
};

function computePayout(picksCount, hits, bet) {
  const table = PAYOUTS[picksCount] || {};
  const mult = table[hits] || 0;
  return Math.floor(bet * mult);
}

app.get('/api/commit', (req, res) => {
  res.json(commitDraw());
});

app.post('/api/play', (req, res) => {
  const { userId, drawId, picks, bet } = req.body;
  if (!userId || !Array.isArray(picks) || !drawId || !bet) {
    return res.status(400).json({ error: 'missing parameters' });
  }
  createUser(userId);
  const user = users[userId];
  if (user.balance < bet) return res.status(400).json({ error: 'insufficient balance' });

  try {
    revealDraw(drawId);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const draw = draws[drawId];
  const hits = picks.filter(p => draw.numbers.includes(p)).length;
  const payout = computePayout(picks.length, hits, bet);

  user.balance = user.balance - bet + payout;
  const record = {
    timestamp: Date.now(),
    drawId, picks, bet, hits, payout, numbers: draw.numbers
  };
  user.history.push(record);

  res.json({ balance: user.balance, record, commitHash: draw.commitHash, seed: draw.seed });
});

app.get('/api/user/:id', (req, res) => {
  createUser(req.params.id);
  res.json(users[req.params.id]);
});

app.get('/api/draw/:id', (req, res) => {
  const d = draws[req.params.id];
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json({ commitHash: d.commitHash, revealed: !!d.seed, numbers: d.numbers || null, seed: d.seed || null });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
