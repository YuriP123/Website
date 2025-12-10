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

    startDrag(e.clientX, e.clientY);
  };

  const handleTitleBarTouchStart = (e) => {
    if (onFocus) onFocus();
    if (e.target.closest('.mac-button')) return;
    const touch = e.touches[0];
    if (!touch) return;
    startDrag(touch.clientX, touch.clientY);
  };

  const handleWindowMouseDown = () => {
    if (onFocus) onFocus();
  };

  const startDrag = (clientX, clientY) => {
    if (!windowRef.current || !onPositionChange) return;
    const rect = windowRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
  };

  useEffect(() => {
    if (!isDragging || !onPositionChange) return;

    const handlePointerMove = (clientX, clientY) => {
      if (!windowRef.current) return;

      const moduleElement = windowRef.current.closest('.module');
      const parentRect = moduleElement?.getBoundingClientRect() || { left: 0, top: 0 };

      let newX = clientX - parentRect.left - dragOffset.x;
      let newY = clientY - parentRect.top - dragOffset.y;

      onPositionChange({ x: newX, y: newY });
    };

    const handleMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      handlePointerMove(touch.clientX, touch.clientY);
    };

    const endDrag = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchcancel', endDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', endDrag);
      window.removeEventListener('touchcancel', endDrag);
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
      onTouchStart={handleWindowMouseDown}
    >
      <div
        className="mac-window-titlebar"
        onMouseDown={handleTitleBarMouseDown}
        onTouchStart={handleTitleBarTouchStart}
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
