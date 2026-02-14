'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

const CLASSES = [
  { id: 'architect', icon: '🏗️', name: 'The Architect', desc: 'Highlights structural patterns' },
  { id: 'bughunter', icon: '🐛', name: 'Bug Hunter', desc: 'Highlights syntax errors' },
  { id: 'speedster', icon: '⚡', name: 'The Speedster', desc: 'Optimized for speed coding' },
  { id: 'optimizer', icon: '🎯', name: 'The Optimizer', desc: 'Focuses on efficiency' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState('architect');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Store user data locally (will be replaced with API call when backend is running)
    const userData = {
      username: username.trim(),
      email: email.trim(),
      playerClass: selectedClass,
    };
    localStorage.setItem('codearena_user', JSON.stringify(userData));

    // Navigate to dashboard
    router.push('/dashboard');
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Join the Arena</h1>
        <p className={styles.subtitle}>Create your account and choose your class</p>

        {error && <p className={styles.error}>{error}</p>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="username">Username</label>
            <input
              id="username"
              className={styles.input}
              type="text"
              placeholder="Choose a battle tag"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              className={styles.input}
              type="password"
              placeholder="Min 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Class Selection */}
          <div className={styles.classSection}>
            <p className={styles.classLabel}>Choose your Class</p>
            <div className={styles.classGrid}>
              {CLASSES.map((cls) => (
                <div
                  key={cls.id}
                  className={`${styles.classCard} ${selectedClass === cls.id ? styles.classCardSelected : ''}`}
                  onClick={() => setSelectedClass(cls.id)}
                >
                  <div className={styles.classIcon}>{cls.icon}</div>
                  <div className={styles.className}>{cls.name}</div>
                  <div className={styles.classDesc}>{cls.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className={styles.submitBtn}>
            Enter the Arena
          </button>
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span>or continue with</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.oauthContainer}>
          <button className={styles.oauthBtn}>GitHub</button>
          <button className={styles.oauthBtn}>Google</button>
        </div>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link href="/login" className={styles.footerLink}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
