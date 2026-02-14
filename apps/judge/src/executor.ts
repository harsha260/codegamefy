import Docker from 'dockerode';
import { languageConfigs, type LanguageConfig } from './languages';
import { validateOutput } from './validator';
import type { Language, JudgeRequest, JudgeResult, TestCaseResult, Verdict } from '@codearena/shared';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  runtime: number; // ms
}

/**
 * Execute code in a sandboxed Docker container.
 * Returns the output and execution metrics.
 */
async function executeInContainer(
  code: string,
  input: string,
  config: LanguageConfig,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Create container with security constraints
  const container = await docker.createContainer({
    Image: config.image,
    Cmd: ['sh', '-c', buildCommand(code, input, config)],
    HostConfig: {
      Memory: config.memory,
      MemorySwap: config.memory, // No swap
      CpuPeriod: 100000,
      CpuQuota: 100000,          // 1 CPU core
      PidsLimit: 64,
      NetworkMode: 'none',       // No network access
      ReadonlyRootfs: true,
      Tmpfs: {
        '/tmp': 'rw,noexec,nosuid,size=64m',
      },
      SecurityOpt: ['seccomp=./docker/seccomp-profile.json'],
    },
    WorkingDir: '/tmp',
    StopTimeout: 0,
  });

  try {
    await container.start();

    // Wait for completion with timeout
    const timeout = config.compile
      ? config.timeout.compile + config.timeout.run
      : config.timeout.run;

    const waitPromise = container.wait();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeout),
    );

    let exitCode = 0;
    let timedOut = false;

    try {
      const result = await Promise.race([waitPromise, timeoutPromise]);
      exitCode = (result as any).StatusCode ?? 1;
    } catch {
      timedOut = true;
      try {
        await container.kill();
      } catch {
        // Container may have already exited
      }
    }

    // Capture output
    const logs = await container.logs({ stdout: true, stderr: true });
    const output = logs.toString('utf-8');

    // Split stdout and stderr (Docker multiplexes them)
    const stdout = output; // Simplified — in production, parse Docker stream headers
    const stderr = '';

    const runtime = Date.now() - startTime;

    return { stdout, stderr, exitCode, timedOut, runtime };
  } finally {
    // Always clean up the container
    try {
      await container.remove({ force: true });
    } catch {
      // Ignore removal errors
    }
  }
}

/**
 * Build the shell command that writes code, compiles (if needed), and runs.
 */
function buildCommand(code: string, input: string, config: LanguageConfig): string {
  const escapedCode = code.replace(/'/g, "'\\''");
  const escapedInput = input.replace(/'/g, "'\\''");

  let cmd = `echo '${escapedCode}' > /tmp/${config.sourceFile}`;

  if (config.compile) {
    cmd += ` && ${config.compile}`;
  }

  cmd += ` && echo '${escapedInput}' | ${config.run}`;

  return cmd;
}

/**
 * Process a full judge request: run code against all test cases.
 */
export async function processJudgeRequest(request: JudgeRequest): Promise<JudgeResult> {
  const config = languageConfigs[request.language];

  if (!config) {
    return {
      submissionId: request.submissionId,
      verdict: 'COMPILATION_ERROR' as Verdict,
      runtime: null,
      memory: null,
      testResults: [],
      passedTests: 0,
      totalTests: request.testCases.length,
      compileError: `Unsupported language: ${request.language}`,
    };
  }

  const testResults: TestCaseResult[] = [];
  let overallVerdict: Verdict = 'ACCEPTED';
  let maxRuntime = 0;
  let maxMemory = 0;
  let passedTests = 0;

  for (const testCase of request.testCases) {
    const result = await executeInContainer(request.code, testCase.input, config);

    let verdict: Verdict;

    if (result.timedOut) {
      verdict = 'TIME_LIMIT_EXCEEDED';
    } else if (result.exitCode !== 0) {
      if (result.stderr.includes('compilation') || result.stderr.includes('error:')) {
        verdict = 'COMPILATION_ERROR';
      } else {
        verdict = 'RUNTIME_ERROR';
      }
    } else {
      const isCorrect = validateOutput(
        testCase.expectedOutput,
        result.stdout,
        'exact',
      );
      verdict = isCorrect ? 'ACCEPTED' : 'WRONG_ANSWER';
    }

    const tcResult: TestCaseResult = {
      testCaseId: testCase.id,
      verdict,
      runtime: result.runtime,
      memory: 0, // TODO: capture from cgroup stats
    };

    testResults.push(tcResult);

    if (verdict === 'ACCEPTED') {
      passedTests++;
    }

    maxRuntime = Math.max(maxRuntime, result.runtime);

    // Early termination on first failure (for match mode)
    if (verdict !== 'ACCEPTED') {
      overallVerdict = verdict;
      // Continue running remaining tests for detailed feedback
    }
  }

  if (passedTests === request.testCases.length) {
    overallVerdict = 'ACCEPTED';
  }

  return {
    submissionId: request.submissionId,
    verdict: overallVerdict,
    runtime: maxRuntime,
    memory: maxMemory,
    testResults,
    passedTests,
    totalTests: request.testCases.length,
  };
}
