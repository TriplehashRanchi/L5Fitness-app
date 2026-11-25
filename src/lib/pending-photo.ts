/**
 * A photo that was taken while Android had closed the app behind the camera.
 *
 * To take a photo the phone leaves this app and opens its own camera. Many phones then close this app
 * to give the camera its memory, and start it again when the camera is done: the member lands back at
 * the start and the photo they just took would be lost.
 *
 * Two ways to get it back, tried in this order when the app starts:
 *   1. the photo picker keeps the answer it could not deliver (`getPendingResultAsync`);
 *   2. the camera wrote the picture into this app's own cache folder before the app was closed. A note
 *      saved just before the camera opened (`markCameraOpening`) says "a photo was being taken at this
 *      time"; if that note is still there at the next start, the newest picture in that folder from
 *      after that time is the one.
 * Either way the Add meal screen opens again with the photo already in it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type RecoveredPhoto = { uri: string; mimeType?: string | null };

const NOTE = 'l5-camera-open-since';
/** The photo picker's folder inside the app's cache (its own constant, CACHE_DIR_NAME). */
const PICKER_FOLDER = 'ImagePicker';
/** A note older than this is from some earlier day and no longer means anything. */
const NOTE_MAX_AGE_MS = 30 * 60_000;

let recovered: RecoveredPhoto | null = null;
let asked: Promise<boolean> | null = null;

/** Call right before the camera opens. */
export const markCameraOpening = () => AsyncStorage.setItem(NOTE, String(Date.now())).catch(() => {});
/** Call when the camera has answered (a photo, or the member closed it): nothing was lost. */
export const markCameraDone = () => AsyncStorage.removeItem(NOTE).catch(() => {});

async function fromPicker(): Promise<RecoveredPhoto | null> {
  // Loaded here, not at the top: a build made before the picker was added does not contain it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const result = await ImagePicker.getPendingResultAsync();
  const asset = result && 'assets' in result && !result.canceled ? result.assets?.[0] : null;
  return asset?.uri ? { uri: asset.uri, mimeType: asset.mimeType } : null;
}

async function fromCacheFolder(): Promise<RecoveredPhoto | null> {
  const since = Number(await AsyncStorage.getItem(NOTE));
  if (!since || Date.now() - since > NOTE_MAX_AGE_MS) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Directory, File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  const folder = new Directory(Paths.cache, PICKER_FOLDER);
  if (!folder.exists) return null;
  let newest: { uri: string; at: number } | null = null;
  for (const item of folder.list()) {
    if (!(item instanceof File)) continue;
    const info = item.info();
    // The picker makes an empty file before the camera opens; it only has content once a photo was taken.
    if (!info.exists || !info.size || !info.modificationTime || info.modificationTime < since - 2000) continue;
    if (!newest || info.modificationTime > newest.at) newest = { uri: item.uri, at: info.modificationTime };
  }
  return newest ? { uri: newest.uri, mimeType: 'image/jpeg' } : null;
}

/** True when a photo was waiting. Asked once per start of the app; later calls get the same answer. */
export function checkPendingPhoto(): Promise<boolean> {
  asked ??= (async () => {
    if (Platform.OS !== 'android') return false;
    try {
      recovered = (await fromPicker().catch(() => null)) ?? (await fromCacheFolder().catch(() => null));
    } finally {
      await markCameraDone();
    }
    return recovered !== null;
  })();
  return asked;
}

/** Hands over the waiting photo, once. */
export function takeRecoveredPhoto(): RecoveredPhoto | null {
  const photo = recovered;
  recovered = null;
  return photo;
}
