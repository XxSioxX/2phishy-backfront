import Phaser from 'phaser';
import { AudioKey, getAudioRoute, MusicKey, SfxKey } from './soundRegistry';

export type AudioVolumeKind = 'master' | 'music' | 'sfx';

export type AudioVolumeSettings = Record<AudioVolumeKind, number>;

const AUDIO_VOLUME_STORAGE_KEY = 'phishy:audio-volume-settings';
const DEFAULT_VOLUME_SETTINGS: AudioVolumeSettings = {
  master: 1,
  music: 1,
  sfx: 1,
};

export class AudioManager {
  private static currentMusic?: Phaser.Sound.BaseSound;
  private static currentMusicKey?: MusicKey;
  private static currentMusicRouteVolume = 1;
  private static volumeSettings = AudioManager.loadVolumeSettings();

  static playSfx(
    scene: Phaser.Scene,
    key: SfxKey,
    config: Phaser.Types.Sound.SoundConfig = {}
  ): void {
    if (!this.canPlay(scene, key)) return;

    const route = getAudioRoute(key);
    const baseVolume = config.volume ?? route.volume ?? 1;
    scene.sound.play(key, {
      ...config,
      volume: this.getEffectiveSfxVolume(baseVolume),
      loop: config.loop ?? route.loop ?? false,
    });
  }

  static playSfxInstance(
    scene: Phaser.Scene,
    key: SfxKey,
    config: Phaser.Types.Sound.SoundConfig = {}
  ): Phaser.Sound.BaseSound | undefined {
    if (!this.canPlay(scene, key)) return undefined;

    const route = getAudioRoute(key);
    const baseVolume = config.volume ?? route.volume ?? 1;
    const sound = scene.sound.add(key, {
      ...config,
      volume: this.getEffectiveSfxVolume(baseVolume),
      loop: config.loop ?? route.loop ?? false,
    });
    sound.play();
    return sound;
  }

  static playMusic(scene: Phaser.Scene, key: MusicKey): void {
    if (this.currentMusicKey === key && this.currentMusic?.isPlaying) return;
    if (!this.canPlay(scene, key)) return;

    this.stopMusic();

    const route = getAudioRoute(key);
    this.currentMusicRouteVolume = route.volume ?? 1;
    this.currentMusic = scene.sound.add(key, {
      volume: this.getEffectiveMusicVolume(this.currentMusicRouteVolume),
      loop: route.loop ?? true,
    });
    this.currentMusicKey = key;
    this.currentMusic.play();
  }

  static stopMusic(): void {
    this.currentMusic?.stop();
    this.currentMusic?.destroy();
    this.currentMusic = undefined;
    this.currentMusicKey = undefined;
    this.currentMusicRouteVolume = 1;
  }

  static getVolumeSettings(): AudioVolumeSettings {
    return { ...this.volumeSettings };
  }

  static setVolume(kind: AudioVolumeKind, value: number): void {
    this.volumeSettings = {
      ...this.volumeSettings,
      [kind]: this.clampVolume(value),
    };
    this.saveVolumeSettings();
    this.applyCurrentMusicVolume();
  }

  private static canPlay(scene: Phaser.Scene, key: AudioKey): boolean {
    const route = getAudioRoute(key);
    if (!route?.src) return false;
    return scene.cache.audio.exists(key);
  }

  private static getEffectiveSfxVolume(baseVolume: number): number {
    return this.clampVolume(
      baseVolume * this.volumeSettings.master * this.volumeSettings.sfx
    );
  }

  private static getEffectiveMusicVolume(baseVolume: number): number {
    return this.clampVolume(
      baseVolume * this.volumeSettings.master * this.volumeSettings.music
    );
  }

  private static applyCurrentMusicVolume(): void {
    if (!this.currentMusic) return;

    const volume = this.getEffectiveMusicVolume(this.currentMusicRouteVolume);
    const adjustableSound = this.currentMusic as Phaser.Sound.BaseSound & {
      setVolume?: (value: number) => Phaser.Sound.BaseSound;
      volume?: number;
    };

    if (typeof adjustableSound.setVolume === 'function') {
      adjustableSound.setVolume(volume);
      return;
    }

    adjustableSound.volume = volume;
  }

  private static loadVolumeSettings(): AudioVolumeSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_VOLUME_SETTINGS };

    try {
      const saved = window.localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY);
      if (!saved) return { ...DEFAULT_VOLUME_SETTINGS };

      const parsed = JSON.parse(saved) as Partial<AudioVolumeSettings>;
      return {
        master: this.clampVolume(parsed.master ?? DEFAULT_VOLUME_SETTINGS.master),
        music: this.clampVolume(parsed.music ?? DEFAULT_VOLUME_SETTINGS.music),
        sfx: this.clampVolume(parsed.sfx ?? DEFAULT_VOLUME_SETTINGS.sfx),
      };
    } catch {
      return { ...DEFAULT_VOLUME_SETTINGS };
    }
  }

  private static saveVolumeSettings(): void {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        AUDIO_VOLUME_STORAGE_KEY,
        JSON.stringify(this.volumeSettings)
      );
    } catch {
      // Volume changes still apply for the current session if localStorage is blocked.
    }
  }

  private static clampVolume(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Phaser.Math.Clamp(value, 0, 1);
  }
}
