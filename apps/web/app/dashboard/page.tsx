'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import queueStyles from './queue.module.css';

interface UserData {
  username: string;
  email: string;
  playerClass: string;
}

const CLASS_LABELS: Record<string, string> = {
  architect: '🏗️ The Architect',
  bughunter: '🐛 Bug Hunter',
  speedster: '⚡ The Speedster',
  optimizer: '🎯 The Optimizer',
};

const MODE_ICONS: Record<string, string> = {
  blitz: '⚡',
  golf: '🏌️',
  royale: '🏆',
  sabotage: '🗡️',
};

const MODES = [
  { id: 'blitz', icon: '⚡', name: '1v1 Blitz', desc: 'Race to solve 5 problems. Lock out your opponent!', queue: '~30s queue' },
  { id: 'golf', icon: '🏌️', name: 'Code Golf', desc: 'Shortest code wins. Every character counts.', queue: '~45s queue' },
  { id: 'royale', icon: '🏆', name: 'Battle Royale', desc: 'Survive elimination rounds. Last coder standing.', queue: 'Next round in 5:00' },
  { id: 'sabotage', icon: '🗡️', name: 'Sabotage & Debug', desc: 'Plant bugs, then swap and debug. Mind games.', queue: '~40s queue' },
];

const OPPONENT_NAMES = ['AlgoKing', 'ByteSlayer', 'NullPointer', 'StackOverflow', 'RecursionGod', 'LoopMaster', 'BitWizard', 'CodeNinja'];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);

  // Queue state
  const [queueMode, setQueueMode] = useState<string | null>(null);
  const [queueTime, setQueueTime] = useState(0);
  const [matchFound, setMatchFound] = useState(false);
  const [opponent, setOpponent] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('codearena_user');
    if (!stored) {
      router.replace('/register');
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  // Queue timer
  useEffect(() => {
    if (!queueMode || matchFound) return;

    const interval = setInterval(() => {
      setQueueTime((t) => t + 1);
    }, 1000);

    // Simulate finding a match after 3-6 seconds
    const matchDelay = 3000 + Math.random() * 3000;
    const timeout = setTimeout(() => {
      const randomOpponent = OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)];
      setOpponent(randomOpponent);
      setMatchFound(true);
    }, matchDelay);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [queueMode, matchFound]);

  const handleFindMatch = useCallback((modeId: string) => {
    setQueueMode(modeId);
    setQueueTime(0);
    setMatchFound(false);
    setOpponent('');
  }, []);

  const handleCancelQueue = useCallback(() => {
    setQueueMode(null);
    setQueueTime(0);
    setMatchFound(false);
  }, []);

  const handleEnterMatch = useCallback(() => {
    router.push(`/match?mode=${queueMode}&opponent=${encodeURIComponent(opponent)}`);
  }, [router, queueMode, opponent]);

  const handleLogout = () => {
    localStorage.removeItem('codearena_user');
    router.push('/');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!user) return null;

  return (
    <main className={styles.main}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            Welcome, <span className={styles.greetingName}>{user.username}</span>
          </h1>
          <p className={styles.classTag}>{CLASS_LABELS[user.playerClass] ?? user.playerClass}</p>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Skill Polygon */}
      <div className={styles.skillSection}>
        <h2 className={styles.skillTitle}>Skill Polygon</h2>
        <div className={styles.skillGrid}>
          <div className={styles.skillCard}>
            <div className={styles.skillName}>Algorithms</div>
            <div className={`${styles.skillValue} ${styles.skillAlgo}`}>1500</div>
          </div>
          <div className={styles.skillCard}>
            <div className={styles.skillName}>Debugging</div>
            <div className={`${styles.skillValue} ${styles.skillDebug}`}>1500</div>
          </div>
          <div className={styles.skillCard}>
            <div className={styles.skillName}>Optimization</div>
            <div className={`${styles.skillValue} ${styles.skillOptim}`}>1500</div>
          </div>
          <div className={styles.skillCard}>
            <div className={styles.skillName}>Speed</div>
            <div className={`${styles.skillValue} ${styles.skillSpeed}`}>1500</div>
          </div>
        </div>
      </div>

      {/* Play Modes */}
      <div className={styles.modesSection}>
        <h2 className={styles.modesTitle}>Choose Your Battle</h2>
        <div className={styles.modesGrid}>
          {MODES.map((mode) => (
            <div key={mode.id} className={styles.modeCard}>
              <div className={styles.modeIcon}>{mode.icon}</div>
              <div className={styles.modeName}>{mode.name}</div>
              <div className={styles.modeDesc}>{mode.desc}</div>
              <div className={styles.modeQueue}>{mode.queue}</div>
              <button
                className={styles.playBtn}
                onClick={() => handleFindMatch(mode.id)}
              >
                Find Match
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Matches */}
      <div className={styles.recentSection}>
        <h2 className={styles.recentTitle}>Recent Matches</h2>
        <p className={styles.recentEmpty}>No matches played yet. Jump into your first battle!</p>
      </div>

      {/* ─── Queue Overlay ─── */}
      {queueMode && !matchFound && (
        <div className={queueStyles.overlay}>
          <div className={queueStyles.queueCard}>
            <div className={queueStyles.queueIcon}>{MODE_ICONS[queueMode] ?? '🎮'}</div>
            <div className={queueStyles.queueTitle}>
              Finding <span className={queueStyles.queueMode}>
                {MODES.find((m) => m.id === queueMode)?.name}
              </span> match...
            </div>
            <div className={queueStyles.spinner} />
            <div className={queueStyles.queueTimer}>{formatTime(queueTime)}</div>
            <div className={queueStyles.queueStatus}>Searching for opponents near your ELO...</div>
            <button className={queueStyles.cancelBtn} onClick={handleCancelQueue}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── Match Found Overlay ─── */}
      {queueMode && matchFound && (
        <div className={queueStyles.overlay}>
          <div className={queueStyles.foundCard}>
            <div className={queueStyles.foundTitle}>⚔️ Match Found!</div>
            <div className={queueStyles.vsContainer}>
              <div className={queueStyles.playerCard}>
                <div className={queueStyles.playerName}>{user.username}</div>
                <div className={queueStyles.playerElo}>ELO 1500</div>
              </div>
              <div className={queueStyles.vsText}>VS</div>
              <div className={queueStyles.playerCard}>
                <div className={queueStyles.playerName}>{opponent}</div>
                <div className={queueStyles.playerElo}>ELO {1400 + Math.floor(Math.random() * 200)}</div>
              </div>
            </div>
            <button className={queueStyles.enterBtn} onClick={handleEnterMatch}>
              Enter Match
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
