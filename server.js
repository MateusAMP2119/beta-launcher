const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'submissions.json');

// Helper to save data (Synchronous I/O for safety)
const saveSubmission = (data) => {
  let submissions = [];
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
      submissions = JSON.parse(fileContent);
    }
  } catch (err) {
    console.error('Error reading submissions file:', err);
  }

  submissions.push({
    ...data,
    timestamp: new Date().toISOString()
  });

  try {
    // Atomic write in Node structure (Sync)
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing submissions file:', err);
    return false;
  }
};

app.post('/api/join', (req, res) => {
  const { email, name, apiAccess, visitorId } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  const saved = saveSubmission({
    type: 'join',
    email,
    name,
    apiAccess: !!apiAccess,
    visitorId
  });

  if (saved) {
    res.json({ success: true, message: 'Successfully joined beta list' });
  } else {
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

app.post('/api/feedback', (req, res) => {
  const { feedback, visitorId } = req.body;
  if (!feedback) {
    return res.status(400).json({ error: 'Feedback content is required' });
  }

  const saved = saveSubmission({
    type: 'feedback',
    content: feedback,
    visitorId
  });

  if (saved) {
    res.json({ success: true, message: 'Feedback received' });
  } else {
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

app.post('/api/visit', (req, res) => {
  const userAgent = req.get('User-Agent');
  const { visitorId } = req.body;
  const saved = saveSubmission({
    type: 'visit',
    userAgent,
    visitorId
  });

  if (saved) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to log visit' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ totalVisitors: 0, totalJoins: 0, leads: [] });
    }

    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    const submissions = JSON.parse(fileContent);

    const visitors = new Set();
    const joins = new Map();

    submissions.forEach(entry => {
      if (entry.visitorId) {
        visitors.add(entry.visitorId);
      }

      if (entry.type === 'join') {
        const key = entry.visitorId || entry.email;
        if (key) {
          joins.set(key, entry);
        }
      }
    });

    const leads = Array.from(joins.values());

    res.json({
      totalVisitors: visitors.size,
      totalJoins: leads.length,
      leads
    });

  } catch (err) {
    console.error('Error generating stats:', err);
    res.status(500).json({ error: 'Failed to generate stats' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
