'use client';

import { useState, useEffect } from 'react';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const withBase = (p) => (p?.startsWith('/') ? `${BASE_PATH}${p}` : p);

export default function WikiLoadingScreen({ onComplete }) {
  const [isExiting, setIsExiting] = useState(false);

  // Auto-complete after animation plays
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onComplete?.();
      }, 600);
    }, 3000); // Show for 3 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`wiki-loading-screen ${isExiting ? 'exiting' : ''}`}>
      <div className="wiki-logo-container">
        <img
          src={withBase('/images/yurilogo.jpeg')}
          alt="Loading..."
          className="wiki-rotating-logo"
        />
      </div>
    </div>
  );
}
