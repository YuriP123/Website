const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      // Strip quotes if present
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value; // command-line env wins
    }
  });
}

const os = require('os');

// Helper to expand tilde and unescape spaces
function resolvePath(p) {
  if (!p) return p;
  // Unescape backslashes used for spaces (shell style)
  let expanded = p.replace(/\\ /g, ' ');
  // Expand tilde
  if (expanded.startsWith('~/')) {
    expanded = path.join(os.homedir(), expanded.slice(2));
  }
  return path.resolve(expanded);
}

const rawPath = process.env.ORG_ROAM_PATH;
const ORG_ROAM_PATH = resolvePath(rawPath);
// Org files go to content/notes for SSG
const TARGET_DIR = path.join(process.cwd(), 'content/notes');
// Media files go to public/notes-media for serving
const MEDIA_DIR = path.join(process.cwd(), 'public/notes-media');

if (!ORG_ROAM_PATH) {
  console.error('❌ Error: ORG_ROAM_PATH is not defined in .env.local');
  console.log('Please create .env.local with ORG_ROAM_PATH="/path/to/your/org/files"');
  process.exit(1);
}

if (!fs.existsSync(ORG_ROAM_PATH)) {
  console.error(`❌ Error: Source path does not exist: ${ORG_ROAM_PATH}`);
  process.exit(1);
}

console.log(`🚀 Syncing notes from ${ORG_ROAM_PATH}...`);
console.log(`   - Org files -> ${TARGET_DIR}`);
console.log(`   - Media files -> ${MEDIA_DIR}`);

// Ensure target directories exist
if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true });
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Helper to clean directories
function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

// A note is published only if its #+filetags include :public: (and not :private:)
function isPublic(content) {
  const m = content.match(/^#\+filetags:\s*(.*)$/im);
  const tags = m ? m[1].split(':').map(t => t.trim().toLowerCase()) : [];
  return tags.includes('public') && !tags.includes('private');
}

// Copy a file and keep its modification time (used for "last tended")
function copyKeepingTime(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  const { atime, mtime } = fs.statSync(src);
  fs.utimesSync(dest, atime, mtime);
}

function findOrgFiles(dir, list = []) {
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith('.')) continue; // .git, .obsidian, etc.
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) findOrgFiles(full, list);
    else if (file.endsWith('.org')) list.push(full);
  }
  return list;
}

// Folder that "~/org/..." links refer to (your org directory, parent of roam/ by default)
const ORG_DIR = resolvePath(process.env.ORG_DIR) || path.dirname(ORG_ROAM_PATH);

// org-attach folders (e.g. org/school/.attach); attachments live in <dir>/<id[0:2]>/<id[2:]>/
function findAttachDirs(dir, depth = 0, list = []) {
  if (depth > 3) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === '.attach' || entry.name === 'data') list.push(full);
    else if (!entry.name.startsWith('.')) findAttachDirs(full, depth + 1, list);
  }
  return list;
}
const ATTACH_DIRS = findAttachDirs(ORG_DIR);

// [[file:x.png]], [[attachment:x.png]], [[./x.png]] (optionally followed by ][description]])
const IMAGE_LINK = /\[\[(file:|attachment:)?([^\]\[]+?\.(?:png|jpe?g|gif|svg|webp))\]/gi;

function resolveImage(kind, target, noteFile, noteId) {
  if (/^https?:/.test(target)) return null;
  if (kind === 'attachment:') {
    if (!noteId) return null;
    for (const dir of ATTACH_DIRS) {
      const candidate = path.join(dir, noteId.slice(0, 2), noteId.slice(2), target);
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }
  let p = target;
  if (p.startsWith('~/org/')) p = path.join(ORG_DIR, p.slice(6));
  else if (p.startsWith('~/')) p = path.join(os.homedir(), p.slice(2));
  p = path.resolve(path.dirname(noteFile), p);
  return fs.existsSync(p) ? p : null;
}

// Path under public/notes-media/ for an image (no dot-folders, which aren't served)
function mediaPathFor(img) {
  const rel = img.startsWith(ORG_DIR + path.sep) ? path.relative(ORG_DIR, img) : path.join('external', path.basename(img));
  return rel.split(path.sep).map((seg) => seg.replace(/^\.+/, '')).join('/');
}

// Clean targets
cleanDir(TARGET_DIR);
cleanDir(MEDIA_DIR);

try {
  let published = 0, skipped = 0, media = 0;
  const images = new Map(); // media path -> source file

  for (const src of findOrgFiles(ORG_ROAM_PATH)) {
    const content = fs.readFileSync(src, 'utf8');
    if (!isPublic(content)) { skipped++; continue; }

    // Copy the images this note uses and point its links at /notes-media/
    const noteId = (content.match(/^\s*:ID:\s*(\S+)/m) || [])[1];
    const rewritten = content.replace(IMAGE_LINK, (whole, kind, target) => {
      const img = resolveImage(kind, target, src, noteId);
      if (!img) {
        console.warn(`   ⚠️  Image not found in ${path.basename(src)}: ${target}`);
        return whole;
      }
      const mediaPath = mediaPathFor(img);
      images.set(mediaPath, img);
      return `[[file:/notes-media/${mediaPath}]`;
    });

    const dest = path.join(TARGET_DIR, path.relative(ORG_ROAM_PATH, src));
    copyKeepingTime(src, dest);
    if (rewritten !== content) {
      const { atime, mtime } = fs.statSync(src);
      fs.writeFileSync(dest, rewritten);
      fs.utimesSync(dest, atime, mtime);
    }
    published++;
  }

  for (const [mediaPath, img] of images) {
    copyKeepingTime(img, path.join(MEDIA_DIR, mediaPath));
    media++;
  }

  console.log(`✅ Sync complete!`);
  console.log(`   - Published ${published} notes (${skipped} notes without :public: skipped)`);
  console.log(`   - Copied ${media} images used by published notes`);
} catch (err) {
  console.error('❌ Error during sync:', err);
  process.exit(1);
}
