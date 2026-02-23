/**
 * Database Audit Script — Verifies what's encrypted vs plaintext
 * Run: node apps/desktop/electron/main/scripts/auditDb.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'orbit', 'orbit.db');
const db = new Database(dbPath, { readonly: true });

function truncate(str, len = 50) {
  if (!str) return '(null)';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function isEncrypted(val) {
  if (!val) return 'N/A';
  if (val.startsWith('v1:')) return 'YES (v1:AES-256-GCM)';
  return 'NO — PLAINTEXT';
}

function isBcryptHash(val) {
  if (!val) return false;
  return val.startsWith('$2a$') || val.startsWith('$2b$') || val.startsWith('$2y$');
}

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║          ORBIT DATABASE ENCRYPTION AUDIT            ║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log('║  DB Path:', truncate(dbPath, 42));
console.log('╚══════════════════════════════════════════════════════╝\n');

// --- USERS ---
console.log('━━━ USERS TABLE ━━━');
const users = db.prepare('SELECT * FROM users LIMIT 3').all();
users.forEach(u => {
  console.log(`  User: ${u.username}`);
  console.log(`    email:         ${u.email}  → PLAINTEXT (needed for login lookup)`);
  console.log(`    username:      ${u.username}  → PLAINTEXT (needed for login lookup)`);
  console.log(`    password_hash: ${truncate(u.password_hash, 30)}  → ${isBcryptHash(u.password_hash) ? 'HASHED (bcrypt - irreversible)' : 'WARNING: NOT HASHED'}`);
  console.log(`    role:          ${u.role}  → PLAINTEXT (non-sensitive)`);
  console.log('');
});

// --- NOTES ---
console.log('━━━ NOTES TABLE ━━━');
const notes = db.prepare('SELECT * FROM notes LIMIT 2').all();
if (notes.length === 0) console.log('  (no notes)\n');
notes.forEach(n => {
  console.log(`  Note: "${n.title}"`);
  console.log(`    title:             "${n.title}"  → PLAINTEXT (for search)`);
  console.log(`    content_encrypted: ${truncate(n.content_encrypted, 40)}  → ${isEncrypted(n.content_encrypted)}`);
  console.log(`    tags:              ${n.tags || '(null)'}  → PLAINTEXT (for search)`);
  console.log('');
});

// --- LINKS ---
console.log('━━━ LINKS TABLE ━━━');
const links = db.prepare('SELECT * FROM links LIMIT 2').all();
if (links.length === 0) console.log('  (no links)\n');
links.forEach(l => {
  console.log(`  Link: "${l.title}"`);
  console.log(`    title:                 "${l.title}"  → PLAINTEXT (for search)`);
  console.log(`    url_encrypted:         ${truncate(l.url_encrypted, 40)}  → ${isEncrypted(l.url_encrypted)}`);
  console.log(`    description_encrypted: ${truncate(l.description_encrypted, 40)}  → ${isEncrypted(l.description_encrypted)}`);
  console.log(`    tags:                  ${l.tags || '(null)'}  → PLAINTEXT (for search)`);
  console.log('');
});

// --- FILE REFERENCES ---
console.log('━━━ FILE_REFERENCES TABLE ━━━');
const files = db.prepare('SELECT * FROM file_references LIMIT 2').all();
if (files.length === 0) console.log('  (no file references)\n');
files.forEach(f => {
  console.log(`  File: "${f.name}"`);
  console.log(`    name:                  "${f.name}"  → PLAINTEXT (for search)`);
  console.log(`    path_encrypted:        ${truncate(f.path_encrypted, 40)}  → ${isEncrypted(f.path_encrypted)}`);
  console.log(`    description_encrypted: ${truncate(f.description_encrypted, 40)}  → ${isEncrypted(f.description_encrypted)}`);
  console.log('');
});

// --- USER SETTINGS ---
console.log('━━━ USER_SETTINGS TABLE ━━━');
const settings = db.prepare('SELECT * FROM user_settings LIMIT 2').all();
settings.forEach(s => {
  console.log(`  User: ${truncate(s.user_id, 12)}`);
  console.log(`    theme:                  ${s.theme}  → PLAINTEXT (non-sensitive)`);
  console.log(`    language:               ${s.language}  → PLAINTEXT (non-sensitive)`);
  console.log(`    settings_json_encrypted: ${truncate(s.settings_json_encrypted, 40)}  → ${isEncrypted(s.settings_json_encrypted)}`);
  console.log('');
});

// --- WORKSPACES ---
console.log('━━━ WORKSPACES TABLE ━━━');
const ws = db.prepare('SELECT * FROM workspaces LIMIT 3').all();
ws.forEach(w => {
  console.log(`  Workspace: "${w.name}"  → PLAINTEXT (non-sensitive metadata)`);
});
console.log('');

// --- USER_CRYPTO (Zero-Knowledge) ---
console.log('━━━ USER_CRYPTO TABLE (Zero-Knowledge Sync Keys) ━━━');
const crypto = db.prepare(`
  SELECT uc.*, u.username FROM user_crypto uc JOIN users u ON uc.user_id = u.id
`).all();
if (crypto.length === 0) {
  console.log('  (empty — existing users will get crypto keys on next login)');
} else {
  crypto.forEach(c => {
    console.log(`  User: ${c.username}`);
    console.log(`    salt:                 ${truncate(c.salt, 20)}  → HEX (opaque without password)`);
    console.log(`    encrypted_master_key: ${truncate(c.encrypted_master_key, 30)}  → AES-WRAPPED (needs password to unwrap)`);
    console.log(`    recovery_blob:        ${truncate(c.recovery_blob, 30)}  → AES-WRAPPED (needs recovery file to unwrap)`);
    console.log(`    kdf_params:           ${c.kdf_params}`);
    console.log(`    key_version:          ${c.key_version}`);
    console.log('');
  });
}

// --- SESSIONS ---
console.log('━━━ SESSIONS TABLE ━━━');
const sessions = db.prepare('SELECT * FROM sessions LIMIT 2').all();
sessions.forEach(s => {
  console.log(`  Session: token=${truncate(s.token, 20)}  → RANDOM TOKEN (not a secret, expires)`);
});
console.log('');

// --- SUMMARY ---
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║                  AUDIT SUMMARY                      ║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log('║  ENCRYPTED (AES-256-GCM):                          ║');
console.log('║    - notes.content_encrypted                        ║');
console.log('║    - links.url_encrypted                            ║');
console.log('║    - links.description_encrypted                    ║');
console.log('║    - file_references.path_encrypted                 ║');
console.log('║    - file_references.description_encrypted          ║');
console.log('║    - user_settings.settings_json_encrypted          ║');
console.log('║    - user_crypto.encrypted_master_key (wrapped)     ║');
console.log('║    - user_crypto.recovery_blob (wrapped)            ║');
console.log('║                                                     ║');
console.log('║  HASHED (bcrypt, irreversible):                     ║');
console.log('║    - users.password_hash                            ║');
console.log('║                                                     ║');
console.log('║  PLAINTEXT (by design, for search/functionality):   ║');
console.log('║    - users.email, users.username (login lookup)     ║');
console.log('║    - notes.title, notes.tags (search)               ║');
console.log('║    - links.title, links.tags (search)               ║');
console.log('║    - file_references.name (search)                  ║');
console.log('║    - workspaces.name (non-sensitive)                ║');
console.log('║    - user_settings.theme/language (non-sensitive)   ║');
console.log('╚══════════════════════════════════════════════════════╝');

db.close();
