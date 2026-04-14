import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('database.sqlite');
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS smtp_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    secure BOOLEAN DEFAULT 1,
    user TEXT NOT NULL,
    pass TEXT NOT NULL,
    from_email TEXT NOT NULL,
    from_name TEXT,
    imap_host TEXT,
    imap_port INTEGER,
    imap_secure BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS contact_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active', -- active, bounced
    FOREIGN KEY (list_id) REFERENCES contact_lists(id)
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    list_id INTEGER,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    subjects TEXT,
    body TEXT NOT NULL,
    attachments TEXT, -- JSON array of file objects {filename, path}
    status TEXT DEFAULT 'draft', -- draft, sending, completed, paused
    processedCount INTEGER DEFAULT 0,
    openedCount INTEGER DEFAULT 0,
    clickedCount INTEGER DEFAULT 0,
    repliedCount INTEGER DEFAULT 0,
    totalContacts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (list_id) REFERENCES contact_lists(id)
  );

  CREATE TABLE IF NOT EXISTS campaign_smtp_map (
    campaign_id INTEGER NOT NULL,
    smtp_id INTEGER NOT NULL,
    PRIMARY KEY (campaign_id, smtp_id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (smtp_id) REFERENCES smtp_accounts(id)
  );

  CREATE TABLE IF NOT EXISTS campaign_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    smtp_id INTEGER,
    status TEXT NOT NULL, -- sent, delivered, failed
    error TEXT,
    message_id TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    opened_at DATETIME,
    clicked_at DATETIME,
    replied_at DATETIME,
    ip TEXT,
    user_agent TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id),
    FOREIGN KEY (smtp_id) REFERENCES smtp_accounts(id)
  );

  CREATE TABLE IF NOT EXISTS drip_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    delay_hours INTEGER NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tracking_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- open, click
    ip TEXT,
    user_agent TEXT,
    device_type TEXT,
    device_vendor TEXT,
    device_model TEXT,
    browser TEXT,
    os TEXT,
    location TEXT,
    city TEXT,
    country TEXT,
    region TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- open, click, reply, system
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    campaign_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );
`);

// Migration: Add columns if they don't exist
try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN processedCount INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN openedCount INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN clickedCount INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN repliedCount INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN totalContacts INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN list_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN subjects TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN attachments TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE contacts ADD COLUMN status TEXT DEFAULT 'active'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaign_logs ADD COLUMN opened_at DATETIME").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaign_logs ADD COLUMN replied_at DATETIME").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE smtp_accounts ADD COLUMN imap_host TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE smtp_accounts ADD COLUMN imap_port INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE smtp_accounts ADD COLUMN imap_secure BOOLEAN DEFAULT 1").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaign_logs ADD COLUMN message_id TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaign_logs ADD COLUMN clicked_at DATETIME").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaign_logs ADD COLUMN ip TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaign_logs ADD COLUMN user_agent TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaign_logs ADD COLUMN step_number INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN campaign_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN contact_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN event_type TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN ip TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN user_agent TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN device_type TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN browser TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN os TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN location TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN device_vendor TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN device_model TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN city TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN country TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE tracking_events ADD COLUMN region TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN last_smtp_index INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN delay_seconds INTEGER DEFAULT 5").run();
} catch (e) {}

export default db;
