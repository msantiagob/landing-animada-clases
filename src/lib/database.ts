import Database from 'better-sqlite3';
import { join } from 'path';

// Configuración de la base de datos
const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'database.sqlite');
console.log('🗃️  Database path:', dbPath);
const db = new Database(dbPath);

// Configurar WAL mode para mejor rendimiento
db.pragma('journal_mode = WAL');

// Tabla de usuarios administradores
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de formularios de contacto
db.exec(`
  CREATE TABLE IF NOT EXISTS contact_forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    status TEXT DEFAULT 'new',
    ip_address TEXT,
    user_agent TEXT,
    source_page TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de citas agendadas
db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    service_type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    timezone TEXT DEFAULT 'America/Bogota',
    duration INTEGER DEFAULT 60,
    message TEXT,
    status TEXT DEFAULT 'pending',
    google_calendar_id TEXT,
    meeting_link TEXT,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de artículos del blog
db.exec(`
  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    author TEXT NOT NULL,
    category TEXT,
    tags TEXT,
    status TEXT DEFAULT 'draft',
    featured BOOLEAN DEFAULT FALSE,
    seo_title TEXT,
    seo_description TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de landing pages dinámicas
db.exec(`
  CREATE TABLE IF NOT EXISTS landing_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    template TEXT NOT NULL,
    config TEXT NOT NULL, -- JSON con configuración de la página
    status TEXT DEFAULT 'draft',
    seo_title TEXT,
    seo_description TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de campañas de email
db.exec(`
  CREATE TABLE IF NOT EXISTS email_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    recipients TEXT NOT NULL, -- JSON array de emails
    status TEXT DEFAULT 'draft',
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    scheduled_at DATETIME,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de estadísticas y analytics
db.exec(`
  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address TEXT,
    session_id TEXT,
    metadata TEXT, -- JSON con datos adicionales
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Índices para mejor rendimiento
db.exec('CREATE INDEX IF NOT EXISTS idx_contact_forms_status ON contact_forms(status)');
db.exec('CREATE INDEX IF NOT EXISTS idx_contact_forms_created_at ON contact_forms(created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)');
db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)');
db.exec('CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status)');
db.exec('CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug)');
db.exec('CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)');
db.exec('CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at)');

export default db;

// Inicializar usuario admin por defecto
async function initializeDefaultAdmin() {
  try {
    const adminEmail = 'admin@sonmyd.com';
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const existingAdmin = stmt.get(adminEmail);
    
    if (!existingAdmin) {
      const bcrypt = await import('bcryptjs');
      const defaultPassword = 'admin123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      const insertStmt = db.prepare(`
        INSERT INTO users (email, password, name, role)
        VALUES (?, ?, ?, 'admin')
      `);
      
      insertStmt.run(adminEmail, hashedPassword, 'Administrador');
      
      console.log('🔐 Usuario admin creado:');
      console.log('Email:', adminEmail);
      console.log('Password:', defaultPassword);
      console.log('⚠️  IMPORTANTE: Cambia la contraseña en producción');
    }
  } catch (error) {
    console.error('Error inicializando admin:', error);
  }
}

// Ejecutar la inicialización
initializeDefaultAdmin();

// Funciones helper para las operaciones de base de datos
export const dbHelpers = {
  // Contacto
  insertContactForm: (data: any) => {
    const stmt = db.prepare(`
      INSERT INTO contact_forms (name, email, message, phone, company, ip_address, user_agent, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(data.name, data.email, data.message, data.phone, data.company, data.ip, data.userAgent, data.sourcePage);
  },

  getContactForms: (limit = 50, offset = 0) => {
    const stmt = db.prepare(`
      SELECT * FROM contact_forms 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  },

  updateContactFormStatus: (id: number, status: string) => {
    const stmt = db.prepare('UPDATE contact_forms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(status, id);
  },

  // Citas
  insertAppointment: (data: any) => {
    const stmt = db.prepare(`
      INSERT INTO appointments (name, email, phone, company, service_type, date, time, timezone, duration, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.name, data.email, data.phone, data.company, 
      data.serviceType, data.date, data.time, data.timezone, 
      data.duration, data.message
    );
  },

  getAppointments: (limit = 50, offset = 0) => {
    const stmt = db.prepare(`
      SELECT * FROM appointments 
      ORDER BY date DESC, time DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  },

  getAppointmentsByDate: (date: string) => {
    const stmt = db.prepare('SELECT * FROM appointments WHERE date = ? ORDER BY time');
    return stmt.all(date);
  },

  updateAppointmentStatus: (id: number, status: string) => {
    const stmt = db.prepare('UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(status, id);
  },

  // Blog
  insertBlogPost: (data: any) => {
    const stmt = db.prepare(`
      INSERT INTO blog_posts (title, slug, excerpt, content, image_url, author, category, tags, status, featured, seo_title, seo_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.title, data.slug, data.excerpt, data.content, data.imageUrl, 
      data.author, data.category, data.tags, data.status, data.featured,
      data.seoTitle, data.seoDescription
    );
  },

  getBlogPosts: (limit = 50, offset = 0) => {
    const stmt = db.prepare(`
      SELECT * FROM blog_posts 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  },

  getBlogPostBySlug: (slug: string) => {
    const stmt = db.prepare('SELECT * FROM blog_posts WHERE slug = ?');
    return stmt.get(slug);
  },

  updateBlogPost: (id: number, data: any) => {
    const stmt = db.prepare(`
      UPDATE blog_posts 
      SET title = ?, excerpt = ?, content = ?, image_url = ?, category = ?, tags = ?, 
          status = ?, featured = ?, seo_title = ?, seo_description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      data.title, data.excerpt, data.content, data.imageUrl, data.category, 
      data.tags, data.status, data.featured, data.seoTitle, data.seoDescription, id
    );
  },

  // Analytics
  insertAnalytics: (data: any) => {
    const stmt = db.prepare(`
      INSERT INTO analytics (event_type, page_url, referrer, user_agent, ip_address, session_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.eventType, data.pageUrl, data.referrer, data.userAgent, 
      data.ipAddress, data.sessionId, JSON.stringify(data.metadata || {})
    );
  },

  getAnalytics: (startDate: string, endDate: string, eventType?: string) => {
    let query = `
      SELECT * FROM analytics 
      WHERE created_at BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];
    
    if (eventType) {
      query += ' AND event_type = ?';
      params.push(eventType);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  // Landing Pages
  insertLandingPage: (data: any) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO landing_pages (name, slug, template, config, status, seo_title, seo_description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const configString = typeof data.config === 'string' ? data.config : JSON.stringify(data.config || {});
      console.log('📝 Insertando landing page con datos:', {
        name: data.name,
        slug: data.slug,
        template: data.template,
        config: configString,
        status: data.status || 'draft',
        seoTitle: data.seoTitle || '',
        seoDescription: data.seoDescription || ''
      });
      return stmt.run(
        data.name, 
        data.slug, 
        data.template, 
        configString, 
        data.status || 'draft', 
        data.seoTitle || '', 
        data.seoDescription || ''
      );
    } catch (error) {
      console.error('❌ Error en insertLandingPage:', error);
      throw error;
    }
  },

  getLandingPages: (limit = 50, offset = 0) => {
    const stmt = db.prepare(`
      SELECT * FROM landing_pages 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  },

  getLandingPageBySlug: (slug: string) => {
    const stmt = db.prepare('SELECT * FROM landing_pages WHERE slug = ?');
    return stmt.get(slug);
  },

  getLandingPageById: (id: number) => {
    const stmt = db.prepare('SELECT * FROM landing_pages WHERE id = ?');
    return stmt.get(id);
  },

  updateLandingPage: (id: number, data: any) => {
    const stmt = db.prepare(`
      UPDATE landing_pages 
      SET name = ?, slug = ?, template = ?, config = ?, status = ?, 
          seo_title = ?, seo_description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      data.name, data.slug, data.template, JSON.stringify(data.config || {}),
      data.status, data.seoTitle, data.seoDescription, id
    );
  },

  deleteLandingPage: (id: number) => {
    const stmt = db.prepare('DELETE FROM landing_pages WHERE id = ?');
    return stmt.run(id);
  },

  getLandingPageStats: () => {
    try {
      const totalStmt = db.prepare('SELECT COUNT(*) as count FROM landing_pages');
      const publishedStmt = db.prepare('SELECT COUNT(*) as count FROM landing_pages WHERE status = ?');
      const draftStmt = db.prepare('SELECT COUNT(*) as count FROM landing_pages WHERE status = ?');
      
      const total = totalStmt.get() as { count: number };
      const published = publishedStmt.get('published') as { count: number };
      const draft = draftStmt.get('draft') as { count: number };
      
      return {
        total: total.count,
        published: published.count,
        draft: draft.count
      };
    } catch (error) {
      console.error('❌ Error en getLandingPageStats:', error);
      return {
        total: 0,
        published: 0,
        draft: 0
      };
    }
  }
};