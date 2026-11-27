import { SITE_URL, getRecentNotes, renderNote } from '@/lib/org-api';

// RSS feed of recently updated notes, generated at build time as /feed.xml
export const dynamic = 'force-static';

const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const absolutize = (html) => html.replace(/(href|src)="\//g, `$1="${SITE_URL}/`);

export async function GET() {
  const notes = getRecentNotes(50);
  const items = await Promise.all(notes.map(async (n) => {
    const { html } = await renderNote(n.slug);
    const link = `${SITE_URL}/wiki/${n.slug}/`;
    return `    <item>
      <title>${escapeXml(n.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(`${link}#${n.tended.toISOString()}`)}</guid>
      <pubDate>${n.tended.toUTCString()}</pubDate>
      <description>${escapeXml(absolutize(html))}</description>
    </item>`;
  }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Yuri's Digital Universe</title>
    <link>${SITE_URL}/wiki/</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Recently updated notes</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
