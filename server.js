const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const ADMIN_USER = 'admin';

const ADMIN_PASSWORD_HASH = bcrypt.hashSync('novatech123', 10);
const app = express();
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
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

// ── Simple JSON Database ───────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'database.json');

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initial = { projects: [], categories: getDefaultCategories(), settings: getDefaultSettings() };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch { return { projects: [], categories: getDefaultCategories(), settings: getDefaultSettings() }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getDefaultCategories() {
  return [
    { id: 'plans',          label: 'Plans Techniques',  color: '#22c55e', icon: '📐' },
    { id: 'construction',   label: 'Construction',       color: '#1a56db', icon: '🏗️' },
    { id: 'conception',     label: 'Conception 3D',      color: '#0ea5e9', icon: '🖥️' },
    { id: 'rehabilitation', label: 'Réhabilitation',     color: '#f59e0b', icon: '🔧' },
    { id: 'industriel',     label: 'Industriel',         color: '#8b5cf6', icon: '🏭' },
    { id: 'residentiel',    label: 'Résidentiel',        color: '#ec4899', icon: '🏠' },
    { id: 'commercial',     label: 'Commercial',         color: '#f97316', icon: '🏢' },
    { id: 'autre',          label: 'Autre',              color: '#6b7280', icon: '📁' },
  ];
}

function getDefaultSettings() {
  return {
    companyName: 'NovaTech Études et Conception',
    tagline: 'Votre expertise en ingénierie et conception',
    phone: '+90 505 459 64 58',
    email: 'contact@novatech-ec.com',
    address: 'Istanbul, Turquie',
    whatsapp: '+905054596458',
    heroTitle: 'Plans & Conceptions\nProfessionnels',
    heroSub: 'Études techniques, plans d\'exécution et conception 3D pour vos projets de construction.',
    aboutText: 'Chez NovaTech Études et Conception, nous mettons notre expertise au service de vos projets d\'ingénierie et de conception. Notre équipe d\'ingénieurs et de techniciens qualifiés travaille avec rigueur, créativité et innovation afin de transformer vos idées en solutions concrètes, modernes et performantes.',
    stats: { projects: 120, years: 6, satisfaction: 98, experts: 15 }
  };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Image Upload ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|pdf/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
               allowed.test(file.mimetype.split('/')[1]);
    cb(ok ? null : new Error('Type de fichier non autorisé'), ok);
  }
});

// ════════════════════════════════════════════════
// API ROUTES
// ════════════════════════════════════════════════

// ── GET all projects (public) ──────────────────
app.get('/api/projects', (req, res) => {
  const db = readDB();
  let projects = [...db.projects];
  const { category, search, sort = 'newest', limit, featured } = req.query;

  if (category && category !== 'all') projects = projects.filter(p => p.category === category);
  if (search) {
    const s = search.toLowerCase();
    projects = projects.filter(p =>
      p.title.toLowerCase().includes(s) ||
      (p.description || '').toLowerCase().includes(s) ||
      (p.location || '').toLowerCase().includes(s)
    );
  }
  if (featured === 'true') projects = projects.filter(p => p.featured);

  if (sort === 'newest') projects.sort((a, b) => b.createdAt - a.createdAt);
  else if (sort === 'oldest') projects.sort((a, b) => a.createdAt - b.createdAt);
  else if (sort === 'alpha') projects.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'price') projects.sort((a, b) => (a.price || 0) - (b.price || 0));

  if (limit) projects = projects.slice(0, parseInt(limit));

  res.json({ success: true, data: projects, total: projects.length });
});

// ── GET one project ────────────────────────────
app.get('/api/projects/:id', (req, res) => {
  const db = readDB();
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Projet introuvable' });
  res.json({ success: true, data: project });
});

// ── POST create project ────────────────────────
app.post('/api/projects', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 },
  { name: 'pdf', maxCount: 1 }
]), (req, res) => {
  try {
    const db = readDB();
    const { title, category, description, location, year, surface, client, price, currency, featured, tags } = req.body;

    if (!title || !category) return res.status(400).json({ success: false, message: 'Titre et catégorie obligatoires' });

    const project = {
      id: genId(),
      title: title.trim(),
      category,
      description: description || '',
      location: location || '',
      year: year || new Date().getFullYear().toString(),
      surface: surface || '',
      client: client || '',
      price: price ? parseFloat(price) : null,
      currency: currency || 'EUR',
      featured: featured === 'true' || featured === true,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      image: req.files?.image ? `/uploads/${req.files.image[0].filename}` : null,
      gallery: req.files?.gallery ? req.files.gallery.map(f => `/uploads/${f.filename}`) : [],
      pdf: req.files?.pdf ? `/uploads/${req.files.pdf[0].filename}` : null,
      views: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    db.projects.unshift(project);
    writeDB(db);
    res.status(201).json({ success: true, data: project, message: 'Projet créé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT update project ─────────────────────────
app.put('/api/projects/:id', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 },
  { name: 'pdf', maxCount: 1 }
]), (req, res) => {
  try {
    const db = readDB();
    const idx = db.projects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Projet introuvable' });

    const old = db.projects[idx];
    const { title, category, description, location, year, surface, client, price, currency, featured, tags, removeImage, removeGallery } = req.body;

    // Handle image update
    let image = old.image;
    if (req.files?.image) {
      if (old.image) tryDeleteFile(old.image);
      image = `/uploads/${req.files.image[0].filename}`;
    }
    if (removeImage === 'true') {
      if (old.image) tryDeleteFile(old.image);
      image = null;
    }

    // Handle gallery
    let gallery = [...(old.gallery || [])];
    if (req.files?.gallery) {
      const newImgs = req.files.gallery.map(f => `/uploads/${f.filename}`);
      gallery = [...gallery, ...newImgs];
    }
    if (removeGallery) {
      const toRemove = Array.isArray(removeGallery) ? removeGallery : [removeGallery];
      toRemove.forEach(img => { tryDeleteFile(img); gallery = gallery.filter(g => g !== img); });
    }

    db.projects[idx] = {
      ...old,
      title: (title || old.title).trim(),
      category: category || old.category,
      description: description !== undefined ? description : old.description,
      location: location !== undefined ? location : old.location,
      year: year || old.year,
      surface: surface !== undefined ? surface : old.surface,
      client: client !== undefined ? client : old.client,
      price: price !== undefined ? (price ? parseFloat(price) : null) : old.price,
      currency: currency || old.currency,
      featured: featured !== undefined ? (featured === 'true' || featured === true) : old.featured,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : old.tags,
      image, gallery,
      pdf: req.files?.pdf ? `/uploads/${req.files.pdf[0].filename}` : old.pdf,
      updatedAt: Date.now()
    };

    writeDB(db);
    res.json({ success: true, data: db.projects[idx], message: 'Projet mis à jour' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE project ─────────────────────────────
app.delete('/api/projects/:id', (req, res) => {
  const db = readDB();
  const idx = db.projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Projet introuvable' });

  const p = db.projects[idx];
  if (p.image) tryDeleteFile(p.image);
  (p.gallery || []).forEach(g => tryDeleteFile(g));
  if (p.pdf) tryDeleteFile(p.pdf);

  db.projects.splice(idx, 1);
  writeDB(db);
  res.json({ success: true, message: 'Projet supprimé' });
});

// ── PATCH increment views ──────────────────────
app.patch('/api/projects/:id/view', (req, res) => {
  const db = readDB();
  const p = db.projects.find(p => p.id === req.params.id);
  if (p) { p.views = (p.views || 0) + 1; writeDB(db); }
  res.json({ success: true });
});

// ── GET categories ─────────────────────────────
app.get('/api/categories', (req, res) => {
  const db = readDB();
  const counts = {};
  db.projects.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const cats = db.categories.map(c => ({ ...c, count: counts[c.id] || 0 }));
  res.json({ success: true, data: cats });
});

// ── GET / POST settings ────────────────────────
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.settings });
});

app.put('/api/settings', (req, res) => {
  const db = readDB();
  db.settings = { ...db.settings, ...req.body };
  writeDB(db);
  res.json({ success: true, data: db.settings });
});

// ── GET stats ──────────────────────────────────
app.get('/api/stats', (req, res) => {
  const db = readDB();
  const counts = {};
  let totalViews = 0;
  db.projects.forEach(p => {
    counts[p.category] = (counts[p.category] || 0) + 1;
    totalViews += p.views || 0;
  });
  res.json({
    success: true,
    data: {
      total: db.projects.length,
      totalViews,
      featured: db.projects.filter(p => p.featured).length,
      byCat: counts,
      recent: db.projects.slice(0, 5)
    }
  });
});

// ── POST contact form ──────────────────────────
app.post('/api/contact', (req, res) => {
  const { name, email, phone, service, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
  // In production: send email via nodemailer here
  console.log('📧 Nouveau message:', { name, email, phone, service, message });
  res.json({ success: true, message: 'Message reçu ! Nous vous répondons sous 24h.' });
});

// ── Helper ─────────────────────────────────────
function tryDeleteFile(filePath) {
  try {
    const full = path.join(__dirname, 'public', filePath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {}
}

// ── Catch-all → SPA ───────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 NovaTech Server running on http://localhost:${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`🖼️  Uploads: ${path.join(__dirname, 'public/uploads')}\n`);
});
