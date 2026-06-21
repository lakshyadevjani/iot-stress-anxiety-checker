const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const DATA_FILE = path.join(__dirname, 'data.json');
const SESSION_SECRET = process.env.SESSION_SECRET || 'calmsense-secret';
const MONGODB_URI = process.env.MONGODB_URI || null;

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup session store
const sessionConfig = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
};

if (MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    touchAfter: 24 * 3600
  });
  console.log('✓ Using MongoDB for session store');
} else {
  console.log('⚠ Using in-memory session store (sessions will not persist across restarts)');
}

app.use(session(sessionConfig));

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      current: {
        hr: 78,
        gsr: 5.4,
        spo2: 96,
        temp: 36.8,
        stressIndex: 42,
        deviceConnected: false
      },
      readings: [],
      users: {
        admin: 'admin123'
      }
    };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const dataStore = loadData();
if (!Array.isArray(dataStore.readings)) {
  dataStore.readings = [];
}

function calcStress(hr, gsr, spo2, temp) {
  const hrScore = Math.min(100, Math.max(0, ((hr - 60) / 60) * 100));
  const gsrScore = Math.min(100, Math.max(0, (gsr / 15) * 100));
  const spo2Score = Math.min(100, Math.max(0, ((100 - spo2) / 12) * 100));
  const tempScore = Math.min(100, Math.max(0, ((temp - 36.0) / 2) * 100));
  return Math.round(hrScore * 0.3 + gsrScore * 0.35 + spo2Score * 0.2 + tempScore * 0.15);
}

function getStatus(hr, gsr, spo2, temp) {
  return {
    hr: hr >= 100 ? 'High' : hr >= 85 ? 'Elevated' : 'Normal',
    gsr: gsr >= 10 ? 'High' : gsr >= 7 ? 'Elevated' : 'Normal',
    spo2: spo2 <= 92 ? 'High' : spo2 <= 95 ? 'Elevated' : 'Normal',
    temp: temp >= 38 ? 'High' : temp >= 37.2 ? 'Elevated' : 'Normal'
  };
}

function makeAlerts(reading) {
  const alerts = [];
  if (reading.hr > 100) alerts.push({ type: 'alert-warn', icon: '❤️', title: 'Elevated heart rate detected', time: 'Just now — consider rest' });
  if (reading.gsr > 8) alerts.push({ type: 'alert-warn', icon: '⚡', title: 'High skin conductance — stress response active', time: 'Skin moisture elevated' });
  if (reading.spo2 < 94) alerts.push({ type: 'alert-warn', icon: '💧', title: 'SpO₂ below recommended range', time: 'Breathe deeply and relax' });
  if (reading.temp > 37.5) alerts.push({ type: 'alert-warn', icon: '🌡️', title: 'Slight temperature elevation', time: 'Monitor for fever' });
  if (alerts.length === 0) alerts.push({ type: 'alert-ok', icon: '✓', title: 'All vitals within normal range', time: 'No action needed' });
  alerts.push({ type: 'alert-info-item', icon: 'ℹ️', title: 'Tip: 4-7-8 breathing can reduce stress quickly', time: 'Inhale 4s → Hold 7s → Exhale 8s' });
  alerts.push({ type: 'alert-info-item', icon: '📊', title: 'Stress index calculated from 4 IoT sensors', time: 'HR + GSR + SpO₂ + Temperature' });
  return alerts;
}

function buildResponse() {
  const history = dataStore.readings.slice(-30);
  const current = dataStore.current;
  const alertList = makeAlerts(current);
  return {
    current,
    history,
    status: getStatus(current.hr, current.gsr, current.spo2, current.temp),
    alerts: alertList,
    deviceConnected: current.deviceConnected
  };
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'unauthorized' });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing username or password' });
  }
  const expected = dataStore.users[username];
  if (expected && password === expected) {
    req.session.authenticated = true;
    req.session.user = username;
    return res.json({ success: true, user: username });
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/auth', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated, user: req.session.user || null });
});

app.get('/api/readings', requireAuth, (req, res) => {
  res.json(buildResponse());
});

app.post('/api/readings', requireAuth, (req, res) => {
  const reading = req.body;
  if (!reading || typeof reading.hr !== 'number') {
    return res.status(400).json({ error: 'Invalid reading payload' });
  }
  const updated = {
    hr: reading.hr,
    gsr: reading.gsr,
    spo2: reading.spo2,
    temp: reading.temp,
    stressIndex: calcStress(reading.hr, reading.gsr, reading.spo2, reading.temp),
    timestamp: new Date().toISOString(),
    deviceConnected: !!reading.deviceConnected
  };
  dataStore.current = updated;
  dataStore.readings.push(updated);
  if (dataStore.readings.length > 100) {
    dataStore.readings.shift();
  }
  saveData(dataStore);
  res.json({ success: true, current: updated });
});

app.post('/api/device', requireAuth, (req, res) => {
  const enabled = !!req.body.connected;
  dataStore.current.deviceConnected = enabled;
  saveData(dataStore);
  res.json({ success: true, deviceConnected: enabled });
});

app.use('/dashboard.html', (req, res, next) => {
  if (!req.session.authenticated) {
    return res.redirect('/index.html');
  }
  next();
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`CalmSense backend running on http://localhost:${PORT}`);
});
