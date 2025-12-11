const crypto = require('crypto');
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'submissions.json');
const CONFIG_FILE = path.join(__dirname, 'admin-config.json');

// Ensure unique IDs for all existing records on startup
try {
  if (fs.existsSync(DATA_FILE)) {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    let submissions = JSON.parse(fileContent);
    let modified = false;

    submissions = submissions.map(sub => {
      if (!sub.id) {
        sub.id = crypto.randomUUID();
        modified = true;
      }
      return sub;
    });

    if (modified) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
      console.log('Migrated data: Added missing IDs to submissions.');
    }
  }
} catch (err) {
  console.error('Error during data migration:', err);
}

// Basic Authentication Middleware
const basicAuth = (req, res, next) => {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      console.warn('Admin config not found, defaulting to open access (DEBUG ONLY) or denying.');
      return res.status(500).send('Server configuration error.');
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
      return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === config.username && pass === config.password) {
      next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
      res.status(401).send('Invalid credentials');
    }
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).send('Internal Server Error');
  }
};

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
    id: crypto.randomUUID(),
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
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const saved = saveSubmission({
    type: 'join',
    email,
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

// Delete Submission Endpoint
app.delete('/api/submissions/:id', basicAuth, (req, res) => {
  const { id } = req.params;
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.status(404).json({ error: 'No data found' });
    }

    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    let submissions = JSON.parse(fileContent);

    const initialLength = submissions.length;
    submissions = submissions.filter(sub => sub.id !== id);

    if (submissions.length === initialLength) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
    res.json({ success: true, message: 'Record deleted' });

  } catch (err) {
    console.error('Error deleting submission:', err);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// Serve the Stats Dashboard HTML
app.get('/api/stats', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

// Serve the Stats JSON Data
app.get('/api/stats/data', basicAuth, (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ totalVisitors: 0, totalJoins: 0, leads: [] });
    }

    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    const submissions = JSON.parse(fileContent);

    const visitors = new Set();
    const joins = new Map();

    submissions.forEach(entry => {
      // Track Unique Visitors
      if (entry.visitorId) {
        visitors.add(entry.visitorId);
      }

      // Track Signups
      if (entry.type === 'join') {
        const key = entry.email || entry.visitorId;
        // Upsert logic: keep latest or merge? Simple map by email overwrites info if same email joins again
        if (entry.email) {
          joins.set(entry.email, entry);
        }
      }
    });

    const leads = Array.from(joins.values()).map(({ name, ...rest }) => rest);
    const feedbackList = submissions.filter(entry => entry.type === 'feedback');

    res.json({
      totalVisitors: visitors.size,
      totalJoins: leads.length,
      totalFeedback: feedbackList.length,
      leads,
      feedback: feedbackList
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
