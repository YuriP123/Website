'use client';

import { useState, useEffect } from 'react';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const withBase = (p) => (p?.startsWith('/') ? `${BASE_PATH}${p}` : p);

export default function Navbar({ showHiddenFiles, onShowHiddenFiles }) {
  const [time, setTime] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    const updateTime = () => {
      const objToday = new Date();
      const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "July", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];

      const dayOfWeek = weekday[objToday.getDay()];
      const dayOfMonth = objToday.getDate(); // Simplified suffix logic for brevity, or can add back if needed
      const curMonth = months[objToday.getMonth()];

      let curHour = objToday.getHours();
      const curMeridiem = curHour >= 12 ? "PM" : "AM";
      curHour = curHour > 12 ? curHour - 12 : curHour;
      curHour = curHour === 0 ? 12 : curHour;

      let curMinute = objToday.getMinutes();
      if (curMinute < 10) curMinute = "0" + curMinute;

      // Lore year 2049
      setTime(`ALCON1 ${curHour}:${curMinute}${curMeridiem} - ${curMonth} ${dayOfMonth}, 2049`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleDropdown = (name) => {
    if (activeDropdown === name) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(name);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('nav') && !event.target.closest('.dropdown')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <nav>
        <div className="box" style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
          <a className="nav-item" style={{ padding: '0 15px', height: '100%', display: 'flex', alignItems: 'center' }} onClick={() => toggleDropdown('apple')}>
            <img src={withBase('/pixel-banana.svg')} alt="Banana" style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />
          </a>
          <a className="nav-item" onClick={() => toggleDropdown('file')}>File</a>
          <a className="nav-item" onClick={() => toggleDropdown('edit')}>Edit</a>
          <a className="nav-item" onClick={() => toggleDropdown('special')}>Special</a>
        </div>
        <p id='time'>{time}</p>
      </nav>

      {activeDropdown === 'apple' && (
        <div className="dropdown apple">
          <ul>
            <li id="about">About</li>
            <li className="unclickable">Battery</li>
            <li id="restart" onClick={() => window.location.reload()}>Restart</li>
          </ul>
        </div>
      )}

      {activeDropdown === 'file' && (
        <div className="dropdown file">
          <ul>
            <li className="unclickable">New</li>
            <li className="unclickable">Open</li>
            <li id="show" onClick={() => {
              if (onShowHiddenFiles) {
                onShowHiddenFiles();
              }
              setActiveDropdown(null);
            }}>{showHiddenFiles ? 'Hide Hidden Files' : 'Show Hidden Files'}</li>
          </ul>
        </div>
      )}

      {activeDropdown === 'edit' && (
        <div className="dropdown edit">
          <ul>
            <li className="unclickable">Undo</li>
            <li className="unclickable">Copy</li>
            <li className="unclickable">Paste</li>
            <li className="unclickable">Print</li>
          </ul>
        </div>
      )}

      {activeDropdown === 'special' && (
        <div className="dropdown special">
          <ul>
            <a target="_blank" href="https://www.linkedin.com/in/miguelpasamonte/"><li>LinkedIn</li></a>
            <a target="_blank" href="https://github.com/miguelpasamonte"><li>GitHub</li></a>
            <a target="_blank" href="https://leetcode.com/YuriP123/"><li>LeetCode</li></a>
          </ul>
        </div>
      )}
    </>
  );
}
