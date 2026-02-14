import Link from 'next/link';
import styles from './page.module.css';

// Placeholder live matches — will be replaced with real-time data from WebSocket
const MOCK_MATCHES = [
  { id: '1', player1: 'AlgoKing', player2: 'ByteSlayer', mode: '1v1 Blitz', elo: '2100 vs 2050', viewers: 24 },
  { id: '2', player1: 'NullPointer', player2: 'StackOverflow', mode: 'Code Golf', elo: '1850 vs 1900', viewers: 12 },
  { id: '3', player1: 'RecursionGod', player2: 'LoopMaster', mode: 'Sabotage', elo: '1700 vs 1680', viewers: 8 },
];

export default function SpectatePage() {
  const matches = MOCK_MATCHES;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>🎮 Live Matches</h1>
      <p className={styles.subtitle}>Watch top players battle in real-time</p>

      {matches.length > 0 ? (
        <div className={styles.matchList}>
          {matches.map((match) => (
            <div key={match.id} className={styles.matchCard}>
              <div className={styles.matchInfo}>
                <div className={styles.matchPlayers}>
                  {match.player1} vs {match.player2}
                </div>
                <div className={styles.matchMeta}>
                  {match.mode} · {match.elo} · {match.viewers} watching
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className={styles.liveIndicator}>
                  <span className={styles.liveDot} />
                  LIVE
                </div>
                <Link href={`/spectate/${match.id}`} className={styles.watchBtn}>
                  Watch
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📺</div>
          <p className={styles.emptyText}>No live matches right now. Check back soon!</p>
        </div>
      )}
    </main>
  );
}
