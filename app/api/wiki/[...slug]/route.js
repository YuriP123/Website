import { getAllPosts, renderNote } from '@/lib/org-api';

// Pre-rendered to static JSON files at build time (output: 'export').
// WikiStack fetches /api/wiki/<slug> when a note is added to the stack.
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllPosts().map(({ slug }) => ({ slug: slug.split('/') }));
}

export async function GET(request, { params }) {
  const { slug } = await params;
  const note = await renderNote(slug.map(decodeURIComponent).join('/'));
  if (!note) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(note);
}
