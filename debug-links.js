const { getIdMap, getPostBySlug } = require('./lib/org-api');
const path = require('path');

async function debugLinks() {
  console.log('--- Generating ID Map ---');
  const map = getIdMap();
  console.log(`Map size: ${Object.keys(map).length}`);

  // Check a known ID from dev.org
  const sampleId = '223df1bf-b90e-444d-b1a1-23feda6e3081'; // CPSC323
  console.log(`ID ${sampleId} resolves to:`, map[sampleId]);

  console.log('\n--- Processing dev.org ---');
  const post = await getPostBySlug('dev');
  if (post) {
    console.log('dev.org processed successfully.');
    // We can't easily see the React output here, but we know getPostBySlug runs the full pipeline
    // including rehypeResolveIds.
    // If we want to see HTML, we need to adapt getPostBySlug to stringify instead of react
  } else {
    console.log('dev.org not found.');
  }
}

debugLinks().catch(console.error);
