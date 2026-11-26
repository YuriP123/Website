import WikiStack from '@/components/WikiStack';
import { renderNote } from '@/lib/org-api';

export default async function WikiRoot() {
  const initialNote = (await renderNote('index')) || {
    slug: 'index',
    title: 'Digital Garden',
    html: '<section class="garden-card"><p>Nothing planted yet.</p></section>',
    tags: [],
    planted: null,
    tended: null,
    backlinks: [],
  };

  return <WikiStack initialNote={initialNote} />;
}
