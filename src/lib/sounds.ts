/**
 * Short sound effects. The audio player is native code: an app build made before it was added does not
 * contain it, and importing it directly would crash the whole app. So it is loaded here, when first
 * needed, and a build without it simply stays silent.
 */
import { requireOptionalNativeModule } from 'expo';

type AudioModule = typeof import('expo-audio');
type Player = ReturnType<AudioModule['createAudioPlayer']>;

const SOURCES = {
  /** a quick bubbly pour, the moment water is added */
  waterAdd: require('@/assets/sounds/water-add.wav'),
  /** a soft rising chime, as the body fills */
  waterFill: require('@/assets/sounds/water-fill.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

let audio: AudioModule | null | undefined;
const players: Partial<Record<SoundName, Player>> = {};

function load(): AudioModule | null {
  if (audio !== undefined) return audio;
  // Ask first whether this build has the native player. Requiring the library without it throws, and the
  // bundler reports that error even when it is caught.
  if (!requireOptionalNativeModule('ExpoAudio')) {
    audio = null;
    return audio;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio') as AudioModule;
    // Effects sit on top of the member's own music and stay quiet when the phone is on silent.
    void audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  } catch {
    audio = null;
  }
  return audio;
}

/** Plays a sound from its start. Never throws: a sound that cannot play is skipped. */
export function playSound(name: SoundName, volume = 1) {
  try {
    const mod = load();
    if (!mod) return;
    const player = (players[name] ??= mod.createAudioPlayer(SOURCES[name]));
    player.volume = volume;
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // no sound is better than a crash
  }
}
