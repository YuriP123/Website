import { notFound } from 'next/navigation';
import WikiStack from '@/components/WikiStack';
import { getAllPosts, renderNote } from '@/lib/org-api';

export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllPosts().map(({ slug }) => ({ slug: slug.split('/') }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const note = await renderNote(slug.map(decodeURIComponent).join('/'));
  return note ? { title: `${note.title} · YuriOS` } : {};
}

export default async function WikiPage({ params }) {
  const { slug } = await params;
  const note = await renderNote(slug.map(decodeURIComponent).join('/'));
  if (!note) notFound();
  return <WikiStack initialNote={note} />;
}
