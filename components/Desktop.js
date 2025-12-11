'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { fileSystem } from '@/utils/fileSystem';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const withBase = (p) => (p?.startsWith('/') ? `${BASE_PATH}${p}` : p);

const ICON_SIZE = 70; // px, used for simple clamping inside the canvas

export default function Desktop({ onOpenWindow, showHiddenFiles }) {
  const canvasRef = useRef(null);

  // Hidden file definition
  const hiddenFile = {
    id: 'HIDDEN_GIF',
    title: 'gundam.gif',
    type: 'gif',
    icon: withBase('/fileicon.png'),
    sprite: 'sprite-file',
    windowSize: { w: 500, h: 400 },
  };

  // Using fileSystem data to initialize positions
  const initialPositions = useMemo(() => {
    const pos = {};
    fileSystem.forEach((item, index) => {
      // Simple grid positioning logic or hardcoded defaults
      pos[item.id] = { x: 20 + (index * 100), y: 20 };
    });
    // Add hidden file position if shown
    if (showHiddenFiles) {
      pos[hiddenFile.id] = { x: 20 + (fileSystem.length * 100), y: 20 };
    }
    return pos;
  }, [showHiddenFiles]);

  const [positions, setPositions] = useState(initialPositions);
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY }

  // Update positions when showHiddenFiles changes
  useEffect(() => {
    if (showHiddenFiles) {
      setPositions(prev => {
        if (!prev[hiddenFile.id]) {
          return {
            ...prev,
            [hiddenFile.id]: { x: 20 + (fileSystem.length * 100), y: 20 }
          };
        }
        return prev;
      });
    }
  }, [showHiddenFiles]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!dragging?.id || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragging.offsetX;
      const y = e.clientY - rect.top - dragging.offsetY;

      setPositions((prev) => {
        const maxX = Math.max(0, rect.width - ICON_SIZE);
        const maxY = Math.max(0, rect.height - ICON_SIZE);

        return {
          ...prev,
          [dragging.id]: {
            x: Math.min(Math.max(0, x), maxX),
            y: Math.min(Math.max(0, y), maxY),
          },
        };
      });
    };

    const handleUp = () => setDragging(null);

    if (dragging?.id) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    }

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging]);

  const handlePointerDown = (id) => (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const { x = 0, y = 0 } = positions[id] || { x: 0, y: 0 };

    setDragging({
      id,
      offsetX: e.clientX - rect.left - x,
      offsetY: e.clientY - rect.top - y,
    });
  };

  return (
    <div className="canvas" ref={canvasRef}>
      {fileSystem.map((icon) => {
        const pos = positions[icon.id] || { x: 0, y: 0 };

        return (
          <div
            key={icon.id}
            className="icon desktop-icon"
            id={icon.id}
            style={{ left: pos.x, top: pos.y }}
            onDoubleClick={() => onOpenWindow(icon.id)}
            onPointerDown={handlePointerDown(icon.id)}
          >
            <div
              className={`sprite-top ${icon.sprite}`}
              style={{
                backgroundImage: `url(${icon.icon})`,
                backgroundPosition: '0 0',
                backgroundSize: icon.type === 'file' ? '28px 72px' : '36px 58px', // Adjust if needed
              }}
            />
            <h5>{icon.title}</h5>
          </div>
        );
      })}

      {/* Hidden File - only show when showHiddenFiles is true */}
      {showHiddenFiles && (
        <div
          key={hiddenFile.id}
          className="icon desktop-icon"
          id={hiddenFile.id}
          style={{ left: positions[hiddenFile.id]?.x || 20 + (fileSystem.length * 100), top: positions[hiddenFile.id]?.y || 20 }}
          onDoubleClick={() => onOpenWindow(hiddenFile.id, hiddenFile.type)}
          onPointerDown={handlePointerDown(hiddenFile.id)}
        >
          <div
            className={`sprite-top ${hiddenFile.sprite}`}
            style={{
              backgroundImage: `url(${hiddenFile.icon})`,
              backgroundPosition: '0 0',
              backgroundSize: '28px 72px',
            }}
          />
          <h5>{hiddenFile.title}</h5>
        </div>
      )}
    </div>
  );
}
