const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const app = express();
cloudinary.config({
  cloud_name: 'dfcjv30bh',
  api_key: '161767456973298',
  api_secret: 'F6dGPvJULUje_teVz0d_jTJlMF8'
});
const ADMIN_USER = 'mekla';
const ADMIN_PASSWORD = '7793482703';

const PORT = process.env.PORT || 3000;

const MONGO_URI = 'mongodb+srv://aichahousseinmed01_db_user:mekla123@mekla.15tlhny.mongodb.net/?retryWrites=true&w=majority&appName=mekla';

mongoose.connect(MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true
})

.then(() => {
  console.log('✅ MongoDB Connected');
})

.catch(err => {
  console.log('MongoDB Error:', err);
});

app.use(cookieParser());

app.use(session({
  secret: 'novatech_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// ── Middleware ─────────────────────────────────
app.use(cors());

app.use(express.json({
  limit: '50mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '50mb'
}));

app.use(express.static('public'));

app.use('/uploads',
  express.static('public/uploads')
);

// ── Database ───────────────────────────────────
const DB_PATH = path.join(__dirname, 'database.json');

function readDB() {

  try {

    if (!fs.existsSync(DB_PATH)) {

      const initial = {
        projects: []
      };

      fs.writeFileSync(
        DB_PATH,
        JSON.stringify(initial, null, 2)
      );

      return initial;

    }

    return JSON.parse(
      fs.readFileSync(DB_PATH, 'utf8')
    );

  } catch {

    return {
      projects: []
    };

  }

}

function writeDB(data) {

  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(data, null, 2)
  );

}

function genId() {

  return Date.now().toString(36) +
  Math.random().toString(36).slice(2);

}

// ── Upload ─────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'novatech',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf']
  }
});
const upload = multer({
  storage
});

// ════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════

app.post('/api/login', (req, res) => {

  const { username, password } = req.body;

  if (
    username === ADMIN_USER &&
    password === ADMIN_PASSWORD
  ) {

    req.session.authenticated = true;

    return res.json({
      success: true
    });

  }

  return res.status(401).json({
    error: 'Invalid credentials'
  });

});

app.get('/api/check-auth', (req, res) => {

  if (req.session.authenticated) {

    return res.json({
      authenticated: true
    });

  }

  return res.status(401).json({
    authenticated: false
  });

});

app.post('/api/logout', (req, res) => {

  req.session.destroy(() => {

    res.json({
      success: true
    });

  });

});

function requireAuth(req, res, next) {

  if (!req.session.authenticated) {

    return res.status(401).json({
      error: 'Unauthorized'
    });

  }

  next();

}

// ════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════

// GET ALL
app.get('/api/projects', (req, res) => {

  const db = readDB();

  res.json({
    success: true,
    data: db.projects
  });

});


// CREATE
app.post(
  '/api/projects',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
    { name: 'pdf', maxCount: 1 }
  ]),

  (req, res) => {

    try {

      const db = readDB();

      const project = {

        id: genId(),

        title: req.body.title || '',

        category: req.body.category || '',

        description:
        req.body.description || '',

        location:
        req.body.location || '',

        year:
        req.body.year || '',

        surface:
        req.body.surface || '',

        client:
        req.body.client || '',

        price:
        req.body.price || '',

        currency:
        req.body.currency || 'EUR',

        featured:
        req.body.featured || false,

        image:
          req.files?.image
    ? req.files.image[0].path
    : null,

        gallery:
 req.files?.gallery
    ? req.files.gallery.map(file => file.path)
    : [],

        pdf:
        req.files?.pdf
        ? `/uploads/${req.files.pdf[0].filename}`
        : null,

        createdAt: Date.now()

      };

      db.projects.unshift(project);

      writeDB(db);

      res.json({
        success: true,
        data: project
      });

    } catch (err) {

      console.log("❌ SERVER ERROR:");
      console.log(err);

      res.status(500).json({
        success: false,
        message: err.message
      });

    }

  }

);


// UPDATE
app.put(
  '/api/projects/:id',
  upload.single('image'),

  (req, res) => {

    const db = readDB();

    const index = db.projects.findIndex(
      p => p.id === req.params.id
    );

    if (index === -1) {

      return res.status(404).json({
        success: false
      });

    }

    db.projects[index] = {

      ...db.projects[index],

      title:
      req.body.title ||
      db.projects[index].title,

      category:
      req.body.category ||
      db.projects[index].category,

      description:
      req.body.description ||
      db.projects[index].description

    };

    if (req.file) {

      db.projects[index].image =
      `/uploads/${req.file.filename}`;

    }

    writeDB(db);

    res.json({
      success: true,
      data: db.projects[index]
    });

  }

);

// DELETE
app.delete(
  '/api/projects/:id',
  requireAuth,

  (req, res) => {

    const db = readDB();

    db.projects = db.projects.filter(
      p => p.id !== req.params.id
    );

    writeDB(db);

    res.json({
      success: true
    });

  }

);

// CONTACT
app.post('/api/contact', (req, res) => {

  console.log(req.body);

  res.json({
    success: true,
    message: 'Message reçu'
  });

});

// ── Catch all ──────────────────────────────────
app.get('*', (req, res) => {

  res.sendFile(
    path.join(__dirname,
    'public',
    'index.html')
  );

});

// ── Start ──────────────────────────────────────
app.listen(PORT, () => {

  console.log(
    `🚀 Server running on ${PORT}`
  );

});
