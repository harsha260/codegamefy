'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface Problem {
  id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  points: number;
  description: string;
  examples: { input: string; output: string }[];
  status: 'open' | 'solved' | 'locked';
}

const MOCK_PROBLEMS: Problem[] = [
  {
    id: 1, title: 'Two Sum', difficulty: 'Easy', points: 100, status: 'open',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.',
    examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' }],
  },
  {
    id: 2, title: 'Valid Parentheses', difficulty: 'Easy', points: 100, status: 'open',
    description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.',
    examples: [{ input: 's = "()"', output: 'true' }, { input: 's = "([)]"', output: 'false' }],
  },
  {
    id: 3, title: 'Merge Intervals', difficulty: 'Medium', points: 200, status: 'open',
    description: 'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
    examples: [{ input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' }],
  },
  {
    id: 4, title: 'LRU Cache', difficulty: 'Medium', points: 200, status: 'open',
    description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the LRUCache class with get(key) and put(key, value) methods, both running in O(1) average time complexity.',
    examples: [{ input: 'LRUCache(2), put(1,1), put(2,2), get(1)', output: '1' }],
  },
  {
    id: 5, title: 'Median of Two Sorted Arrays', difficulty: 'Hard', points: 300, status: 'open',
    description: 'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.\n\nThe overall run time complexity should be O(log (m+n)).',
    examples: [{ input: 'nums1 = [1,3], nums2 = [2]', output: '2.0' }],
  },
];

const MODE_LABELS: Record<string, string> = {
  blitz: '⚡ 1v1 Blitz',
  golf: '🏌️ Code Golf',
  royale: '🏆 Battle Royale',
  sabotage: '🗡️ Sabotage',
};

function MatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') ?? 'blitz';
  const opponentName = searchParams.get('opponent') ?? 'Opponent';

  const [user, setUser] = useState<{ username: string } | null>(null);
  const [problems, setProblems] = useState<Problem[]>(MOCK_PROBLEMS);
  const [activeProblem, setActiveProblem] = useState(0);
  const [code, setCode] = useState('// Write your solution here\n\n');
  const [language, setLanguage] = useState('javascript');
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes for demo (shorter for testing)
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [output, setOutput] = useState('');
  const [testResults, setTestResults] = useState<('pass' | 'fail' | 'pending')[]>([]);
  const [verdict, setVerdict] = useState<'accepted' | 'wrong' | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [problemsSolvedByMe, setProblemsSolvedByMe] = useState(0);
  const gameOverTriggered = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem('codearena_user');
    if (!stored) {
      router.replace('/register');
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  // Check game-over conditions
  useEffect(() => {
    if (gameOverTriggered.current) return;

    // Condition 1: Timer ran out
    if (timeLeft <= 0) {
      gameOverTriggered.current = true;
      setGameOver(true);
      return;
    }

    // Condition 2: All problems are solved or locked (no open problems left)
    const openProblems = problems.filter((p) => p.status === 'open');
    if (openProblems.length === 0) {
      gameOverTriggered.current = true;
      // Small delay so the last verdict animation can play
      setTimeout(() => setGameOver(true), 1600);
    }
  }, [timeLeft, problems]);

  // Countdown timer
  useEffect(() => {
    if (gameOver || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, gameOver]);

  // Simulate opponent solving problems
  useEffect(() => {
    if (gameOver) return;
    const oppInterval = setInterval(() => {
      setProblems((prev) => {
        const openProblems = prev.filter((p) => p.status === 'open');
        if (openProblems.length === 0) return prev;

        // 12% chance opponent solves a problem each tick
        if (Math.random() > 0.12) return prev;

        const target = openProblems[Math.floor(Math.random() * openProblems.length)];
        setOppScore((s) => s + target.points);
        return prev.map((p) =>
          p.id === target.id ? { ...p, status: 'locked' as const } : p
        );
      });
    }, 4000);

    return () => clearInterval(oppInterval);
  }, [gameOver]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleRun = useCallback(() => {
    if (gameOver) return;
    setOutput('Running tests...\n');
    setTestResults(problems[activeProblem].examples.map(() => 'pending'));

    setTimeout(() => {
      const results = problems[activeProblem].examples.map(() =>
        Math.random() > 0.3 ? 'pass' as const : 'fail' as const
      );
      setTestResults(results);
      const passed = results.filter((r) => r === 'pass').length;
      setOutput(`Test Results: ${passed}/${results.length} passed\n` +
        results.map((r, i) => `  Test ${i + 1}: ${r === 'pass' ? '✅ PASS' : '❌ FAIL'}`).join('\n'));
    }, 1000);
  }, [activeProblem, problems, gameOver]);

  const handleSubmit = useCallback(() => {
    if (gameOver) return;
    setOutput('Submitting solution...\n');

    setTimeout(() => {
      const problem = problems[activeProblem];
      if (problem.status !== 'open') {
        setOutput('This problem has already been locked!');
        return;
      }

      // 60% chance of acceptance
      const accepted = Math.random() > 0.4;

      if (accepted) {
        setVerdict('accepted');
        setMyScore((s) => s + problem.points);
        setProblemsSolvedByMe((n) => n + 1);
        setProblems((prev) =>
          prev.map((p) => p.id === problem.id ? { ...p, status: 'solved' as const } : p)
        );
        setOutput(`✅ Accepted! +${problem.points} points`);
        setTestResults(problem.examples.map(() => 'pass'));
      } else {
        setVerdict('wrong');
        setOutput('❌ Wrong Answer\n\nExpected: [0,1]\nGot: [1,0]');
        setTestResults(problem.examples.map(() => 'fail'));
      }

      setTimeout(() => setVerdict(null), 1500);
    }, 1500);
  }, [activeProblem, problems, gameOver]);

  const handleRematch = () => {
    // Reset everything
    gameOverTriggered.current = false;
    setProblems(MOCK_PROBLEMS.map((p) => ({ ...p, status: 'open' as const })));
    setMyScore(0);
    setOppScore(0);
    setTimeLeft(120);
    setGameOver(false);
    setActiveProblem(0);
    setCode('// Write your solution here\n\n');
    setOutput('');
    setTestResults([]);
    setProblemsSolvedByMe(0);
  };

  if (!user) return null;

  const currentProblem = problems[activeProblem];
  const diffClass = currentProblem.difficulty === 'Easy' ? styles.diffEasy
    : currentProblem.difficulty === 'Medium' ? styles.diffMedium
    : styles.diffHard;

  // Game over result
  const result = myScore > oppScore ? 'win' : myScore < oppScore ? 'lose' : 'draw';
  const eloChange = result === 'win' ? '+25' : result === 'lose' ? '-18' : '+0';

  return (
    <main className={styles.main}>
      {/* Match Header */}
      <div className={styles.matchHeader}>
        <div className={styles.matchMode}>{MODE_LABELS[mode] ?? mode}</div>
        <div className={`${styles.timer} ${timeLeft < 60 ? styles.timerWarning : ''}`}>
          {formatTime(timeLeft)}
        </div>
        <div className={styles.scores}>
          <div className={styles.playerScore}>
            <div className={styles.playerScoreName}>{user.username}</div>
            <div className={`${styles.playerScoreValue} ${styles.you}`}>{myScore}</div>
          </div>
          <div className={styles.playerScore}>
            <div className={styles.playerScoreName}>{opponentName}</div>
            <div className={`${styles.playerScoreValue} ${styles.opponent}`}>{oppScore}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Problem Panel */}
        <div className={styles.problemPanel}>
          <div className={styles.problemTabs}>
            {problems.map((p, i) => (
              <button
                key={p.id}
                className={`${styles.problemTab} ${
                  i === activeProblem ? styles.problemTabActive : ''
                } ${p.status === 'locked' ? styles.problemTabLocked : ''} ${
                  p.status === 'solved' ? styles.problemTabSolved : ''
                }`}
                onClick={() => p.status !== 'locked' && setActiveProblem(i)}
                disabled={p.status === 'locked'}
              >
                P{i + 1} ({p.points})
              </button>
            ))}
          </div>

          <h2 className={styles.problemTitle}>{currentProblem.title}</h2>
          <div className={`${styles.problemDifficulty} ${diffClass}`}>
            {currentProblem.difficulty} · {currentProblem.points} pts
            {currentProblem.status === 'solved' && ' · ✅ Solved'}
            {currentProblem.status === 'locked' && ' · 🔒 Locked by opponent'}
          </div>

          <div className={styles.problemDesc}>
            {currentProblem.description}
          </div>

          {currentProblem.examples.map((ex, i) => (
            <div key={i} className={styles.exampleBlock}>
              <div className={styles.exampleLabel}>Example {i + 1}</div>
              <div className={styles.exampleContent}>Input: {ex.input}</div>
              <div className={styles.exampleContent}>Output: {ex.output}</div>
            </div>
          ))}
        </div>

        {/* Editor Panel */}
        <div className={styles.editorPanel}>
          <div className={styles.editorHeader}>
            <select
              className={styles.langSelect}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="go">Go</option>
            </select>
          </div>

          <div className={styles.editorArea}>
            <textarea
              className={styles.textarea}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="// Write your solution here..."
              spellCheck={false}
              disabled={gameOver}
            />
          </div>

          {/* Output */}
          {output && (
            <div className={styles.outputPanel}>
              <div className={styles.outputTitle}>Output</div>
              <div className={styles.outputContent}>{output}</div>
            </div>
          )}

          {/* Bottom Bar */}
          <div className={styles.bottomBar}>
            <div className={styles.testResults}>
              {testResults.map((r, i) => (
                <div
                  key={i}
                  className={`${styles.testDot} ${r === 'pass' ? styles.testPass : r === 'fail' ? styles.testFail : ''}`}
                />
              ))}
              {testResults.length > 0 && (
                <span className={styles.testLabel}>
                  {testResults.filter((r) => r === 'pass').length}/{testResults.length} passed
                </span>
              )}
            </div>
            <div className={styles.actions}>
              <button className={styles.runBtn} onClick={handleRun} disabled={gameOver}>
                ▶ Run
              </button>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={gameOver || currentProblem.status !== 'open'}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Verdict Overlay */}
      {verdict && !gameOver && (
        <div className={styles.verdictOverlay}>
          <div className={styles.verdictCard}>
            <div className={styles.verdictIcon}>
              {verdict === 'accepted' ? '🎯' : '💥'}
            </div>
            <div className={`${styles.verdictText} ${verdict === 'accepted' ? styles.verdictAccepted : styles.verdictWrong}`}>
              {verdict === 'accepted' ? 'ACCEPTED!' : 'WRONG ANSWER'}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className={styles.gameOverOverlay}>
          <div className={styles.gameOverCard}>
            <div className={`${styles.gameOverTitle} ${
              result === 'win' ? styles.gameOverWin
              : result === 'lose' ? styles.gameOverLose
              : styles.gameOverDraw
            }`}>
              {result === 'win' ? '🏆 VICTORY!' : result === 'lose' ? '💀 DEFEAT' : '🤝 DRAW'}
            </div>
            <div className={styles.gameOverSubtitle}>
              {result === 'win' ? 'You dominated the arena!' : result === 'lose' ? 'Better luck next time.' : 'An even match!'}
            </div>

            <div className={styles.gameOverScores}>
              <div className={styles.gameOverPlayer}>
                <div className={styles.gameOverPlayerName}>{user.username}</div>
                <div className={`${styles.gameOverPlayerScore} ${styles.you}`}>{myScore}</div>
              </div>
              <div className={styles.gameOverPlayer}>
                <div className={styles.gameOverPlayerName}>{opponentName}</div>
                <div className={`${styles.gameOverPlayerScore} ${styles.opponent}`}>{oppScore}</div>
              </div>
            </div>

            <div className={styles.gameOverStats}>
              <div className={styles.gameOverStat}>
                <div className={styles.gameOverStatValue}>{problemsSolvedByMe}</div>
                <div className={styles.gameOverStatLabel}>Problems Solved</div>
              </div>
              <div className={styles.gameOverStat}>
                <div className={styles.gameOverStatValue}>{formatTime(120 - timeLeft)}</div>
                <div className={styles.gameOverStatLabel}>Time Used</div>
              </div>
            </div>

            <div className={`${styles.eloChange} ${result === 'win' ? styles.eloUp : result === 'lose' ? styles.eloDown : ''}`}>
              ELO: {eloChange}
            </div>

            <div className={styles.gameOverActions}>
              <button className={styles.rematchBtn} onClick={handleRematch}>
                ⚔️ Rematch
              </button>
              <Link href="/dashboard" className={styles.backBtn}>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading match...</div>}>
      <MatchContent />
    </Suspense>
  );
}
