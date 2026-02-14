import { Howl } from 'howler';

type SoundId =
  | 'ui_click'
  | 'ui_hover'
  | 'test_pass'
  | 'test_fail'
  | 'solve_complete'
  | 'lockout_claim'
  | 'lockout_stolen'
  | 'match_found'
  | 'match_start'
  | 'match_win'
  | 'match_lose'
  | 'timer_warning'
  | 'timer_critical'
  | 'eliminate'
  | 'rank_up'
  | 'elo_gain'
  | 'elo_loss';

interface SoundConfig {
  src: string;
  volume: number;
  loop?: boolean;
}

const SOUNDS: Record<SoundId, SoundConfig> = {
  ui_click: { src: '/sounds/click.ogg', volume: 0.3 },
  ui_hover: { src: '/sounds/hover.ogg', volume: 0.2 },
  test_pass: { src: '/sounds/chime_up.ogg', volume: 0.6 },
  test_fail: { src: '/sounds/buzz.ogg', volume: 0.5 },
  solve_complete: { src: '/sounds/fanfare.ogg', volume: 0.7 },
  lockout_claim: { src: '/sounds/lock_claim.ogg', volume: 0.7 },
  lockout_stolen: { src: '/sounds/lock_stolen.ogg', volume: 0.6 },
  match_found: { src: '/sounds/queue_pop.ogg', volume: 0.8 },
  match_start: { src: '/sounds/horn.ogg', volume: 0.7 },
  match_win: { src: '/sounds/victory.ogg', volume: 0.8 },
  match_lose: { src: '/sounds/defeat.ogg', volume: 0.6 },
  timer_warning: { src: '/sounds/tick.ogg', volume: 0.4, loop: true },
  timer_critical: { src: '/sounds/tick_fast.ogg', volume: 0.5, loop: true },
  eliminate: { src: '/sounds/bass_drop.ogg', volume: 0.8 },
  rank_up: { src: '/sounds/rank_up.ogg', volume: 0.8 },
  elo_gain: { src: '/sounds/elo_up.ogg', volume: 0.5 },
  elo_loss: { src: '/sounds/elo_down.ogg', volume: 0.4 },
};

class AudioManager {
  private sounds: Map<SoundId, Howl> = new Map();
  private masterVolume = 0.5;
  private muted = false;

  constructor() {
    // Lazy-load sounds on first use
  }

  private getSound(id: SoundId): Howl {
    let sound = this.sounds.get(id);
    if (!sound) {
      const config = SOUNDS[id];
      sound = new Howl({
        src: [config.src],
        volume: config.volume * this.masterVolume,
        loop: config.loop ?? false,
        preload: true,
      });
      this.sounds.set(id, sound);
    }
    return sound;
  }

  play(id: SoundId): void {
    if (this.muted) return;
    const sound = this.getSound(id);
    sound.play();
  }

  stop(id: SoundId): void {
    const sound = this.sounds.get(id);
    sound?.stop();
  }

  /**
   * Play test_pass with increasing pitch for consecutive passes.
   * Creates an ascending scale effect for clean sweeps.
   */
  playTestPass(consecutiveIndex: number): void {
    if (this.muted) return;
    const sound = this.getSound('test_pass');
    const rate = 1 + consecutiveIndex * 0.1; // Increase pitch by 10% per consecutive pass
    sound.rate(Math.min(rate, 2.0)); // Cap at 2x
    sound.play();
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    // Update all loaded sounds
    for (const [id, sound] of this.sounds) {
      const config = SOUNDS[id];
      sound.volume(config.volume * this.masterVolume);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      // Stop all currently playing sounds
      for (const sound of this.sounds.values()) {
        sound.stop();
      }
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

// Singleton instance
export const audioManager = new AudioManager();
