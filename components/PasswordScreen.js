'use client';

import { useState } from 'react';

export default function PasswordScreen({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [hintText, setHintText] = useState('Forgot your password?');

  const handleSubmit = () => {
    if (password.toLowerCase() === 'alcon1') {
      onUnlock();
    } else {
      setError(true);
    }
  };

  const handleHintClick = () => {
    setHintText("Really....");
  };

  return (
    <div className="password-screen">
      <div className="input-box">
        <div className="outline">
          <p>Welcome User!</p><br />
          <div className="password-hold">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              style={{ border: error ? "2px solid red" : "1px solid black" }} // Inline style for dynamic error or add class
            />
            <p id="password-hint" onClick={handleHintClick}>{hintText}</p><br />
            <button type="button" onClick={handleSubmit}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
