#!/usr/bin/env node

/**
 * Org-Roam Publishing Script
 * 
 * Scans org-roam directory for files with #+PUBLISH: true header,
 * parses them, and outputs JSON files to public/notes/
 * 
 * Usage: node scripts/publish-org.js
 * 
 * Environment: ORG_ROAM_PATH - path to your org-roam directory
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ORG_ROAM_PATH = process.env.ORG_ROAM_PATH || path.join(process.env.HOME, 'org-roam');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'notes');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Parse org file metadata from header
 */
function parseOrgMetadata(content) {
  const metadata = {
    title: 'Untitled',
    date: new Date().toISOString().split('T')[0],
    tags: [],
    publish: false,
    description: '',
  };

  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Stop parsing metadata at first non-header line
    if (!trimmed.startsWith('#+') && !trimmed.startsWith(':') && trimmed !== '') {
      // Check if we're in a property drawer
      if (!trimmed.startsWith(':')) break;
    }
    
    // Parse #+KEY: value format
    const headerMatch = trimmed.match(/^#\+(\w+):\s*(.*)$/i);
    if (headerMatch) {
      const [, key, value] = headerMatch;
      const keyLower = key.toLowerCase();
      
      switch (keyLower) {
        case 'title':
          metadata.title = value.trim();
          break;
        case 'date':
          // Handle org date formats like <2024-01-15> or [2024-01-15]
          const dateMatch = value.match(/[\[<]?(\d{4}-\d{2}-\d{2})[\]>]?/);
          if (dateMatch) {
            metadata.date = dateMatch[1];
          }
          break;
        case 'filetags':
        case 'tags':
          // Parse :tag1:tag2:tag3: format
          const tagMatch = value.match(/:([^:]+)/g);
          if (tagMatch) {
            metadata.tags = tagMatch.map(t => t.replace(':', '').trim()).filter(Boolean);
          }
          break;
        case 'publish':
          metadata.publish = value.trim().toLowerCase() === 'true';
          break;
        case 'description':
          metadata.description = value.trim();
          break;
      }
    }
  }
  
  return metadata;
}

/**
 * Convert org content to HTML
 * Handles basic org-mode syntax
 */
function orgToHtml(content) {
  // Remove metadata headers
  let body = content.replace(/^#\+[^\n]+\n/gm, '');
  body = body.replace(/^:PROPERTIES:[\s\S]*?:END:\n?/gm, '');
  
  // Process org syntax
  let html = body
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // Headings: * Heading -> <h1>, ** Heading -> <h2>, etc.
    .replace(/^\*\*\*\*\*\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^\*\*\*\*\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^\*\*\*\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^\*\*\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^\*\s+(.+)$/gm, '<h1>$1</h1>')
    
    // Bold: *text* -> <strong>text</strong>
    .replace(/\*([^\*\n]+)\*/g, '<strong>$1</strong>')
    
    // Italic: /text/ -> <em>text</em> (but not paths like /usr/bin)
    .replace(/(?<!\/)\/([^\/\n]+)\/(?!\/)/g, '<em>$1</em>')
    
    // Underline: _text_ -> <u>text</u>
    .replace(/_([^_\n]+)_/g, '<u>$1</u>')
    
    // Strikethrough: +text+ -> <del>text</del>
    .replace(/\+([^\+\n]+)\+/g, '<del>$1</del>')
    
    // Code: =text= or ~text~ -> <code>text</code>
    .replace(/[=~]([^=~\n]+)[=~]/g, '<code>$1</code>')
    
    // Links: [[url][description]] -> <a href="url">description</a>
    .replace(/\[\[([^\]]+)\]\[([^\]]+)\]\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
    
    // Links without description: [[url]] -> <a href="url">url</a>
    .replace(/\[\[([^\]]+)\]\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    
    // Unordered lists: - item or + item
    .replace(/^[\s]*[-+]\s+(.+)$/gm, '<li>$1</li>')
    
    // Ordered lists: 1. item or 1) item
    .replace(/^[\s]*\d+[.)]\s+(.+)$/gm, '<li>$1</li>')
    
    // Code blocks: #+BEGIN_SRC ... #+END_SRC
    .replace(/^#\+BEGIN_SRC\s*(\w*)\n([\s\S]*?)^#\+END_SRC/gm, '<pre><code class="language-$1">$2</code></pre>')
    
    // Quote blocks: #+BEGIN_QUOTE ... #+END_QUOTE
    .replace(/^#\+BEGIN_QUOTE\n([\s\S]*?)^#\+END_QUOTE/gm, '<blockquote>$1</blockquote>')
    
    // Horizontal rule: -----
    .replace(/^-{5,}$/gm, '<hr>')
    
    // Paragraphs: wrap consecutive non-empty lines
    .split(/\n\n+/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap if it's already an HTML element
      if (block.match(/^<(h[1-6]|ul|ol|li|pre|blockquote|hr|div)/)) {
        return block;
      }
      // Wrap list items in ul
      if (block.includes('<li>')) {
        return `<ul>${block}</ul>`;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
  
  return html;
}

/**
 * Generate a URL-safe slug from a title
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Process all org files in the directory
 */
function processOrgFiles() {
  if (!fs.existsSync(ORG_ROAM_PATH)) {
    console.log(`⚠️  Org-roam directory not found: ${ORG_ROAM_PATH}`);
    console.log('   Set ORG_ROAM_PATH environment variable to your org-roam directory.');
    console.log('   Example: ORG_ROAM_PATH=~/org-roam npm run publish-notes');
    return [];
  }

  console.log(`📂 Scanning: ${ORG_ROAM_PATH}`);
  
  const publishedNotes = [];
  
  // Recursively find all .org files
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip hidden directories and common non-content dirs
        if (!file.startsWith('.') && file !== 'node_modules') {
          walkDir(filePath);
        }
      } else if (file.endsWith('.org')) {
        processOrgFile(filePath, publishedNotes);
      }
    }
  }
  
  walkDir(ORG_ROAM_PATH);
  
  return publishedNotes;
}

/**
 * Process a single org file
 */
function processOrgFile(filePath, publishedNotes) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const metadata = parseOrgMetadata(content);
    
    // Only process files marked for publishing
    if (!metadata.publish) {
      return;
    }
    
    console.log(`  ✓ Publishing: ${metadata.title}`);
    
    const htmlContent = orgToHtml(content);
    const slug = slugify(metadata.title);
    const id = `note-${slug}`;
    
    const note = {
      id,
      slug,
      title: metadata.title,
      date: metadata.date,
      tags: metadata.tags,
      description: metadata.description || extractDescription(content),
      content: htmlContent,
      sourceFile: path.basename(filePath),
    };
    
    // Write individual note JSON
    const noteOutputPath = path.join(OUTPUT_DIR, `${slug}.json`);
    fs.writeFileSync(noteOutputPath, JSON.stringify(note, null, 2));
    
    publishedNotes.push({
      id: note.id,
      slug: note.slug,
      title: note.title,
      date: note.date,
      tags: note.tags,
      description: note.description,
    });
    
  } catch (error) {
    console.error(`  ✗ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Extract first paragraph as description if not provided
 */
function extractDescription(content) {
  // Remove metadata
  let body = content.replace(/^#\+[^\n]+\n/gm, '');
  body = body.replace(/^:PROPERTIES:[\s\S]*?:END:\n?/gm, '');
  
  // Get first non-empty paragraph
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length > 0) {
    // Remove org formatting and limit length
    let desc = paragraphs[0]
      .replace(/^\*+\s+/, '') // Remove heading markers
      .replace(/\[\[([^\]]+)\]\[([^\]]+)\]\]/g, '$2') // Links to text
      .replace(/[*/_=~+]/g, '') // Remove formatting chars
      .trim();
    
    if (desc.length > 160) {
      desc = desc.substring(0, 157) + '...';
    }
    return desc;
  }
  return '';
}

/**
 * Main execution
 */
function main() {
  console.log('\n🔄 Org-Roam Publisher');
  console.log('====================\n');
  
  const notes = processOrgFiles();
  
  // Sort by date (newest first)
  notes.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Write manifest
  const manifest = {
    generated: new Date().toISOString(),
    count: notes.length,
    notes,
  };
  
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  
  console.log(`\n✅ Published ${notes.length} note(s) to public/notes/`);
  console.log(`   Manifest: public/notes/manifest.json\n`);
  
  return notes;
}

// Export for use in other scripts
module.exports = { main, processOrgFiles, parseOrgMetadata, orgToHtml };

// Run if called directly
if (require.main === module) {
  main();
}
