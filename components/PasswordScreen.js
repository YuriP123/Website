'use client';

import { useState } from 'react';
import SpinningLogo from './SpinningLogo';

export default function PasswordScreen({ onUnlock }) {
  const [password, setPassword] = useState('');

  // Any password is accepted.
  const handleSubmit = (e) => {
    e.preventDefault();
    onUnlock();
  };

  return (
    <div className="password-screen login-screen">
      <SpinningLogo />
      <form className="password-hold login-form" onSubmit={handleSubmit}>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="off"
        />
        <button type="submit">OK</button>
      </form>
    </div>
  );
}
