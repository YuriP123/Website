'use client';

import { useEffect, useState, useRef } from 'react';

export default function Window({ title, children, onClose, className = "", style = {}, position, onPositionChange, onFocus }) {
  const [isOpening, setIsOpening] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);

  useEffect(() => {
    // Trigger opening animation
    const timer = setTimeout(() => setIsOpening(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    // Wait for closing animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  const handleTitleBarMouseDown = (e) => {
    // Bring to front when titlebar is clicked
    if (onFocus) onFocus();

    // Only drag from titlebar, not from buttons
    if (e.target.closest('.mac-button')) return;

    if (!windowRef.current || !onPositionChange) return;

    const rect = windowRef.current.getBoundingClientRect();

    setIsDragging(true);
    // Calculate offset from mouse click position to window's top-left corner
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleWindowMouseDown = () => {
    if (onFocus) onFocus();
  };

  useEffect(() => {
    if (!isDragging || !onPositionChange) return;

    const handleMouseMove = (e) => {
      if (!windowRef.current) return;

      // Find the module container (parent with class 'module')
      const moduleElement = windowRef.current.closest('.module');
      const parentRect = moduleElement?.getBoundingClientRect() || { left: 0, top: 0 };

      // Calculate new position relative to module container
      // Subtract dragOffset to maintain the same relative position from where user clicked
      // Allow windows to be dragged outside - they'll be clipped by overflow: hidden
      let newX = e.clientX - parentRect.left - dragOffset.x;
      let newY = e.clientY - parentRect.top - dragOffset.y;

      // No constraints - windows can be dragged anywhere, but will be clipped by parent overflow
      onPositionChange({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onPositionChange]);

  const windowStyle = {
    ...style,
    display: 'flex',
    flexDirection: 'column',
    cursor: isDragging ? 'grabbing' : (onPositionChange ? 'grab' : 'default'),
    userSelect: isDragging ? 'none' : 'auto',
  };

  if (position) {
    windowStyle.left = `${position.x}px`;
    windowStyle.top = `${position.y}px`;
  }

  return (
    <div
      ref={windowRef}
      className={`mac-window ${isOpening ? 'window-opening' : ''} ${isClosing ? 'window-closing' : ''} ${className}`}
      style={windowStyle}
      onMouseDown={handleWindowMouseDown}
    >
      <div
        className="mac-window-titlebar"
        onMouseDown={handleTitleBarMouseDown}
        style={{ cursor: onPositionChange ? 'grab' : 'default' }}
      >
        <button className="mac-button mac-button-close" onClick={handleClose} aria-label="Close"></button>
        <div className="mac-window-title pr-4">{title}</div>
      </div>
      <div className="mac-window-content">
        {children}
      </div>
    </div>
  );
}
