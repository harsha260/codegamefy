import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import styles from './layout.module.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CodeArena — Competitive Programming as a Game',
  description: 'Real-time multiplayer coding battles with ELO ratings, RPG classes, and game-feel mechanics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${styles.body}`}>
        {children}
      </body>
    </html>
  );
}
