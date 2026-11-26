import fs from 'fs';
import path from 'path';
import { unified } from 'unified';
import uniorgParse from 'uniorg-parse';
import uniorgRehype from 'uniorg-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';

const NOTES_DIR = path.join(process.cwd(), 'content/notes');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://carcat.org').replace(/\/$/, '');
export const RECENT_CHANGES_SLUG = 'recent-changes';
const RECENT_CHANGES_LIMIT = 100;
export const STREAM_SLUG = 'stream';
const STREAM_LIMIT = 200;
// Generated pages that have no org file behind them
const VIRTUAL_SLUGS = [RECENT_CHANGES_SLUG, STREAM_SLUG];

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

// Extract metadata from raw org content (#+KEY: VALUE lines and the :ID: property)
export function extractMetadata(content) {
  const metadata = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^#\+([a-zA-Z0-9_]+):\s*(.*)$/);
    if (match) metadata[match[1].toLowerCase()] = match[2].trim();
    const prop = line.trim().match(/^:(ID|CREATED|ROAM_REFS):\s*(.*)$/i);
    if (prop) metadata[prop[1].toLowerCase()] = prop[2].trim();
  }
  return metadata;
}

export function parseTags(filetags = '') {
  return filetags.split(':').map((t) => t.trim()).filter(Boolean);
}

// A note is published only if its #+filetags include :public: (and not :private:)
export function isPublicContent(content) {
  const tags = parseTags(extractMetadata(content).filetags).map((t) => t.toLowerCase());
  return tags.includes('public') && !tags.includes('private');
}

// "planted" date: org-roam filename timestamp, a YYYY-MM-DD filename (dailies),
// or a #+date / :CREATED: value. Returns null if none is found.
function getPlantedDate(slug, metadata) {
  const base = path.posix.basename(slug);
  let m = base.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-/);
  if (m) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  for (const value of [base, metadata.date, metadata.created]) {
    m = value && value.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3]));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Note index (published notes only; notes without :public: are never copied by
// sync, and are skipped here as a second safety net)
// ---------------------------------------------------------------------------

let notesCache = null;

function getAllOrgFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) getAllOrgFiles(filePath, fileList);
    else if (file.endsWith('.org')) fileList.push(filePath);
  }
  return fileList;
}

// Resolve a file: link target relative to the note that contains it.
function resolveFileLink(fromSlug, target) {
  const file = target.split('::')[0].replace(/^\.\//, '');
  if (!file.endsWith('.org')) return null;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromSlug), file));
  return joined.replace(/\.org$/, '');
}

function loadNotes() {
  if (notesCache) return notesCache;

  const notes = new Map(); // slug -> note
  const idMap = new Map(); // org-roam ID -> slug

  for (const filePath of getAllOrgFiles(NOTES_DIR)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!isPublicContent(raw)) continue;
    const slug = path.relative(NOTES_DIR, filePath).split(path.sep).join('/').replace(/\.org$/, '');
    const metadata = extractMetadata(raw);
    const note = {
      slug,
      raw,
      title: metadata.title || path.posix.basename(slug),
      tags: parseTags(metadata.filetags),
      planted: getPlantedDate(slug, metadata),
      tended: fs.statSync(filePath).mtime,
      // Where a reference note came from (:ROAM_REFS: or #+source:)
      author: metadata.author || null,
      source: `${metadata.roam_refs || ''} ${metadata.source || ''}`.split(/\s+/).find((s) => /^https?:\/\//.test(s)) || null,
    };
    notes.set(slug, note);
    if (metadata.id) idMap.set(metadata.id, slug);
  }

  // Backlinks: target slug -> Set of source slugs
  const backlinks = new Map();
  for (const note of notes.values()) {
    for (const m of note.raw.matchAll(/\[\[(id|file):([^\]]+)\]/g)) {
      const target = m[1] === 'id' ? idMap.get(m[2]) : resolveFileLink(note.slug, m[2]);
      if (!target || target === note.slug || !notes.has(target)) continue;
      if (!backlinks.has(target)) backlinks.set(target, new Set());
      backlinks.get(target).add(note.slug);
    }
  }

  notesCache = { notes, idMap, backlinks };
  return notesCache;
}

export const isPublished = (slug) => VIRTUAL_SLUGS.includes(slug) || loadNotes().notes.has(slug);

// Slugs to statically generate (pages + JSON for the pane stack)
export function getAllPosts() {
  return [...loadNotes().notes.keys(), ...VIRTUAL_SLUGS].map((slug) => ({ slug }));
}

// Published notes, most recently edited first
export function getRecentNotes(limit = RECENT_CHANGES_LIMIT) {
  return [...loadNotes().notes.values()]
    .sort((a, b) => b.tended - a.tended)
    .slice(0, limit);
}

// Kept for debug-links.js
export function getIdMap() {
  return Object.fromEntries(loadNotes().idMap);
}

// ---------------------------------------------------------------------------
// Rehype plugins
// ---------------------------------------------------------------------------

// Resolve id: and file: links to /wiki/<slug>. Links to private or missing
// notes are removed: list items that hold one are dropped, elsewhere the link
// text is kept without the link.
export function rehypeResolveIds({ slug: currentSlug = '' } = {}) {
  const { idMap } = loadNotes();
  const HIDDEN = Symbol('hidden-link');
  const isHiddenLink = (n) => n.type === 'element' && n.tagName === 'a' && n[HIDDEN];
  const containsHiddenLink = (n) => isHiddenLink(n) || (n.children || []).some(containsHiddenLink);

  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'a' && node.properties?.href) {
        const href = String(node.properties.href);
        let target;
        if (href.startsWith('id:')) target = idMap.get(href.slice(3)) || null;
        else if (href.startsWith('file:') && /\.org(::.*)?$/.test(href)) target = resolveFileLink(currentSlug, href.slice(5));

        if (target !== undefined) {
          if (target && isPublished(target)) node.properties.href = `/wiki/${target}`;
          else node[HIDDEN] = true;
        }
      }
      (node.children || []).forEach(visit);
    };
    visit(tree);

    const prune = (node) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === 'element' && child.tagName === 'li' && containsHiddenLink(child)) return [];
        if (isHiddenLink(child)) {
          prune(child);
          return child.children || [];
        }
        prune(child);
        const emptyList = child.type === 'element' && ['ul', 'ol'].includes(child.tagName) &&
          !child.children.some((c) => c.type === 'element');
        return emptyList ? [] : [child];
      });
    };
    prune(tree);
  };
}

// Point relative image paths at /notes-media/ (where sync-notes copies them)
function rehypeRewriteImages({ slug = '' } = {}) {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'img' && node.properties?.src) {
        const src = String(node.properties.src).replace(/^file:/, '');
        if (src.startsWith('/') || /^https?:/.test(src)) {
          node.properties.src = src;
        } else {
          node.properties.src = `/notes-media/${path.posix.normalize(path.posix.join(path.posix.dirname(slug), src))}`;
        }
      }
      (node.children || []).forEach(visit);
    };
    visit(tree);
  };
}

// Wrap each top-level heading (org "* Heading") and the content under it in a
// <section class="garden-card">. Content before the first heading gets its own card.
function rehypeCards() {
  return (tree) => {
    const sections = [];
    let current = null;
    const isBlank = (n) => n.type === 'text' && !n.value.trim();
    for (const child of tree.children) {
      if (child.type === 'element' && child.tagName === 'h1') {
        current = { type: 'element', tagName: 'section', properties: { className: ['garden-card'] }, children: [child] };
        sections.push(current);
      } else {
        if (!current) {
          if (isBlank(child)) continue;
          current = { type: 'element', tagName: 'section', properties: { className: ['garden-card'] }, children: [] };
          sections.push(current);
        }
        current.children.push(child);
      }
    }
    tree.children = sections;
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toISO = (d) => (d ? d.toISOString() : null);

async function orgToHtml(content, slug) {
  const result = await unified()
    .use(uniorgParse)
    .use(uniorgRehype)
    .use(rehypeResolveIds, { slug })
    .use(rehypeRewriteImages, { slug })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap', test: ['h2', 'h3', 'h4', 'h5', 'h6'] })
    .use(rehypeCards)
    .use(rehypeStringify)
    .process(content);
  return result.toString();
}

function renderRecentChanges() {
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const items = getRecentNotes()
    .map((n) => `<li><span class="garden-rc-date">${fmt(n.tended)}</span> <a href="/wiki/${n.slug}">${escapeHtml(n.title)}</a></li>`)
    .join('');
  return {
    slug: RECENT_CHANGES_SLUG,
    title: 'Recent changes',
    html: `<section class="garden-card"><p>The ${RECENT_CHANGES_LIMIT} most recently tended notes. Also available as an <a href="/feed.xml" target="_blank">RSS feed</a>.</p><ul>${items}</ul></section>`,
    tags: [],
    planted: null,
    tended: toISO(getRecentNotes(1)[0]?.tended),
    backlinks: [],
  };
}

// The stream: public notes grouped by the day they were planted, newest first.
// It is built from the notes themselves, so private dailies never feed into it.
const STREAM_KINDS = [['read', 'Read'], ['listen', 'Listened to'], ['watch', 'Watched'], ['main', 'Zettled']];
const dayKey = (d) => d.toISOString().slice(0, 10);

function streamKind(note) {
  const tags = note.tags.map((t) => t.toLowerCase());
  const kind = STREAM_KINDS.find(([tag]) => tags.includes(tag));
  if (kind) return kind[1];
  return note.slug.startsWith('log/') ? 'Journal' : 'Planted';
}

function renderStream() {
  const fmt = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const entries = [...loadNotes().notes.values()]
    .filter((n) => n.planted && n.slug !== 'index')
    .sort((a, b) => b.planted - a.planted || a.title.localeCompare(b.title))
    .slice(0, STREAM_LIMIT);

  const days = new Map(); // YYYY-MM-DD -> notes
  for (const n of entries) {
    const key = dayKey(n.planted);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(n);
  }

  const dayCards = [...days].map(([key, notes]) => {
    const items = notes.map((n) => {
      const source = n.source
        ? ` <a class="garden-stream-source" href="${escapeHtml(n.source)}" target="_blank" rel="noopener noreferrer" title="Original source">↗</a>`
        : '';
      const author = n.author ? ` <span class="garden-stream-author">by ${escapeHtml(n.author)}</span>` : '';
      return `<li><span class="garden-stream-kind">${streamKind(n)}</span> <a href="/wiki/${n.slug}">${escapeHtml(n.title)}</a>${author}${source}</li>`;
    }).join('');
    return `<section class="garden-card garden-stream-day" id="d-${key}"><h2>${fmt(notes[0].planted)}</h2><ul>${items}</ul></section>`;
  }).join('');

  return {
    slug: STREAM_SLUG,
    title: 'Stream',
    html: `<section class="garden-card"><p>What I've been reading, listening to, watching and writing, by the day each note was planted.</p></section>${dayCards || '<section class="garden-card"><p>Nothing here yet.</p></section>'}`,
    tags: [],
    planted: null,
    tended: toISO(entries[0]?.planted),
    backlinks: [],
  };
}

// Everything a pane needs for one note, or null if it doesn't exist / is private
export async function renderNote(slug) {
  if (slug === RECENT_CHANGES_SLUG) return renderRecentChanges();
  if (slug === STREAM_SLUG) return renderStream();
  const { notes, backlinks } = loadNotes();
  const note = notes.get(slug);
  if (!note) return null;

  // {{{garden-count}}} in a note becomes the number of published notes
  const content = note.raw.replace(/\{\{\{garden-count\}\}\}/g, String(notes.size));

  return {
    slug,
    title: note.title,
    html: await orgToHtml(content, slug),
    tags: note.tags,
    planted: toISO(note.planted),
    tended: toISO(note.tended),
    source: note.source,
    author: note.author,
    backlinks: [...(backlinks.get(slug) || [])]
      .map((s) => ({ slug: s, title: notes.get(s).title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}

export const getPostBySlug = renderNote;
