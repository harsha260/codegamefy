import { ELO_DEFAULTS } from '../constants';

const { GLICKO2_TAU: TAU, CONVERGENCE_TOLERANCE: EPSILON, GLICKO2_SCALE } = ELO_DEFAULTS;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface Glicko2Rating {
  mu: number;       // Rating on Glicko-2 internal scale
  phi: number;      // Rating deviation on Glicko-2 internal scale
  sigma: number;    // Volatility
}

export interface Glicko2Opponent {
  mu: number;
  phi: number;
  score: number;    // 1 = win, 0.5 = draw, 0 = loss
}

export interface DisplayRating {
  rating: number;
  rd: number;
  volatility: number;
}

// ─────────────────────────────────────────────
// Scale Conversion
// ─────────────────────────────────────────────

/**
 * Convert from display rating (1500-centered) to Glicko-2 internal scale.
 */
export function toGlicko2Scale(rating: number, rd: number): { mu: number; phi: number } {
  return {
    mu: (rating - 1500) / GLICKO2_SCALE,
    phi: rd / GLICKO2_SCALE,
  };
}

/**
 * Convert from Glicko-2 internal scale back to display rating.
 */
export function fromGlicko2Scale(mu: number, phi: number): { rating: number; rd: number } {
  return {
    rating: mu * GLICKO2_SCALE + 1500,
    rd: phi * GLICKO2_SCALE,
  };
}

// ─────────────────────────────────────────────
// Core Glicko-2 Functions
// ─────────────────────────────────────────────

/**
 * g(φ) — Reduces impact of opponents with high rating uncertainty.
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
}

/**
 * E(μ, μj, φj) — Expected score against opponent j.
 */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Compute new volatility σ' using the Illinois algorithm.
 * This is Step 5 of the Glicko-2 algorithm.
 */
function computeNewVolatility(
  sigma: number,
  phi: number,
  v: number,
  delta: number,
): number {
  const a = Math.log(sigma * sigma);
  const deltaSq = delta * delta;
  const phiSq = phi * phi;

  function f(x: number): number {
    const ex = Math.exp(x);
    const num1 = ex * (deltaSq - phiSq - v - ex);
    const den1 = 2 * Math.pow(phiSq + v + ex, 2);
    const num2 = x - a;
    const den2 = TAU * TAU;
    return num1 / den1 - num2 / den2;
  }

  // Initialize bounds A and B
  let A = a;
  let B: number;

  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k++;
    }
    B = a - k * TAU;
  }

  // Illinois algorithm iteration
  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

// ─────────────────────────────────────────────
// Main Rating Update
// ─────────────────────────────────────────────

/**
 * Full Glicko-2 rating update algorithm.
 *
 * @param player - Current player rating (internal scale)
 * @param opponents - Array of opponents faced in this rating period
 * @returns Updated rating (internal scale)
 */
export function updateRating(
  player: Glicko2Rating,
  opponents: Glicko2Opponent[],
): Glicko2Rating {
  // If no games played, only RD increases (Step 6 shortcut)
  if (opponents.length === 0) {
    const newPhi = Math.sqrt(player.phi * player.phi + player.sigma * player.sigma);
    return { ...player, phi: newPhi };
  }

  // Step 3: Compute estimated variance v
  let vInv = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = E(player.mu, opp.mu, opp.phi);
    vInv += gPhi * gPhi * e * (1 - e);
  }
  const v = 1 / vInv;

  // Step 4: Compute estimated improvement delta
  let deltaSum = 0;
  for (const opp of opponents) {
    deltaSum += g(opp.phi) * (opp.score - E(player.mu, opp.mu, opp.phi));
  }
  const delta = v * deltaSum;

  // Step 5: Compute new volatility
  const newSigma = computeNewVolatility(player.sigma, player.phi, v, delta);

  // Step 6: Update RD to pre-rating period value
  const phiStar = Math.sqrt(player.phi * player.phi + newSigma * newSigma);

  // Step 7: Compute new rating and RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = player.mu + newPhi * newPhi * deltaSum;

  return {
    mu: newMu,
    phi: newPhi,
    sigma: newSigma,
  };
}

// ─────────────────────────────────────────────
// High-Level API for CodeArena
// ─────────────────────────────────────────────

/**
 * Process a match result and return updated display ratings.
 *
 * @param playerRating - Player's current display rating
 * @param opponentRating - Opponent's current display rating
 * @param score - 1 = win, 0.5 = draw, 0 = loss
 * @returns Updated display rating for the player
 */
export function processMatchResult(
  playerRating: DisplayRating,
  opponentRating: { rating: number; rd: number },
  score: number,
): DisplayRating {
  // Convert to Glicko-2 scale
  const player: Glicko2Rating = {
    ...toGlicko2Scale(playerRating.rating, playerRating.rd),
    sigma: playerRating.volatility,
  };

  const opponent: Glicko2Opponent = {
    ...toGlicko2Scale(opponentRating.rating, opponentRating.rd),
    score,
  };

  // Run Glicko-2 update
  const updated = updateRating(player, [opponent]);

  // Convert back to display scale
  const display = fromGlicko2Scale(updated.mu, updated.phi);

  return {
    rating: Math.round(display.rating),
    rd: Math.round(display.rd * 100) / 100,
    volatility: Math.round(updated.sigma * 10000) / 10000,
  };
}

/**
 * Process a multi-opponent result (e.g., Battle Royale placement).
 * Each opponent is treated as a separate game within the same rating period.
 *
 * @param playerRating - Player's current display rating
 * @param results - Array of opponents with scores
 * @returns Updated display rating
 */
export function processMultiOpponentResult(
  playerRating: DisplayRating,
  results: Array<{ rating: number; rd: number; score: number }>,
): DisplayRating {
  const player: Glicko2Rating = {
    ...toGlicko2Scale(playerRating.rating, playerRating.rd),
    sigma: playerRating.volatility,
  };

  const opponents: Glicko2Opponent[] = results.map(r => ({
    ...toGlicko2Scale(r.rating, r.rd),
    score: r.score,
  }));

  const updated = updateRating(player, opponents);
  const display = fromGlicko2Scale(updated.mu, updated.phi);

  return {
    rating: Math.round(display.rating),
    rd: Math.round(display.rd * 100) / 100,
    volatility: Math.round(updated.sigma * 10000) / 10000,
  };
}

/**
 * Compute composite rating from all four dimensions.
 */
export function computeCompositeRating(ratings: {
  algoRating: number;
  debugRating: number;
  optRating: number;
  speedRating: number;
}): number {
  return Math.round(
    ratings.algoRating * 0.35 +
    ratings.speedRating * 0.25 +
    ratings.debugRating * 0.20 +
    ratings.optRating * 0.20,
  );
}
