import WikiStack from '@/components/WikiStack';
import { renderNote } from '@/lib/org-api';

export default async function WikiRoot() {
  const initialNote = (await renderNote('index')) || {
    slug: 'index',
    title: 'Digital Universe',
    html: '<section class="universe-card"><p>Nothing here yet.</p></section>',
    tags: [],
    planted: null,
    tended: null,
    backlinks: [],
  };

  return <WikiStack initialNote={initialNote} />;
}
