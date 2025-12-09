'use client';

import { useEffect, useState, Fragment } from 'react';

export default function Bios({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);

  // Boot sequence lines
  const bootLines = [
    { text: "YuriOS v1.0.0", delay: 500 },
    { text: "Copyright (c) 2049, 2050. All Rights Reserved", delay: 100 },
    { text: "BIOS Version: 2945170 Release 3", delay: 100 },
    { spacer: true, delay: 50 },
    { text: "Battery Pack: 100% OK", delay: 400 },
    { text: "Memory Test: 16384K OK", delay: 400 },
    { text: "Initialization USB Controllers... Done", delay: 600 },
    { spacer: true, delay: 50 },
    { text: "Press Any Key to boot system", action: true, delay: 200 }
  ];

  useEffect(() => {
    let timeoutId;

    if (step < bootLines.length) {
      const line = bootLines[step];
      timeoutId = setTimeout(() => {
        setStep(s => s + 1);
      }, line.delay);
    }

    return () => clearTimeout(timeoutId);
  }, [step]);

  useEffect(() => {
    const handleKeyPress = () => {
      // Only allow skipping/continue if the "Press Any Key" line is visible (last step)
      // Or allow user to skip animation by pressing key early? Let's allow skip to end or boot.

      if (step < bootLines.length - 1) {
        // Fast forward
        setStep(bootLines.length - 1);
      } else {
        // Boot
        setVisible(false);
        setTimeout(() => {
          onComplete();
        }, 100);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('click', handleKeyPress); // Also allow click
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('click', handleKeyPress);
    };
  }, [onComplete, step]);

  if (!visible) return null;

  return (
    <div className="bios">
      <div className="text">
        {bootLines.map((line, index) => {
          if (index > step) return null;
          if (line.spacer) return <Fragment key={index}><br /><br /></Fragment>;

          if (line.action) {
            return (
              <p key={index}>
                Press <span className="blinking">Any Key</span> to boot system
              </p>
            );
          }

          return <p key={index}>{line.text}</p>;
        })}
        {/* Blinking cursor at the bottom while loading? */}
        {step < bootLines.length - 1 && <span className="blinking">_</span>}
      </div>
    </div>
  );
}
