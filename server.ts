import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { parse } from "csv-parse";
import nodemailer from "nodemailer";
import { ImapFlow } from 'imapflow';
import db from "./db";
// Triggering re-index for IDE stability
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = (process.env.JWT_SECRET && process.env.JWT_SECRET.length > 0) 
  ? process.env.JWT_SECRET 
  : "apexreach_stable_secret_v2_2026";
console.log(`[AUTH] JWT_SECRET initialized. Hash: ${Buffer.from(JWT_SECRET).toString('base64').substring(0, 12)}...`);
const upload = multer({ dest: "uploads/" });

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  io.on("connection", (socket) => {
    console.log("[SOCKET] Client connected:", socket.id);
    socket.on("join", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`[SOCKET] User ${userId} joined room user_${userId}`);
    });
  });

  app.use(express.json());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const createNotification = (userId: number, type: string, title: string, message: string, campaignId?: number) => {
    try {
      const result = db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, campaign_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, type, title, message, campaignId || null);

      const notificationId = Number(result.lastInsertRowid);
      
      const notification = {
        id: notificationId,
        user_id: userId,
        type,
        title,
        message,
        campaign_id: campaignId,
        is_read: 0,
        created_at: new Date().toISOString()
      };

      io.to(`user_${userId}`).emit('notification', notification);
      return notification;
    } catch (err) {
      console.error('[SYSTEM] Failed to create notification:', err);
      return null;
    }
  };

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      db: db ? "connected" : "error"
    });
  });

  let detectedAppUrl = process.env.APP_URL || "";

  app.use((req, res, next) => {
    if (req.headers.host) {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const currentUrl = `${protocol}://${req.headers.host}`;
      if (detectedAppUrl !== currentUrl) {
        detectedAppUrl = currentUrl;
        console.log(`[SYSTEM] Current App URL: ${detectedAppUrl}`);
      }
    }
    next();
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || token === 'null' || token === 'undefined') {
      console.warn(`[AUTH] Missing or invalid token format for ${req.method} ${req.url}. Token: ${token}`);
      return res.status(401).json({ 
        error: "Authentication required.", 
        debug: { reason: "token_missing", received: token } 
      });
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        console.warn(`[AUTH] JWT Verify Error (${err.name}) for ${req.method} ${req.url}: ${err.message}`);
        return res.status(401).json({ 
          error: "Session expired or invalid.", 
          debug: { reason: "jwt_error", name: err.name, message: err.message } 
        });
      }
      
      if (!decoded || !decoded.id) {
        console.warn(`[AUTH] Malformed token payload for ${req.method} ${req.url}`);
        return res.status(401).json({ 
          error: "Invalid session data.", 
          debug: { reason: "malformed_payload" } 
        });
      }
      
      const userId = Number(decoded.id);
      let user;
      try {
        user = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(userId) as any;
      } catch (dbErr: any) {
        console.error(`[AUTH] Database error during user lookup:`, dbErr);
        return res.status(500).json({ error: "Internal server error during authentication." });
      }
      
      if (!user) {
        console.error(`[AUTH] User ID ${userId} not found in database. Token is valid but user record is missing.`);
        return res.status(401).json({ 
          error: "User account no longer exists.", 
          debug: { reason: "user_not_found", userId } 
        });
      }
      
      req.user = user;
      next();
    });
  };

  // --- Auth Routes ---
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)");
      const result = stmt.run(email, hashedPassword, name);
      const userId = Number(result.lastInsertRowid);
      const token = jwt.sign({ id: userId, email }, JWT_SECRET);
      res.json({ token, user: { id: userId, email, name } });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed: users.email')) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(400).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    const userId = Number(user.id);
    const token = jwt.sign({ id: userId, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: userId, email: user.email, name: user.name } });
  });

  // --- Notification Routes ---
  app.get("/api/notifications", authenticateToken, (req: any, res) => {
    const notifications = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all(req.user.id);
    res.json(notifications);
  });

  app.post("/api/notifications/:id/read", authenticateToken, (req: any, res) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.post("/api/notifications/read-all", authenticateToken, (req: any, res) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.user.id);
    res.json({ success: true });
  });

  // --- Tracking Routes ---
  app.get("/api/track/open", async (req, res) => {
    const { c: campaignId, ct: contactId } = req.query;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'Unknown').split(',')[0].trim();

    if (campaignId && contactId) {
      try {
        const parser = new UAParser(userAgent);
        const ua = parser.getResult();
        const geo = geoip.lookup(ip);

        db.prepare(`
          INSERT INTO tracking_events (
            campaign_id, contact_id, event_type, ip, user_agent, 
            device_type, device_vendor, device_model, browser, os, 
            city, country, region
          )
          VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          campaignId, contactId, ip, userAgent, 
          ua.device.type || 'desktop', ua.device.vendor || 'Unknown', ua.device.model || 'Unknown',
          ua.browser.name || 'Unknown', ua.os.name || 'Unknown',
          geo?.city || 'Unknown', geo?.country || 'Unknown', geo?.region || 'Unknown'
        );

        const result = db.prepare(`
          UPDATE campaign_logs 
          SET opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
              ip = ?, 
              user_agent = ? 
          WHERE campaign_id = ? AND contact_id = ? AND opened_at IS NULL
        `).run(ip, userAgent, campaignId, contactId);
        
        const isFirstOpen = result.changes > 0;
        if (isFirstOpen) {
          db.prepare("UPDATE campaigns SET openedCount = openedCount + 1 WHERE id = ?").run(campaignId);
        }

        const campaign: any = db.prepare("SELECT user_id, name FROM campaigns WHERE id = ?").get(campaignId);
        const contact: any = db.prepare("SELECT email, name FROM contacts WHERE id = ?").get(contactId);
        if (campaign) {
          if (isFirstOpen) {
            createNotification(
              campaign.user_id,
              'open',
              'Email Opened',
              `${contact?.name || contact?.email || 'Someone'} opened your email for campaign "${campaign.name}"`,
              Number(campaignId)
            );
          }

          io.to(`user_${campaign.user_id}`).emit("activity", {
            type: "open",
            campaignId: campaignId,
            campaignName: campaign.name,
            contactEmail: contact?.email,
            contactName: contact?.name,
            isFirst: isFirstOpen,
            device: ua.device.type || 'desktop',
            browser: ua.browser.name || 'Unknown',
            os: ua.os.name || 'Unknown',
            city: geo?.city || 'Unknown',
            country: geo?.country || 'Unknown',
            ip: ip,
            timestamp: new Date()
          });
        }
      } catch (e) {
        console.error("Failed to track open:", e);
      }
    }
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(pixel);
  });

  app.get("/api/track/click", (req, res) => {
    const { c: campaignId, ct: contactId, url } = req.query;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'Unknown').split(',')[0].trim();
    
    if (campaignId && contactId) {
      try {
        const parser = new UAParser(userAgent);
        const ua = parser.getResult();
        const geo = geoip.lookup(ip);

        db.prepare(`
          INSERT INTO tracking_events (
            campaign_id, contact_id, event_type, ip, user_agent, 
            device_type, device_vendor, device_model, browser, os, 
            city, country, region
          )
          VALUES (?, ?, 'click', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          campaignId, contactId, ip, userAgent, 
          ua.device.type || 'desktop', ua.device.vendor || 'Unknown', ua.device.model || 'Unknown',
          ua.browser.name || 'Unknown', ua.os.name || 'Unknown',
          geo?.city || 'Unknown', geo?.country || 'Unknown', geo?.region || 'Unknown'
        );

        const result = db.prepare(`
          UPDATE campaign_logs 
          SET clicked_at = CURRENT_TIMESTAMP,
              opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
              ip = ?, 
              user_agent = ? 
          WHERE campaign_id = ? AND contact_id = ? AND clicked_at IS NULL
        `).run(ip, userAgent, campaignId, contactId);
        
        const isFirstClick = result.changes > 0;
        if (isFirstClick) {
          db.prepare("UPDATE campaigns SET clickedCount = clickedCount + 1 WHERE id = ?").run(campaignId);
        }

        const campaign: any = db.prepare("SELECT user_id, name FROM campaigns WHERE id = ?").get(campaignId);
        const contact: any = db.prepare("SELECT email, name FROM contacts WHERE id = ?").get(contactId);
        if (campaign) {
          if (isFirstClick) {
            createNotification(
              campaign.user_id,
              'click',
              'Link Clicked',
              `${contact?.name || contact?.email || 'Someone'} clicked a link in your campaign "${campaign.name}"`,
              Number(campaignId)
            );
          }

          io.to(`user_${campaign.user_id}`).emit("activity", {
            type: "click",
            campaignId: campaignId,
            campaignName: campaign.name,
            contactEmail: contact?.email,
            contactName: contact?.name,
            isFirst: isFirstClick,
            device: ua.device.type || 'desktop',
            browser: ua.browser.name || 'Unknown',
            os: ua.os.name || 'Unknown',
            city: geo?.city || 'Unknown',
            country: geo?.country || 'Unknown',
            ip: ip,
            url: url,
            timestamp: new Date()
          });
        }
      } catch (e) {
        console.error("Failed to track click:", e);
      }
    }
    
    if (url) {
      res.redirect(url as string);
    } else {
      res.redirect('/');
    }
  });

  // --- SMTP Routes ---
  app.get("/api/smtp", authenticateToken, (req: any, res) => {
    const accounts = db.prepare("SELECT id, name, host, port, secure, user, from_email, from_name, imap_host, imap_port, imap_secure FROM smtp_accounts WHERE user_id = ?").all(req.user.id);
    res.json(accounts);
  });

  app.post("/api/smtp", authenticateToken, (req: any, res) => {
    const { name, host, port, secure, user, pass, from_email, from_name, imap_host, imap_port, imap_secure } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO smtp_accounts (user_id, name, host, port, secure, user, pass, from_email, from_name, imap_host, imap_port, imap_secure)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, name, host, port, secure ? 1 : 0, user, pass, from_email, from_name, imap_host, imap_port, imap_secure ? 1 : 0);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/smtp/test", authenticateToken, async (req: any, res) => {
    const { host, port, secure, user, pass, imap_host, imap_port, imap_secure, testRecipient } = req.body;
    
    console.log(`[SMTP TEST] Starting test for ${user} on ${host}:${port}`);
    
    try {
      // 1. Test SMTP
      const isOffice365 = host.toLowerCase().includes('office365') || host.toLowerCase().includes('outlook.com');
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { 
          user, 
          pass
        },
        tls: { 
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          servername: host
        },
        requireTLS: port === 587 || isOffice365,
        debug: true,
        logger: true,
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 45000
      });

      try {
        // Retry logic for flaky O365 connections
        let lastErr;
        for (let i = 0; i < 3; i++) {
          try {
            console.log(`[SMTP TEST] Attempt ${i + 1} to verify transporter...`);
            await transporter.verify();
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            console.warn(`[SMTP TEST] Attempt ${i + 1} failed:`, e.message);
            if (i < 2) await new Promise(r => setTimeout(r, 3000));
          }
        }
        if (lastErr) throw lastErr;
      } catch (smtpErr: any) {
        console.error(`[SMTP TEST] SMTP Verification Failed:`, smtpErr);
        let msg = smtpErr.message;
        if (msg.includes('535-5.7.8') || msg.includes('Username and Password not accepted')) {
          msg = "Gmail Error: Use an App Password if 2FA is enabled.";
        } else if (msg.includes('security defaults policy')) {
          msg = "CRITICAL: Microsoft Security Defaults are ON. This blocks SMTP. You MUST go to Microsoft Entra (Azure AD) > Properties > Manage Security Defaults and set to DISABLED, or use an App Password.";
        } else if (msg.includes('BasicAuthBlocked') || msg.includes('535 5.7.139')) {
          msg = "Microsoft Security Block: Basic Auth is blocked. Disable 'Security Defaults' in Azure/Entra portal or use an App Password.";
        } else if (msg.includes('535') && isOffice365) {
          msg = "Office 365 Auth Failed: Check credentials. Ensure 'Authenticated SMTP' is enabled in Admin Center AND 'Security Defaults' are OFF.";
        } else if (msg.includes('ECONNRESET')) {
          msg = "Connection Reset: The server closed the connection. This often happens with Office 365 if TLS 1.2 is not enforced or if the IP is throttled.";
        }
        return res.status(400).json({ error: `SMTP Error: ${msg}` });
      }

      // 2. Test IMAP if provided
      let imapWarning = null;
      if (imap_host) {
        console.log(`[SMTP TEST] Starting IMAP test for ${user} on ${imap_host}:${imap_port}`);
        const isDefaultSecure = (imap_port === 993 || (!imap_port && imap_host.toLowerCase().includes('office365')));
        const client = new ImapFlow({
          host: imap_host,
          port: imap_port || 993,
          secure: imap_secure || isDefaultSecure,
          auth: { user, pass },
          logger: false,
          clientInfo: { name: 'ApexReach', version: '1.0.0' },
          tls: { 
            rejectUnauthorized: false, 
            servername: imap_host,
            minVersion: 'TLSv1.2'
          },
          disableCompression: true,
          connectionTimeout: 30000,
          greetingTimeout: 30000
        });

        try {
          await client.connect();
          await client.logout();
          console.log(`[SMTP TEST] IMAP test successful for ${user}`);
        } catch (imapErr: any) {
          console.error(`[SMTP TEST] IMAP Test Failed:`, imapErr);
          let msg = imapErr.message;
          if (msg.includes('AUTHENTICATE failed') || msg.includes('Authentication failed')) {
            if (msg.includes('BasicAuthBlocked')) {
              msg = "IMAP Basic Auth is BLOCKED by Microsoft. You MUST use an App Password (requires MFA) or enable Basic Auth for IMAP in M365 Admin Center.";
            } else {
              msg = "IMAP Auth Failed: Check credentials. For O365, ensure IMAP is enabled in Admin Center.";
            }
          } else if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
            msg = "IMAP Connection Failed: Check host and port. For O365 use outlook.office365.com port 993.";
          } else if (msg.includes('ECONNRESET')) {
            msg = "IMAP Connection Reset: Basic Auth might be blocked by Microsoft Security Defaults.";
          }
          // Don't fail the whole test if SMTP worked, just warn
          imapWarning = `SMTP OK, but IMAP failed: ${msg}`;
        }
      }

      // 3. Optional: Send test email if recipient provided
      if (testRecipient) {
        console.log(`[SMTP TEST] Sending test email to ${testRecipient}`);
        await transporter.sendMail({
          from: `"${req.user.name || 'ApexReach'}" <${user}>`,
          to: testRecipient,
          subject: "SMTP Test Connection",
          text: "Your SMTP connection is working perfectly!",
          html: "<p>Your SMTP connection is working perfectly!</p>"
        });
      }

      console.log(`[SMTP TEST] All tests passed for ${user}`);
      res.json({ 
        success: true, 
        message: imapWarning ? "SMTP Connected! (Note: IMAP failed)" : "Connection successful!",
        warning: imapWarning
      });
    } catch (err: any) {
      console.error(`[SMTP TEST] Global Error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/smtp/:id/send-test", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { testRecipient } = req.body;
    
    const smtp = db.prepare("SELECT * FROM smtp_accounts WHERE id = ? AND user_id = ?").get(id, req.user.id) as any;
    if (!smtp) return res.status(404).json({ error: "SMTP account not found" });

    try {
      const isOffice365 = smtp.host.toLowerCase().includes('office365') || smtp.host.toLowerCase().includes('outlook.com');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: (smtp.port === 465),
        auth: { user: smtp.user, pass: smtp.pass },
        tls: { 
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          servername: smtp.host
        },
        requireTLS: smtp.port === 587 || isOffice365,
        connectionTimeout: 30000,
        greetingTimeout: 30000
      });

      await transporter.sendMail({
        from: `"${smtp.from_name || req.user.name || 'ApexReach'}" <${smtp.from_email}>`,
        to: testRecipient,
        subject: "SMTP Test Email",
        text: "This is a test email from your ApexReach SMTP configuration.",
        html: "<p>This is a test email from your ApexReach SMTP configuration.</p>"
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/smtp/:id", authenticateToken, (req: any, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM smtp_accounts WHERE id = ? AND user_id = ?").run(id, req.user.id);
    res.json({ success: true });
  });

  // --- Contact Routes ---
  app.get("/api/lists", authenticateToken, (req: any, res) => {
    const lists = db.prepare(`
      SELECT l.*, 
        (SELECT COUNT(*) FROM contacts WHERE list_id = l.id) as contactCount,
        (SELECT COUNT(*) FROM contacts WHERE list_id = l.id AND status = 'active') as activeCount
      FROM contact_lists l 
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
    `).all(req.user.id);
    res.json(lists);
  });

  app.post("/api/lists", authenticateToken, (req: any, res) => {
    const { name } = req.body;
    const result = db.prepare("INSERT INTO contact_lists (user_id, name) VALUES (?, ?)").run(req.user.id, name);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/lists/:id", authenticateToken, (req: any, res) => {
    const { id } = req.params;
    
    // Check if the list belongs to the user
    const list = db.prepare("SELECT * FROM contact_lists WHERE id = ? AND user_id = ?").get(id, req.user.id);
    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }

    try {
      const transaction = db.transaction(() => {
        // 1. Nullify list_id in campaigns that use this list
        db.prepare("UPDATE campaigns SET list_id = NULL WHERE list_id = ?").run(id);
        
        // 2. Delete campaign_logs for all contacts in this list
        db.prepare(`
          DELETE FROM campaign_logs 
          WHERE contact_id IN (SELECT id FROM contacts WHERE list_id = ?)
        `).run(id);

        // 3. Delete associated contacts
        db.prepare("DELETE FROM contacts WHERE list_id = ?").run(id);
        
        // 4. Delete the list
        db.prepare("DELETE FROM contact_lists WHERE id = ?").run(id);
      });
      transaction();
      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Delete list error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/lists/:id/upload", authenticateToken, upload.single("file"), (req: any, res) => {
    const listId = req.params.id;
    const filePath = req.file.path;
    const contacts: any[] = [];

    const parser = parse({ columns: true, skip_empty_lines: true });
    import("fs").then(fs => {
      fs.createReadStream(filePath)
        .pipe(parser)
        .on("data", (row) => {
          contacts.push(row);
        })
        .on("end", () => {
          const insert = db.prepare("INSERT INTO contacts (list_id, email, name) VALUES (?, ?, ?)");
          const transaction = db.transaction((data) => {
            // Check if list still exists to avoid FK error
            const listExists = db.prepare("SELECT 1 FROM contact_lists WHERE id = ?").get(listId);
            if (!listExists) throw new Error("List no longer exists");
            
            for (const contact of data) {
              insert.run(listId, contact.email || contact.Email, contact.name || contact.Name || "");
            }
          });
          transaction(contacts);
          res.json({ count: contacts.length });
        });
    });
  });

  app.put("/api/contacts/:id/status", authenticateToken, (req: any, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    // Check if the contact belongs to the user (via contact_list)
    const contact = db.prepare(`
      SELECT c.* FROM contacts c
      JOIN contact_lists cl ON c.list_id = cl.id
      WHERE c.id = ? AND cl.user_id = ?
    `).get(id, req.user.id);
    
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    
    db.prepare("UPDATE contacts SET status = ? WHERE id = ?").run(status, id);
    res.json({ status: "ok" });
  });

  app.delete("/api/contacts/:id", authenticateToken, (req: any, res) => {
    const { id } = req.params;
    
    // Check if the contact belongs to the user
    const contact = db.prepare(`
      SELECT c.* FROM contacts c
      JOIN contact_lists cl ON c.list_id = cl.id
      WHERE c.id = ? AND cl.user_id = ?
    `).get(id, req.user.id);
    
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    
    try {
      db.transaction(() => {
        // Delete logs first to satisfy foreign key constraint
        db.prepare("DELETE FROM campaign_logs WHERE contact_id = ?").run(id);
        db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
      })();
      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Delete contact error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Campaign Routes ---
  app.get("/api/campaigns", authenticateToken, (req: any, res) => {
    try {
      const campaigns = db.prepare(`
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM contacts WHERE list_id = c.list_id AND status = 'active') as totalContacts,
          (SELECT COUNT(*) FROM campaign_logs WHERE campaign_id = c.id AND status = 'sent') as processedCount,
          (SELECT COUNT(*) FROM campaign_logs WHERE campaign_id = c.id AND status = 'sent') as sentCount,
          (SELECT COUNT(*) FROM campaign_logs WHERE campaign_id = c.id AND (opened_at IS NOT NULL OR replied_at IS NOT NULL)) as openedCount,
          (SELECT COUNT(*) FROM campaign_logs WHERE campaign_id = c.id AND replied_at IS NOT NULL) as repliedCount,
          (SELECT COUNT(*) FROM campaign_logs WHERE campaign_id = c.id AND (opened_at IS NOT NULL OR replied_at IS NOT NULL) AND replied_at IS NULL) as openedNotRepliedCount,
          (SELECT error FROM campaign_logs WHERE campaign_id = c.id AND status = 'failed' ORDER BY sent_at DESC LIMIT 1) as lastError
        FROM campaigns c
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `).all(req.user.id);
      res.json(campaigns);
    } catch (error: any) {
      console.error("Fetch campaigns error:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.post("/api/campaigns", authenticateToken, upload.array("attachments"), (req: any, res) => {
    try {
      const { name, subject, subjects, body, smtpIds, listId } = req.body;
      let attachments = req.files ? (req.files as any[]).map((f: any) => ({ filename: f.originalname, path: f.path })) : [];
      
      // Ensure unique attachments by filename
      attachments = Array.from(new Map(attachments.map(a => [a.filename, a])).values());
      
      const finalListId = listId === '' ? null : listId;

      if (finalListId) {
        const listExists = db.prepare("SELECT 1 FROM contact_lists WHERE id = ? AND user_id = ?").get(finalListId, req.user.id);
        if (!listExists) return res.status(400).json({ error: "Invalid contact list" });
      }

      const finalSubjects = typeof subjects === 'string' ? subjects : JSON.stringify(subjects || []);

      const result = db.prepare("INSERT INTO campaigns (user_id, name, subject, subjects, body, attachments, list_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(req.user.id, name, subject, finalSubjects, body, JSON.stringify(attachments), finalListId);
      const campaignId = result.lastInsertRowid;

      if (smtpIds) {
        const ids = typeof smtpIds === 'string' ? JSON.parse(smtpIds) : smtpIds;
        if (Array.isArray(ids)) {
          const insertMap = db.prepare("INSERT INTO campaign_smtp_map (campaign_id, smtp_id) VALUES (?, ?)");
          ids.forEach(id => insertMap.run(campaignId, id));
        }
      }

      res.json({ id: campaignId });
    } catch (error: any) {
      console.error("Create campaign error:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.get("/api/campaigns/:id", authenticateToken, (req: any, res) => {
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id) as any;
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    
    const smtpIds = db.prepare("SELECT smtp_id FROM campaign_smtp_map WHERE campaign_id = ?").all(req.params.id);
    res.json({ ...campaign, smtpIds: smtpIds.map((s: any) => s.smtp_id) });
  });

  app.put("/api/campaigns/:id/status", authenticateToken, (req: any, res) => {
    const { status } = req.body;
    const { id } = req.params;

    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND user_id = ?").get(id, req.user.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    db.prepare("UPDATE campaigns SET status = ? WHERE id = ?").run(status, id);
    res.json({ status: "ok" });
  });

  app.put("/api/campaigns/:id", authenticateToken, upload.array("attachments"), (req: any, res) => {
    try {
      const { name, subject, subjects, body, smtpIds, listId, existingAttachments } = req.body;
      const campaign: any = db.prepare("SELECT * FROM campaigns WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });

      let attachments = existingAttachments ? JSON.parse(existingAttachments) : [];
      if (req.files && (req.files as any[]).length > 0) {
        const newAttachments = (req.files as any[]).map((f: any) => ({ filename: f.originalname, path: f.path }));
        // Ensure unique attachments by filename
        const allAttachments = [...attachments, ...newAttachments];
        attachments = Array.from(new Map(allAttachments.map(a => [a.filename, a])).values());
      }

      const finalListId = listId === '' ? null : listId;

      if (finalListId) {
        const listExists = db.prepare("SELECT 1 FROM contact_lists WHERE id = ? AND user_id = ?").get(finalListId, req.user.id);
        if (!listExists) return res.status(400).json({ error: "Invalid contact list" });
      }

      const finalSubjects = typeof subjects === 'string' ? subjects : JSON.stringify(subjects || []);

      db.prepare("UPDATE campaigns SET name = ?, subject = ?, subjects = ?, body = ?, attachments = ?, list_id = ? WHERE id = ?")
        .run(name, subject, finalSubjects, body, JSON.stringify(attachments), finalListId, req.params.id);

      if (smtpIds) {
        const ids = typeof smtpIds === 'string' ? JSON.parse(smtpIds) : smtpIds;
        if (Array.isArray(ids)) {
          db.prepare("DELETE FROM campaign_smtp_map WHERE campaign_id = ?").run(req.params.id);
          const insertMap = db.prepare("INSERT INTO campaign_smtp_map (campaign_id, smtp_id) VALUES (?, ?)");
          ids.forEach(id => insertMap.run(req.params.id, id));
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Update campaign error:", error);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", authenticateToken, (req: any, res) => {
    console.log(`Attempting to delete campaign ${req.params.id} for user ${req.user.id}`);
    const campaign = db.prepare("SELECT id FROM campaigns WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!campaign) {
      console.log(`Campaign ${req.params.id} not found or not owned by user ${req.user.id}`);
      return res.status(404).json({ error: "Campaign not found" });
    }

    try {
      db.transaction(() => {
        db.prepare("DELETE FROM drip_sequences WHERE campaign_id = ?").run(req.params.id);
        db.prepare("DELETE FROM tracking_events WHERE campaign_id = ?").run(req.params.id);
        db.prepare("DELETE FROM notifications WHERE campaign_id = ?").run(req.params.id);
        db.prepare("DELETE FROM campaign_logs WHERE campaign_id = ?").run(req.params.id);
        db.prepare("DELETE FROM campaign_smtp_map WHERE campaign_id = ?").run(req.params.id);
        db.prepare("DELETE FROM campaigns WHERE id = ?").run(req.params.id);
      })();
      console.log(`Successfully deleted campaign ${req.params.id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`Error deleting campaign ${req.params.id}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/campaigns/:id/clone", authenticateToken, (req: any, res) => {
    const campaign: any = db.prepare("SELECT * FROM campaigns WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const result = db.prepare("INSERT INTO campaigns (user_id, name, subject, subjects, body, attachments, list_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(req.user.id, `${campaign.name} (Clone)`, campaign.subject, campaign.subjects, campaign.body, campaign.attachments, campaign.list_id);
    
    const newId = result.lastInsertRowid;

    // Clone SMTP mapping
    const smtps = db.prepare("SELECT smtp_id FROM campaign_smtp_map WHERE campaign_id = ?").all(req.params.id) as any[];
    for (const s of smtps) {
      db.prepare("INSERT INTO campaign_smtp_map (campaign_id, smtp_id) VALUES (?, ?)").run(newId, s.smtp_id);
    }
    
    res.json({ id: newId });
  });

  app.post("/api/campaigns/:id/resend", authenticateToken, (req: any, res) => {
    const campaign: any = db.prepare("SELECT * FROM campaigns WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // Create a new list for not-replied
    const listName = `Resend (Not Replied): ${campaign.name} - ${new Date().toLocaleDateString()}`;
    const listResult = db.prepare('INSERT INTO contact_lists (name, user_id) VALUES (?, ?)').run(listName, req.user.id);
    const newListId = listResult.lastInsertRowid;

    // Insert contacts who haven't replied
    db.prepare(`
      INSERT INTO contacts (email, name, list_id)
      SELECT ct.email, ct.name, ?
      FROM campaign_logs l
      JOIN contacts ct ON l.contact_id = ct.id
      WHERE l.campaign_id = ? AND l.replied_at IS NULL
    `).run(newListId, req.params.id);

    // Clone the campaign with the new list
    const result = db.prepare("INSERT INTO campaigns (user_id, name, subject, subjects, body, attachments, list_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(req.user.id, `${campaign.name} (Resend)`, campaign.subject, campaign.subjects, campaign.body, campaign.attachments, newListId, 'sending');
    
    const newId = result.lastInsertRowid;

    // Clone SMTP mapping
    const smtps = db.prepare("SELECT smtp_id FROM campaign_smtp_map WHERE campaign_id = ?").all(req.params.id) as any[];
    for (const s of smtps) {
      db.prepare("INSERT INTO campaign_smtp_map (campaign_id, smtp_id) VALUES (?, ?)").run(newId, s.smtp_id);
    }
    
    res.json({ id: newId });
  });

  // --- Template Routes ---
  app.get("/api/templates", authenticateToken, (req: any, res) => {
    const templates = db.prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json(templates);
  });

  app.post("/api/templates", authenticateToken, (req: any, res) => {
    const { name, subject, body } = req.body;
    if (!name || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const result = db.prepare("INSERT INTO templates (user_id, name, subject, body) VALUES (?, ?, ?, ?)")
      .run(req.user.id, name, subject, body);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/templates/:id", authenticateToken, (req: any, res) => {
    db.prepare("DELETE FROM templates WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.get("/api/lists/:id/contacts", authenticateToken, (req: any, res) => {
    const contacts = db.prepare("SELECT * FROM contacts WHERE list_id = ? LIMIT 100").all(req.params.id);
    res.json(contacts);
  });

  app.post("/api/campaigns/test-send", authenticateToken, upload.array("attachments"), (req: any, res) => {
    const { subject, body, smtpId, toEmail, existingAttachments } = req.body;
    const smtp = db.prepare("SELECT * FROM smtp_accounts WHERE id = ? AND user_id = ?").get(smtpId, req.user.id) as any;
    
    if (!smtp) return res.status(404).json({ error: "SMTP account not found" });

    let finalBody = body;
    const clientExisting = existingAttachments ? (typeof existingAttachments === 'string' ? JSON.parse(existingAttachments) : existingAttachments) : [];
    const newAttachments = req.files ? (req.files as any[]).map((f: any) => ({ filename: f.originalname, path: f.path })) : [];
    const attachments = [...clientExisting, ...newAttachments];

    const isSmtpSSL = smtp.port === 465;
    const isOffice365 = smtp.host.toLowerCase().includes('office365') || smtp.host.toLowerCase().includes('outlook.com');

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: isSmtpSSL,
      auth: { user: smtp.user, pass: smtp.pass, method: 'LOGIN' },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      tls: {
        rejectUnauthorized: false,
        servername: smtp.host,
        minVersion: 'TLSv1.2'
      },
      requireTLS: smtp.port === 587 || isOffice365,
      connectionTimeout: 20000,
      greetingTimeout: 20000
    });

    transporter.sendMail({
      from: `"${smtp.from_name || 'ApexReach'}" <${smtp.from_email}>`,
      to: toEmail,
      subject: `[TEST] ${subject}`,
      html: finalBody,
      attachments: attachments.map((a: any) => ({ filename: a.filename, path: a.path }))
    }).then(() => {
      res.json({ success: true });
    }).catch((err) => {
      // Return raw error message for diagnosis
      res.status(500).json({ error: err.message });
    });
  });

  app.post("/api/campaigns/:id/follow-up-list", authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const campaignId = req.params.id;
    const { category } = req.body; // 'follow-up' or 'not-opened'

    try {
      const campaign = db.prepare('SELECT name FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, userId) as any;
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const listName = `Follow-up: ${campaign.name} (${category}) - ${new Date().toLocaleDateString()}`;
      
      const result = db.prepare('INSERT INTO contact_lists (name, user_id) VALUES (?, ?)').run(listName, userId);
      const newListId = result.lastInsertRowid;

      let query = '';
      if (category === 'follow-up') {
        query = `
          INSERT INTO contacts (email, name, list_id)
          SELECT ct.email, ct.name, ?
          FROM campaign_logs l
          JOIN contacts ct ON l.contact_id = ct.id
          WHERE l.campaign_id = ? AND (l.opened_at IS NOT NULL OR l.replied_at IS NOT NULL) AND l.replied_at IS NULL
        `;
      } else {
        query = `
          INSERT INTO contacts (email, name, list_id)
          SELECT ct.email, ct.name, ?
          FROM campaign_logs l
          JOIN contacts ct ON l.contact_id = ct.id
          WHERE l.campaign_id = ? AND l.opened_at IS NULL AND l.replied_at IS NULL
        `;
      }

      db.prepare(query).run(newListId, campaignId);
      
      res.json({ listId: newListId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create follow-up list' });
    }
  });

  app.get("/api/campaigns/:id/analytics", authenticateToken, (req: any, res) => {
    const campaign = db.prepare("SELECT list_id FROM campaigns WHERE id = ?").get(req.params.id) as any;
    const totalContacts = campaign?.list_id 
      ? (db.prepare("SELECT COUNT(*) as count FROM contacts WHERE list_id = ? AND status = 'active'").get(campaign.list_id) as any).count 
      : 0;

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN (opened_at IS NOT NULL OR replied_at IS NOT NULL) THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN (opened_at IS NOT NULL OR replied_at IS NOT NULL) AND replied_at IS NULL THEN 1 ELSE 0 END) as openedNotReplied,
        SUM(CASE WHEN opened_at IS NULL AND replied_at IS NULL THEN 1 ELSE 0 END) as notOpenedNotReplied,
        SUM(CASE WHEN replied_at IS NULL AND sent_at <= datetime('now', '-1 day') AND sent_at > datetime('now', '-3 days') THEN 1 ELSE 0 END) as followUp1d,
        SUM(CASE WHEN replied_at IS NULL AND sent_at <= datetime('now', '-3 days') AND sent_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as followUp3d,
        SUM(CASE WHEN replied_at IS NULL AND sent_at <= datetime('now', '-7 days') THEN 1 ELSE 0 END) as followUp7d
      FROM campaign_logs
      WHERE campaign_id = ?
    `).get(req.params.id) as any;

    const logs = db.prepare(`
      SELECT 
        ct.id as contactId,
        ct.email,
        ct.name,
        l.status,
        l.sent_at,
        l.opened_at,
        l.clicked_at,
        l.replied_at,
        l.ip,
        l.user_agent
      FROM campaign_logs l
      JOIN contacts ct ON l.contact_id = ct.id
      WHERE l.campaign_id = ?
      ORDER BY l.sent_at DESC
    `).all(req.params.id) as any[];

    res.json({
      ...stats,
      totalContacts,
      recentLogs: logs
    });
  });

  app.get("/api/notifications/follow-ups", authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    
    const followUps = db.prepare(`
      SELECT 
        c.id as campaignId,
        c.name as campaignName,
        SUM(CASE WHEN (l.opened_at IS NOT NULL OR l.replied_at IS NOT NULL) AND l.replied_at IS NULL AND l.sent_at <= datetime('now', '-1 day') AND l.sent_at > datetime('now', '-3 days') THEN 1 ELSE 0 END) as count1d,
        SUM(CASE WHEN (l.opened_at IS NOT NULL OR l.replied_at IS NOT NULL) AND l.replied_at IS NULL AND l.sent_at <= datetime('now', '-3 days') AND l.sent_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as count3d,
        SUM(CASE WHEN (l.opened_at IS NOT NULL OR l.replied_at IS NOT NULL) AND l.replied_at IS NULL AND l.sent_at <= datetime('now', '-7 days') THEN 1 ELSE 0 END) as count7d
      FROM campaign_logs l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      HAVING count1d > 0 OR count3d > 0 OR count7d > 0
    `).all(userId) as any[];

    res.json(followUps);
  });

  app.get("/api/dashboard/stats", authenticateToken, (req: any, res: Response) => {
    const userId = req.user.id;
    
    const globalStats = db.prepare(`
      SELECT 
        COUNT(*) as totalSent,
        SUM(CASE WHEN l.status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN (l.opened_at IS NOT NULL OR l.replied_at IS NOT NULL) THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN l.replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied
      FROM campaign_logs l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.user_id = ?
    `).get(userId) as any;

    const counts = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM campaigns WHERE user_id = ?) as activeCampaigns,
        (SELECT COUNT(*) FROM smtp_accounts WHERE user_id = ?) as activeSmtp,
        (SELECT COUNT(*) FROM contacts c JOIN contact_lists l ON c.list_id = l.id WHERE l.user_id = ?) as totalContacts
    `).get(userId, userId, userId) as any;

    const recentActivity = db.prepare(`
      SELECT * FROM (
        SELECT 
          t.event_type as type,
          t.created_at as timestamp,
          c.name as campaignName,
          ct.name as contactName,
          ct.email as contactEmail,
          t.city,
          t.country
        FROM tracking_events t
        JOIN campaigns c ON t.campaign_id = c.id
        JOIN contacts ct ON t.contact_id = ct.id
        WHERE c.user_id = ?
        
        UNION ALL
        
        SELECT 
          'reply' as type,
          l.replied_at as timestamp,
          c.name as campaignName,
          ct.name as contactName,
          ct.email as contactEmail,
          'Unknown' as city,
          'Unknown' as country
        FROM campaign_logs l
        JOIN campaigns c ON l.campaign_id = c.id
        JOIN contacts ct ON l.contact_id = ct.id
        WHERE c.user_id = ? AND l.replied_at IS NOT NULL
      ) 
      ORDER BY timestamp DESC
      LIMIT 10
    `).all(userId, userId);

    res.json({
      totalSent: globalStats.totalSent || 0,
      sent: globalStats.sent || 0,
      failed: globalStats.failed || 0,
      opened: globalStats.opened || 0,
      replied: globalStats.replied || 0,
      activeCampaigns: counts.activeCampaigns || 0,
      activeSmtp: counts.activeSmtp || 0,
      totalContacts: counts.totalContacts || 0,
      recentActivity
    });
  });

  app.get("/api/dashboard/follow-ups", authenticateToken, (req: any, res: Response) => {
    const userId = req.user.id;
    
    // Opened but not replied
    const followUps = db.prepare(`
      SELECT 
        l.id as logId,
        c.name as campaignName,
        ct.name as contactName,
        ct.email as contactEmail,
        l.opened_at as openedAt,
        l.sent_at as sentAt
      FROM campaign_logs l
      JOIN campaigns c ON l.campaign_id = c.id
      JOIN contacts ct ON l.contact_id = ct.id
      WHERE c.user_id = ? 
      AND l.opened_at IS NOT NULL 
      AND l.replied_at IS NULL
      ORDER BY l.opened_at DESC
      LIMIT 10
    `).all(userId);

    res.json(followUps);
  });

  app.post("/api/quick-send", authenticateToken, async (req: any, res: Response) => {
    const { to, subject, body, smtpId } = req.body;
    const smtp = db.prepare("SELECT * FROM smtp_accounts WHERE id = ? AND user_id = ?").get(smtpId, req.user.id) as any;
    
    if (!smtp) return res.status(404).json({ error: "SMTP account not found" });

    const isSmtpSSL = smtp.port === 465;
    const isOffice365 = smtp.host.toLowerCase().includes('office365') || smtp.host.toLowerCase().includes('outlook.com');

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: isSmtpSSL,
      auth: { user: smtp.user, pass: smtp.pass, method: 'LOGIN' },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      tls: {
        rejectUnauthorized: false,
        servername: smtp.host,
        minVersion: 'TLSv1.2'
      },
      requireTLS: smtp.port === 587 || isOffice365,
      connectionTimeout: 20000,
      greetingTimeout: 20000
    });

    try {
      await transporter.sendMail({
        from: `"${smtp.from_name || 'ApexReach'}" <${smtp.from_email}>`,
        to,
        subject,
        html: body,
      });
      res.json({ success: true });
    } catch (err: any) {
      // Return raw error message for diagnosis
      res.status(500).json({ error: err.message });
    }
  });

  // --- Campaign Processing ---
  const transporterCache = new Map<number, any>();

  const processCampaigns = async () => {
    const activeCampaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'sending'").all();
    
    const campaignPromises = (activeCampaigns as any[]).map(async (campaign) => {
      const smtps = db.prepare(`
        SELECT s.* FROM smtp_accounts s
        JOIN campaign_smtp_map m ON s.id = m.smtp_id
        WHERE m.campaign_id = ?
      `).all(campaign.id) as any[];

      if (smtps.length === 0) {
        console.warn(`Campaign ${campaign.id} has no SMTP accounts mapped. Pausing.`);
        db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?").run(campaign.id);
        return;
      }

      const appUrl = detectedAppUrl || process.env.APP_URL || 'http://localhost:3000';
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // 1. Process Main Campaign (Step 0)
      const contacts = db.prepare(`
        SELECT c.* FROM contacts c
        WHERE c.list_id = ?
        AND c.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM campaign_logs WHERE campaign_id = ? AND contact_id = c.id AND step_number = 0)
        LIMIT 50
      `).all(campaign.list_id, campaign.id) as any[];

      for (const contact of contacts) {
        await sendCampaignEmail(campaign, contact, smtps, 0, appUrl);
        const delay = (campaign.delay_seconds || 5) * 1000;
        await sleep(delay);
      }

      // 2. Process Drip Sequences (Step 1+)
      const drips = db.prepare("SELECT * FROM drip_sequences WHERE campaign_id = ? ORDER BY step_number ASC").all(campaign.id) as any[];
      
      for (const drip of drips) {
        const dripContacts = db.prepare(`
          SELECT c.*, l.sent_at as last_sent
          FROM contacts c
          JOIN campaign_logs l ON c.id = l.contact_id
          WHERE l.campaign_id = ? 
          AND l.step_number = ? 
          AND l.replied_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM campaign_logs WHERE campaign_id = ? AND contact_id = c.id AND step_number = ?)
          AND datetime(l.sent_at, '+' || ? || ' hours') <= datetime('now')
          LIMIT 50
        `).all(campaign.id, drip.step_number - 1, campaign.id, drip.step_number, drip.delay_hours) as any[];

        for (const contact of dripContacts) {
          await sendCampaignEmail(campaign, contact, smtps, drip.step_number, appUrl, drip);
          const delay = (campaign.delay_seconds || 5) * 1000;
          await sleep(delay);
        }
      }

      // Check if campaign is completed (no more main contacts and no more pending drips)
      // For simplicity, we'll just check main contacts for now
      const remainingMain = db.prepare(`
        SELECT 1 FROM contacts c
        WHERE c.list_id = ? AND c.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM campaign_logs WHERE campaign_id = ? AND contact_id = c.id AND step_number = 0)
        LIMIT 1
      `).get(campaign.list_id, campaign.id);

      if (!remainingMain) {
        // If no more main contacts, we check if any drips are still pending
        // This is more complex, so we'll just log for now
        console.log(`Campaign ${campaign.id} main contacts finished.`);
      }
    });

    await Promise.all(campaignPromises);
  };

  const sendCampaignEmail = async (campaign: any, contact: any, smtps: any[], stepNumber: number, appUrl: string, drip?: any) => {
    // SMTP Rotation
    const campaignData: any = db.prepare("SELECT last_smtp_index FROM campaigns WHERE id = ?").get(campaign.id);
    const currentIndex = campaignData?.last_smtp_index || 0;
    const smtp = smtps[currentIndex % smtps.length];
    db.prepare("UPDATE campaigns SET last_smtp_index = ? WHERE id = ?").run(currentIndex + 1, campaign.id);

    const personalize = (text: string) => {
      return text
        .replace(/{{name}}/g, contact.name || "")
        .replace(/{name}/g, contact.name || "")
        .replace(/{{email}}/g, contact.email)
        .replace(/{email}/g, contact.email);
    };

    let subject = drip ? drip.subject : campaign.subject;
    let body = drip ? drip.body : campaign.body;

    // A/B Testing for main campaign
    if (!drip && campaign.subjects) {
      try {
        const variations = JSON.parse(campaign.subjects);
        if (Array.isArray(variations) && variations.length > 0) {
          subject = variations[Math.floor(Math.random() * variations.length)];
        }
      } catch (e) {}
    }

    const selectedSubject = personalize(subject);
    let personalizedBody = personalize(body);

    // Link Proxying
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
    personalizedBody = personalizedBody.replace(linkRegex, (match, url) => {
      if (url.startsWith('mailto:') || url.startsWith('#') || url.includes('/api/track/')) return match;
      const trackingUrl = `${appUrl}/api/track/click?c=${campaign.id}&ct=${contact.id}&url=${encodeURIComponent(url)}`;
      return match.replace(url, trackingUrl);
    });

    // Tracking Pixel
    const trackingPixel = `<img src="${appUrl}/api/track/open?c=${campaign.id}&ct=${contact.id}" width="1" height="1" style="display:none" />`;
    const emailHtml = personalizedBody + trackingPixel;

    let transporter = transporterCache.get(smtp.id);
    if (!transporter) {
      const isOffice365 = smtp.host.toLowerCase().includes('office365') || smtp.host.toLowerCase().includes('outlook.com');
      transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        tls: { 
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          servername: smtp.host
        },
        requireTLS: smtp.port === 587 || isOffice365,
        connectionTimeout: 30000,
        greetingTimeout: 30000
      });
      transporterCache.set(smtp.id, transporter);
    }

    try {
      const attachments = campaign.attachments ? JSON.parse(campaign.attachments) : [];
      const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@${smtp.host}>`;

      await transporter.sendMail({
        from: `"${smtp.from_name || 'ApexReach'}" <${smtp.from_email}>`,
        to: contact.email,
        subject: selectedSubject,
        html: emailHtml,
        attachments: attachments.map((a: any) => ({ filename: a.filename, path: a.path })),
        messageId: messageId
      });

      db.prepare(`
        INSERT INTO campaign_logs (campaign_id, contact_id, smtp_id, status, message_id, step_number) 
        VALUES (?, ?, ?, 'sent', ?, ?)
      `).run(campaign.id, contact.id, smtp.id, messageId, stepNumber);
      
      if (stepNumber === 0) {
        db.prepare("UPDATE campaigns SET processedCount = processedCount + 1 WHERE id = ?").run(campaign.id);
      }
    } catch (error: any) {
      console.error(`[CAMPAIGN] Failed to send to ${contact.email} (Step ${stepNumber}):`, error.message);
      db.prepare(`
        INSERT INTO campaign_logs (campaign_id, contact_id, smtp_id, status, error, step_number) 
        VALUES (?, ?, ?, 'failed', ?, ?)
      `).run(campaign.id, contact.id, smtp.id, error.message, stepNumber);
      
      if (error.message.includes('535') || error.message.includes('Authentication failed')) {
        db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?").run(campaign.id);
      }
    }
  };

  let isProcessing = false;
  const runProcessor = async () => {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await processCampaigns();
    } catch (err) {
      console.error("Campaign processor error:", err);
    } finally {
      isProcessing = false;
      setTimeout(runProcessor, 10000); // Check every 10 seconds
    }
  };
  runProcessor();

  app.post("/api/campaigns/:id/start", authenticateToken, (req: any, res) => {
    const campaign = db.prepare("SELECT list_id FROM campaigns WHERE id = ?").get(req.params.id) as any;
    if (campaign && campaign.list_id) {
      const total = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE list_id = ? AND status = 'active'").get(campaign.list_id) as any;
      db.prepare("UPDATE campaigns SET status = 'sending', totalContacts = ? WHERE id = ? AND user_id = ?")
        .run(total.count, req.params.id, req.user.id);
    } else {
      db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ? AND user_id = ?")
        .run(req.params.id, req.user.id);
    }
    res.json({ success: true });
  });

  // Webhooks for Bounces and Unsubscribes
  app.post("/api/webhooks/bounce", (req, res) => {
    const { email, type } = req.body; // type: hard, soft
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Update contact status to bounced
    db.prepare("UPDATE contacts SET status = 'bounced' WHERE email = ?").run(email);
    
    // Log the bounce in campaign_logs if possible
    db.prepare(`
      UPDATE campaign_logs 
      SET status = 'failed', error = ? 
      WHERE contact_id IN (SELECT id FROM contacts WHERE email = ?)
      AND status = 'sent'
    `).run(`Bounced: ${type || 'unknown'}`, email);

    res.json({ success: true });
  });

  // --- IMAP Reply Tracking ---
  const checkReplies = async () => {
    console.log("[IMAP] Starting reply check cycle...");
    try {
      const smtps = db.prepare("SELECT * FROM smtp_accounts WHERE imap_host IS NOT NULL").all() as any[];
      
      if (smtps.length === 0) {
        console.log("[IMAP] No SMTP accounts with IMAP configured.");
        return;
      }

      for (const smtp of smtps) {
        console.log(`[IMAP] Checking ${smtp.user} on ${smtp.imap_host}...`);
        
        const isDefaultSecure = (smtp.imap_port === 993 || (!smtp.imap_port && smtp.imap_host.includes('office365')));
        const client = new ImapFlow({
          host: smtp.imap_host,
          port: smtp.imap_port || 993,
          secure: (smtp.imap_secure === 1) || isDefaultSecure,
          auth: { user: smtp.user, pass: smtp.pass },
          logger: false,
          tls: {
            rejectUnauthorized: false,
            servername: smtp.imap_host,
            minVersion: 'TLSv1.2'
          },
          disableCompression: true,
          clientInfo: { name: 'ApexReach', version: '1.0.0' },
          connectionTimeout: 30000,
          greetingTimeout: 30000
        });

        // Handle unhandled errors emitted by the instance
        client.on('error', (err) => {
          console.error(`[IMAP RUNTIME ERROR] ${smtp.user} (${smtp.imap_host}):`, err.message || err);
        });

        try {
          await client.connect();
          
          let lock = await client.getMailboxLock('INBOX');
          try {
            // Search for unseen messages from last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const seqs = await client.search({ seen: false, since: sevenDaysAgo });
            console.log(`[IMAP] Found ${seqs ? seqs.length : 0} unseen messages for ${smtp.user}`);

            if (seqs && seqs.length > 0) {
              for await (let message of client.fetch(seqs, { envelope: true })) {
                if (!message.envelope || !message.envelope.from || !message.envelope.from[0]) continue;
                
                const fromEmail = message.envelope.from[0].address;
                const subject = message.envelope.subject || "";
                const inReplyTo = message.envelope.inReplyTo;
                const messageId = message.envelope.messageId;

                console.log(`[IMAP] Processing email: From=${fromEmail}, Subject="${subject}", In-Reply-To=${inReplyTo}`);

                let log: any = null;

                // 1. Match by In-Reply-To
                if (inReplyTo) {
                  const cleanInReplyTo = inReplyTo.replace(/[<>]/g, '');
                  log = db.prepare(`
                    SELECT l.*, c.name as campaign_name, ct.name as contact_name, ct.email as contact_email, c.user_id
                    FROM campaign_logs l
                    JOIN campaigns c ON l.campaign_id = c.id
                    JOIN contacts ct ON l.contact_id = ct.id
                    WHERE (l.message_id = ? OR l.message_id = ? OR l.message_id LIKE ?) AND l.replied_at IS NULL
                  `).get(inReplyTo, `<${cleanInReplyTo}>`, `%${cleanInReplyTo}%`);
                }

                // 2. Match by email + cleaned subject
                if (!log) {
                  const cleanSubject = subject.replace(/^(re|aw|fwd|fw):\s*/i, '').trim();
                  log = db.prepare(`
                    SELECT l.*, c.name as campaign_name, ct.name as contact_name, ct.email as contact_email, c.user_id
                    FROM campaign_logs l
                    JOIN campaigns c ON l.campaign_id = c.id
                    JOIN contacts ct ON l.contact_id = ct.id
                    WHERE ct.email = ? AND l.replied_at IS NULL
                    ORDER BY l.sent_at DESC LIMIT 1
                  `).get(fromEmail);
                }

                if (log) {
                  console.log(`[IMAP] Match found for campaign ${log.campaign_id}`);
                  
                  // Update log
                  db.prepare("UPDATE campaign_logs SET replied_at = CURRENT_TIMESTAMP WHERE id = ?").run(log.id);
                  
                  // Increment repliedCount
                  db.prepare("UPDATE campaigns SET repliedCount = repliedCount + 1 WHERE id = ?").run(log.campaign_id);
                  
                  // Emit socket event
                  io.to(`user_${log.user_id}`).emit('reply', {
                    campaignId: log.campaign_id,
                    campaignName: log.campaign_name,
                    contactName: log.contact_name,
                    contactEmail: log.contact_email,
                    subject: subject,
                    from: fromEmail,
                    timestamp: new Date().toISOString()
                  });
                  
                  // Create notification
                  createNotification(
                    log.user_id,
                    'reply',
                    'New Reply',
                    `New reply from ${log.contact_name || log.contact_email} for campaign "${log.campaign_name}"`,
                    log.campaign_id
                  );
                }
              }
            }
          } finally {
            lock.release();
          }
          
          await client.logout();
        } catch (err: any) {
          console.error(`[IMAP] Error for ${smtp.user}:`, err.message);
        }
      }
    } catch (e: any) {
      console.error("[IMAP] Global checkReplies error:", e.message);
    }
  };

  let isCheckingReplies = false;
  const runReplyChecker = async () => {
    if (isCheckingReplies) return;
    isCheckingReplies = true;
    try {
      await checkReplies();
    } catch (err) {
      console.error("Reply checker error:", err);
    } finally {
      isCheckingReplies = false;
      setTimeout(runReplyChecker, 300000); // Check every 5 minutes
    }
  };
  // runReplyChecker(); // Disabled as per user request to focus on SMTP only for now

  app.post("/api/campaigns/:id/mark-replied", authenticateToken, (req: any, res) => {
    const { contactId, email } = req.body;
    const campaignId = req.params.id;

    try {
      if (contactId) {
        db.prepare(`
          UPDATE campaign_logs 
          SET replied_at = CURRENT_TIMESTAMP 
          WHERE campaign_id = ? AND contact_id = ? AND replied_at IS NULL
        `).run(campaignId, contactId);
      } else if (email) {
        db.prepare(`
          UPDATE campaign_logs 
          SET replied_at = CURRENT_TIMESTAMP 
          WHERE campaign_id = ? 
          AND contact_id IN (SELECT id FROM contacts WHERE email = ?)
          AND replied_at IS NULL
        `).run(campaignId, email);
      }

      // Update campaign stats
      const result = db.prepare("SELECT COUNT(*) as count FROM campaign_logs WHERE campaign_id = ? AND replied_at IS NOT NULL").get(campaignId) as any;
      db.prepare("UPDATE campaigns SET repliedCount = ? WHERE id = ?").run(result.count, campaignId);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/campaigns/:id/bulk-mark-replied", authenticateToken, (req: any, res) => {
    const { emails } = req.body; // Array of emails
    const campaignId = req.params.id;

    if (!Array.isArray(emails)) return res.status(400).json({ error: "Emails must be an array" });

    try {
      const stmt = db.prepare(`
        UPDATE campaign_logs 
        SET replied_at = CURRENT_TIMESTAMP 
        WHERE campaign_id = ? 
        AND contact_id IN (SELECT id FROM contacts WHERE email = ?)
        AND replied_at IS NULL
      `);

      const transaction = db.transaction((emailList) => {
        for (const email of emailList) {
          stmt.run(campaignId, email);
        }
      });

      transaction(emails);

      // Update campaign stats
      const result = db.prepare("SELECT COUNT(*) as count FROM campaign_logs WHERE campaign_id = ? AND replied_at IS NOT NULL").get(campaignId) as any;
      db.prepare("UPDATE campaigns SET repliedCount = ? WHERE id = ?").run(result.count, campaignId);

      res.json({ success: true, count: emails.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/debug/stats", authenticateToken, (req: any, res) => {
    try {
      const stats = {
        campaigns: db.prepare("SELECT COUNT(*) as count FROM campaigns").get(),
        contacts: db.prepare("SELECT COUNT(*) as count FROM contacts").get(),
        smtp: db.prepare("SELECT COUNT(*) as count FROM smtp_accounts").get(),
        logs: db.prepare("SELECT COUNT(*) as count FROM campaign_logs").get(),
        events: db.prepare("SELECT COUNT(*) as count FROM tracking_events").get(),
        appUrl: process.env.APP_URL || detectedAppUrl || 'Not set'
      };
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite middleware for development ---
  if (process.env.NODE_ENV !== "production") {
    console.log("[SYSTEM] Starting Vite in middleware mode...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[SYSTEM] Vite middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SYSTEM] Server running on http://localhost:${PORT}`);
    console.log(`[SYSTEM] Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

startServer();
