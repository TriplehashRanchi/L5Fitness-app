import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceClock } from '@/hooks/use-device-clock';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { createMeal, MEAL_LABEL, uploadPhoto, type MealType } from '@/lib/fitness-api';
import { ApiError, messageFrom, NetworkError } from '@/lib/http';

type ImagePickerModule = typeof import('expo-image-picker');

let picker: ImagePickerModule | null | undefined;
/**
 * The photo picker is native code. An app build made before it was added does not contain it,
 * and importing it directly would crash the whole app. So it is loaded here, when needed, and a
 * missing one becomes a clear message instead.
 */
function loadPicker(): ImagePickerModule | null {
  if (picker !== undefined) return picker;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    picker = require('expo-image-picker') as ImagePickerModule;
  } catch {
    picker = null;
  }
  return picker;
}

const BRAND = '#c6f432';
const MUTED = '#8b8b94';
const TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** A sensible starting choice from the time of day. */
function guessType(hour: number): MealType {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

type Photo = { uri: string; mimeType?: string | null };

export default function AddMealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { format } = useDeviceClock();

  const [mealType, setMealType] = useState<MealType>(() => guessType(new Date().getHours()));
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);

  const canSave = !busy && (photo !== null || note.trim().length > 0);

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    setNeedsSettings(false);
    const ImagePicker = loadPicker();
    if (!ImagePicker) {
      setError('Photos need the latest version of the L5 Fitness app. Install the newest build, then try again.');
      return;
    }
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Camera access is turned off for L5 Fitness.');
          setNeedsSettings(permission.canAskAgain === false);
          return;
        }
      }
      // Quality 0.7 keeps a phone photo around 1 to 2 MB: sharp enough for a meal, quick to upload.
      const options: import('expo-image-picker').ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, mimeType: asset.mimeType });
    } catch {
      setError('Could not open the ' + (source === 'camera' ? 'camera' : 'photo library') + '. Please try again.');
    }
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const uploadId = photo ? await uploadPhoto(photo.uri, photo.mimeType) : undefined;
      const when = new Date();
      await createMeal({
        mealType,
        note: note.trim() || undefined,
        uploadId,
        eatenAt: when.toISOString(),
        // The calendar day on the phone, so the meal lands on the right day in any time zone.
        day: toDayKey(getZonedParts(when, format.timeZone)),
      });
      router.back(); // Home reloads when it comes back into view
    } catch (e) {
      // Photo problems already carry a clear sentence; server and network errors go through messageFrom.
      setError(e instanceof ApiError || e instanceof NetworkError ? messageFrom(e) : e instanceof Error ? e.message : messageFrom(e));
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
          <View className="flex-row items-center justify-between px-5 pb-4">
            <Text className="text-2xl font-bold text-white">Add meal</Text>
            <Pressable
              onPress={() => router.back()}
              disabled={busy}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-70">
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="white" size={16} />
            </Pressable>
          </View>

          <Text className="mb-6 px-5 text-sm leading-5 text-muted">A photo or a quick note. Keep it simple.</Text>

          {/* Meal type */}
          <View className="flex-row flex-wrap gap-2 px-5">
            {TYPES.map((type) => {
              const selected = type === mealType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setMealType(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`rounded-full px-5 py-2.5 ${selected ? 'bg-white' : 'bg-card'}`}>
                  <Text maxFontSizeMultiplier={1.3} className={`text-sm font-semibold ${selected ? 'text-ink' : 'text-muted'}`}>
                    {MEAL_LABEL[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Photo */}
          <View className="mt-5 px-5">
            {photo ? (
              <View className="overflow-hidden rounded-3xl border border-white/5 bg-card">
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: '100%', aspectRatio: 4 / 3 }}
                  contentFit="cover"
                  accessibilityLabel="Your meal photo"
                  accessibilityIgnoresInvertColors
                />
                <Pressable
                  onPress={() => setPhoto(null)}
                  disabled={busy}
                  accessibilityRole="button"
                  className="absolute right-3 top-3 flex-row items-center gap-1.5 rounded-full bg-black/70 px-3.5 py-2 active:opacity-70">
                  <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor="white" size={14} />
                  <Text maxFontSizeMultiplier={1.3} className="text-xs font-bold text-white">
                    Remove
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="rounded-3xl border border-white/10 bg-card p-6">
                <View className="items-center">
                  <SymbolView name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} tintColor={BRAND} size={30} />
                  <Text className="mt-3 text-base font-bold text-white">Add a photo of your meal</Text>
                  <Text className="mt-1 text-center text-sm text-muted">Optional if you write a note.</Text>
                </View>
                <View className="mt-5 flex-row gap-3">
                  {Platform.OS !== 'web' ? (
                    <Pressable
                      onPress={() => pick('camera')}
                      accessibilityRole="button"
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-brand py-3 active:opacity-80">
                      <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} tintColor="#0b0b0d" size={16} />
                      <Text maxFontSizeMultiplier={1.3} className="font-bold text-ink">
                        Take photo
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => pick('library')}
                    accessibilityRole="button"
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-full border border-white/15 py-3 active:opacity-70">
                    <SymbolView name={{ ios: 'photo', android: 'photo_library', web: 'photo_library' }} tintColor="white" size={16} />
                    <Text maxFontSizeMultiplier={1.3} className="font-bold text-white">
                      Choose photo
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Note */}
          <View className="mt-5 px-5">
            <Text className="mb-2 text-sm font-semibold text-white">Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What did you eat?"
              placeholderTextColor="#7c8592"
              selectionColor={BRAND}
              cursorColor={BRAND}
              maxLength={200}
              multiline
              editable={!busy}
              maxFontSizeMultiplier={1.4}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
              className="rounded-2xl border border-white/10 bg-card px-4 py-3 text-base text-white"
            />
            <Text className="mt-1 self-end text-xs text-muted">{note.length}/200</Text>
          </View>

          {error ? (
            <View accessibilityRole="alert" className="mx-5 mt-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
              <Text className="text-sm text-white">{error}</Text>
              {needsSettings ? (
                <Pressable onPress={() => Linking.openSettings()} hitSlop={8} accessibilityRole="button">
                  <Text className="mt-1 text-sm font-bold text-brand">Open settings</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View className="mt-6 px-5">
            <Pressable
              onPress={save}
              disabled={!canSave}
              accessibilityRole="button"
              className={`items-center rounded-full py-4 active:opacity-80 ${canSave ? 'bg-brand' : 'bg-card-2'}`}>
              {busy ? (
                <ActivityIndicator color="#0b0b0d" />
              ) : (
                <Text maxFontSizeMultiplier={1.3} className={`text-base font-bold ${canSave ? 'text-ink' : 'text-muted'}`}>
                  Save meal
                </Text>
              )}
            </Pressable>
            <Text className="mt-3 text-center text-xs" style={{ color: MUTED }}>
              Saved to your account. You can delete it any time.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
