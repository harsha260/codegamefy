import type { Language } from '@codearena/shared';

export interface LanguageConfig {
  id: Language;
  name: string;
  image: string;
  compile: string | null;
  run: string;
  sourceFile: string;
  timeout: { compile: number; run: number };
  memory: number;
  fileSize: number;
}

export const languageConfigs: Record<Language, LanguageConfig> = {
  cpp: {
    id: 'cpp',
    name: 'C++ 17',
    image: 'codearena/runner-cpp:latest',
    compile: 'g++ -std=c++17 -O2 -o /tmp/solution /tmp/solution.cpp',
    run: '/tmp/solution',
    sourceFile: 'solution.cpp',
    timeout: { compile: 15000, run: 10000 },
    memory: 256 * 1024 * 1024,
    fileSize: 64 * 1024,
  },
  python: {
    id: 'python',
    name: 'Python 3.11',
    image: 'codearena/runner-python:latest',
    compile: null,
    run: 'python3 /tmp/solution.py',
    sourceFile: 'solution.py',
    timeout: { compile: 0, run: 10000 },
    memory: 256 * 1024 * 1024,
    fileSize: 64 * 1024,
  },
  javascript: {
    id: 'javascript',
    name: 'JavaScript (Node 20)',
    image: 'codearena/runner-node:latest',
    compile: null,
    run: 'node /tmp/solution.js',
    sourceFile: 'solution.js',
    timeout: { compile: 0, run: 10000 },
    memory: 256 * 1024 * 1024,
    fileSize: 64 * 1024,
  },
  java: {
    id: 'java',
    name: 'Java 21',
    image: 'codearena/runner-java:latest',
    compile: 'javac /tmp/Solution.java',
    run: 'java -cp /tmp Solution',
    sourceFile: 'Solution.java',
    timeout: { compile: 15000, run: 10000 },
    memory: 256 * 1024 * 1024,
    fileSize: 64 * 1024,
  },
  go: {
    id: 'go',
    name: 'Go 1.22',
    image: 'codearena/runner-go:latest',
    compile: 'go build -o /tmp/solution /tmp/solution.go',
    run: '/tmp/solution',
    sourceFile: 'solution.go',
    timeout: { compile: 15000, run: 10000 },
    memory: 256 * 1024 * 1024,
    fileSize: 64 * 1024,
  },
};
