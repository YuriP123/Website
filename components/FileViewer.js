'use client';

import { useEffect, useRef } from 'react';

export default function FileViewer({ item }) {
  const gifContainerRef = useRef(null);

  useEffect(() => {
    if (item?.type === 'gif' && !document.querySelector('script[src="https://tenor.com/embed.js"]')) {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://tenor.com/embed.js';
      document.body.appendChild(script);
    }
  }, [item]);

  if (!item) return null;

  if (item.type === 'pdf') {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', margin: '-8px', padding: 0 }}>
        <iframe
          src={item.src}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title={item.title}
        />
      </div>
    );
  }

  if (item.type === 'file') {
    return (
      <div
        id="message"
        dangerouslySetInnerHTML={{ __html: item.content }}
      />
    );
  }

  if (item.type === 'gif') {
    return (
      <div 
        ref={gifContainerRef}
        style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', overflow: 'auto' }}
      >
        <div 
          className="tenor-gif-embed" 
          data-postid="23397434" 
          data-share-method="host" 
          data-aspect-ratio="1.78771" 
          data-width="100%"
          style={{ width: '100%', maxWidth: '100%' }}
        >
          <a href="https://tenor.com/view/gundam-gunpla-gundam-unicorn-meme-funny-gif-23397434">Gundam Gunpla GIF</a>
          from <a href="https://tenor.com/search/gundam-gifs">Gundam GIFs</a>
        </div>
      </div>
    );
  }

  return <div>Unknown file type</div>;
}
