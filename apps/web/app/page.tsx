import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <div className={styles.heroContainer}>
        <h1 className={styles.title}>
          <span className={styles.titleGradient}>CodeArena</span>
        </h1>
        <p className={styles.tagline}>
          Coding is a Game, not a Grind.
        </p>
        <p className={styles.subtitle}>
          Real-time multiplayer coding battles with ELO ratings, RPG classes,
          sabotage modes, and Battle Royale elimination rounds.
        </p>

        {/* CTA Buttons */}
        <div className={styles.ctaContainer}>
          <Link href="/register" className={styles.ctaPrimary}>
            Start Playing
          </Link>
          <Link href="/spectate" className={styles.ctaSecondary}>
            Watch Live
          </Link>
        </div>

        {/* Game Mode Cards */}
        <div className={styles.modesGrid}>
          <GameModeCard
            icon="⚡"
            title="1v1 Blitz"
            description="Race to solve 5 problems. Lock out your opponent!"
            variant="blitz"
          />
          <GameModeCard
            icon="🏌️"
            title="Code Golf"
            description="Shortest code wins. Every character counts."
            variant="golf"
          />
          <GameModeCard
            icon="🏆"
            title="Battle Royale"
            description="Survive elimination rounds. Last coder standing."
            variant="royale"
          />
          <GameModeCard
            icon="🗡️"
            title="Sabotage"
            description="Plant bugs, then swap and debug. Mind games."
            variant="sabotage"
          />
        </div>
      </div>
    </main>
  );
}

const variantMap: Record<string, string> = {
  blitz: styles.cardBlitz,
  golf: styles.cardGolf,
  royale: styles.cardRoyale,
  sabotage: styles.cardSabotage,
};

function GameModeCard({
  icon,
  title,
  description,
  variant,
}: {
  icon: string;
  title: string;
  description: string;
  variant: string;
}) {
  return (
    <div className={`${styles.card} ${variantMap[variant] ?? ''}`}>
      <div className={styles.cardIcon}>{icon}</div>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.cardDescription}>{description}</p>
    </div>
  );
}
