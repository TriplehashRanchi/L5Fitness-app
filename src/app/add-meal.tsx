import { Image } from 'expo-image';
import { DisplayText } from '@/components/display-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
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

import { FoodPicker } from '@/components/food-picker';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { useFoods } from '@/hooks/use-foods';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { getAiStatus } from '@/lib/ai-api';
import { saveMeal, uploadPhoto, type MealType } from '@/lib/fitness-api';
import { suggestFromPhoto, type PlateItem } from '@/lib/foods-api';
import { useLanguage } from '@/providers/language-provider';
import { ApiError, messageFrom, NetworkError } from '@/lib/http';
import { checkPendingPhoto, markCameraDone, markCameraOpening, takeRecoveredPhoto } from '@/lib/pending-photo';

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

const BRAND = '#3ddc68';
/** A neutral grey for buttons and the note box, where the green card colour used to be. */
const SOFT = 'rgba(255,255,255,0.08)';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const MUTED = '#8fa396';
const INK = '#050a07';
/** A small picture for each meal, so the four choices can be told apart at a glance. */
const MEAL_ICON: Record<MealType, SymbolViewProps['name']> = {
  breakfast: { ios: 'sunrise.fill', android: 'wb_twilight', web: 'wb_twilight' },
  lunch: { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' },
  snack: { ios: 'cup.and.saucer.fill', android: 'local_cafe', web: 'local_cafe' },
  dinner: { ios: 'moon.stars.fill', android: 'dark_mode', web: 'dark_mode' },
};
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
  const { language, t } = useLanguage();
  const english = language === 'en';
  const insets = useSafeAreaInsets();
  const { format } = useDeviceClock();
  const { foods, byId } = useFoods();
  const [items, setItems] = useState<PlateItem[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(false);
  /** Is the photo-reading assistant switched on at the server? Asked once. */
  const [canSuggest, setCanSuggest] = useState(false);
  useEffect(() => {
    getAiStatus().then((s) => setCanSuggest(s.enabled)).catch(() => {});
  }, []);

  // Opened from a meal's own tile (Today's plan), that meal is already chosen.
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [mealType, setMealType] = useState<MealType>(() =>
    TYPES.includes(type as MealType) ? (type as MealType) : guessType(new Date().getHours())
  );
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);
  /** The photo on screen was brought back after the phone had closed the app behind the camera. */
  const [restored, setRestored] = useState(false);
  /** The photo already uploaded, so a retry after a failed save does not upload it again. */
  const uploaded = useRef<{ uri: string; id: string } | null>(null);

  const canSave = !busy && (photo !== null || note.trim().length > 0 || items.length > 0);

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    setNeedsSettings(false);
    const ImagePicker = loadPicker();
    if (!ImagePicker) {
      setError(t('acc.photoNewBuild'));
      return;
    }
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(t('acc.cameraOff'));
          setNeedsSettings(permission.canAskAgain === false);
          return;
        }
      }
      // From the library: quality 0.7 keeps a photo around 1 to 2 MB, sharp enough for a meal and quick to upload.
      // From the camera: quality 1, on purpose. With anything lower the picker opens the whole picture in the
      // phone's memory to shrink it, and a fresh full-size camera photo is big enough for Android to close the
      // app at that moment (the member was thrown out right after taking the photo). At 1 the file is only copied.
      const options: import('expo-image-picker').ImagePickerOptions = { mediaTypes: ['images'], quality: source === 'camera' ? 1 : 0.7, exif: false };
      let result: import('expo-image-picker').ImagePickerResult;
      if (source === 'camera') {
        // A note that a photo is being taken: if the phone closes the app behind the camera, the next
        // start finds the note and brings the photo back (see lib/pending-photo).
        await markCameraOpening();
        try {
          result = await ImagePicker.launchCameraAsync(options);
        } finally {
          void markCameraDone();
        }
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, mimeType: asset.mimeType });
    } catch {
      setError(t(source === 'camera' ? 'acc.cameraFailed' : 'acc.libraryFailed'));
    }
  };

  // The camera is never opened by itself: the member chooses "Take photo" or "Choose photo" here.
  // One thing is checked when the screen opens: if Android closed the app while the camera was open,
  // the photo that was taken is waiting, and it goes straight into this screen.
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    void checkPendingPhoto().then(() => {
      const waiting = takeRecoveredPhoto();
      if (!waiting) return;
      setPhoto(waiting);
      setRestored(true);
    });
  }, []);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      let uploadId: string | undefined;
      if (photo) {
        if (uploaded.current?.uri !== photo.uri) {
          uploaded.current = { uri: photo.uri, id: await uploadPhoto(photo.uri, photo.mimeType) };
        }
        uploadId = uploaded.current.id;
      }
      const when = new Date();
      // With no signal, a meal without a photo is kept on the phone and sent later (the Home screen says so).
      await saveMeal({
        mealType,
        note: note.trim() || undefined,
        uploadId,
        items: items.length ? items.map(({ foodId, portionId, count, oil, coconut }) => ({ foodId, portionId, count, oil, coconut })) : undefined,
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

  /** Looks at the photo and proposes foods. Nothing is saved: the member checks each one and changes what is wrong. */
  const suggest = async () => {
    if (!photo || suggesting) return;
    setSuggesting(true);
    setError(null);
    try {
      if (uploaded.current?.uri !== photo.uri) uploaded.current = { uri: photo.uri, id: await uploadPhoto(photo.uri, photo.mimeType) };
      const { suggestions } = await suggestFromPhoto(uploaded.current.id);
      const next: PlateItem[] = suggestions.map((s) => ({ foodId: s.foodId, portionId: s.portionId, count: s.count, oil: 'usual', coconut: 'usual' }));
      // What the member already added stays; a suggested food they already have is not added twice.
      setItems((now) => [...now, ...next.filter((n) => !now.some((x) => x.foodId === n.foodId))]);
      setSuggested(true);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setSuggesting(false);
    }
  };

  const sourceTile = (source: 'camera' | 'library', primary: boolean) => {
    const camera = source === 'camera';
    return (
      <Pressable
        onPress={() => void pick(source)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t(camera ? 'acc.takeA11y' : 'acc.chooseA11y')}
        className="flex-1 items-center justify-center active:opacity-80"
        style={{ minHeight: 112, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 26, gap: 10, backgroundColor: primary ? BRAND : SOFT }}>
        <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: primary ? 'rgba(5,10,7,0.12)' : 'rgba(255,255,255,0.08)' }}>
          <SymbolView
            name={camera ? { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' } : { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }}
            tintColor={primary ? INK : '#ffffff'}
            size={20}
          />
        </View>
        <Text maxFontSizeMultiplier={1.3} className="text-center text-sm font-bold" style={{ color: primary ? INK : '#ffffff' }}>
          {camera ? t('meal.takePhoto') : t('meal.choosePhoto')}
        </Text>
      </Pressable>
    );
  };
  // The camera does not exist in a browser, so there the one choice is the library.
  const canShoot = Platform.OS !== 'web';

  return (
    // A plain black page like Steps and Today's plan: no green haze, no green cards.
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <View className="flex-row items-center justify-between px-5">
            <View className="flex-1">
              <DisplayText className="text-[28px] tracking-tight text-white">{t('meal.title')}</DisplayText>
              <Text className="mt-0.5 text-sm text-muted">{t('meal.sub')}</Text>
            </View>
            <Pressable
              onPress={() => router.back()}
              disabled={busy}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
              style={{ backgroundColor: SOFT }}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="white" size={16} />
            </Pressable>
          </View>

          {/* The photo: two clear choices until there is one, then the picture itself. */}
          <View className="mt-6 px-5">
            {photo ? (
              <View className="overflow-hidden" style={{ borderRadius: 28 }}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: '100%', aspectRatio: 4 / 3 }}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel={t('acc.photoA11y')}
                  accessibilityIgnoresInvertColors
                />
                <View className="absolute flex-row" style={{ right: 12, bottom: 12, gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setRestored(false);
                      setPhoto(null);
                    }}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t('acc.changePhoto')}
                    className="flex-row items-center rounded-full active:opacity-70"
                    style={{ gap: 6, minHeight: 40, paddingHorizontal: 14, backgroundColor: 'rgba(0,0,0,0.72)' }}>
                    <SymbolView name={{ ios: 'arrow.triangle.2.circlepath', android: 'autorenew', web: 'autorenew' }} tintColor="white" size={14} />
                    <Text maxFontSizeMultiplier={1.3} className="text-[13px] font-bold text-white">
                      {t('acc.change')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="flex-row" style={{ gap: 12 }}>
                {canShoot ? sourceTile('camera', true) : null}
                {sourceTile('library', !canShoot)}
              </View>
            )}
            {restored && photo ? (
              <Text accessibilityLiveRegion="polite" className="mt-3 text-[13px] leading-5 text-muted">
                {t('acc.restored')}
              </Text>
            ) : null}
          </View>

          {/* Which meal */}
          <Text className="mb-3 mt-8 px-5 text-[11px] font-bold uppercase text-muted" style={{ letterSpacing: english ? 1.4 : 0 }}>
            {t('meal.which')}
          </Text>
          <View className="flex-row px-5" style={{ gap: 8 }}>
            {TYPES.map((type) => {
              const selected = type === mealType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setMealType(type)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`meal.${type}`)}
                  accessibilityState={{ selected }}
                  className="flex-1 items-center justify-center active:opacity-80"
                  style={{ minHeight: 72, paddingHorizontal: 2, paddingVertical: 8, borderRadius: 20, gap: 6, backgroundColor: selected ? '#ffffff' : SOFT }}>
                  <SymbolView name={MEAL_ICON[type]} tintColor={selected ? INK : MUTED} size={18} />
                  <Text maxFontSizeMultiplier={1.2} numberOfLines={english ? 1 : 2} adjustsFontSizeToFit className="text-center text-[12px] font-bold" style={{ color: selected ? INK : MUTED }}>
                    {t(`meal.${type}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* What was eaten, from the food library */}
          <Text className="mb-3 mt-8 px-5 text-[11px] font-bold uppercase text-muted" style={{ letterSpacing: english ? 1.4 : 0 }}>
            {t('meal.foods')}
          </Text>
          <View className="px-5">
            <FoodPicker foods={foods} byId={byId} items={items} onChange={setItems} disabled={busy} />
            {photo && canSuggest ? (
              <Pressable
                onPress={() => void suggest()}
                disabled={busy || suggesting}
                accessibilityRole="button"
                className="mt-4 flex-row items-center justify-center rounded-full active:opacity-80"
                style={{ gap: 8, minHeight: 46, backgroundColor: SOFT }}>
                {suggesting ? <ActivityIndicator color="white" size="small" /> : <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} tintColor="white" size={15} />}
                <Text maxFontSizeMultiplier={1.3} className="text-sm font-bold text-white">
                  {suggesting ? t('meal.suggesting') : t('meal.suggest')}
                </Text>
              </Pressable>
            ) : null}
            {suggested ? (
              <Text className="mt-2 text-[12px] leading-4 text-muted">{t('meal.suggested')}</Text>
            ) : null}
          </View>

          {/* Note */}
          <View className="mb-3 mt-8 flex-row items-end justify-between px-5">
            <Text className="shrink text-[11px] font-bold uppercase text-muted" style={{ letterSpacing: english ? 1.4 : 0 }}>
              {t('meal.note')} {photo || items.length ? t('meal.optional') : ''}
            </Text>
            <Text className="text-[11px] text-muted">{note.length}/200</Text>
          </View>
          <View className="px-5">
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('meal.notePlaceholder')}
              placeholderTextColor="#6f8577"
              selectionColor={BRAND}
              cursorColor={BRAND}
              maxLength={200}
              multiline
              editable={!busy}
              maxFontSizeMultiplier={1.4}
              accessibilityLabel={t('meal.note')}
              style={{ minHeight: 84, textAlignVertical: 'top', backgroundColor: SOFT, borderRadius: 20 }}
              className="px-4 py-3.5 text-base text-white"
            />
          </View>

          {error ? (
            <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
              <Text className="text-sm text-white">{error}</Text>
              {needsSettings ? (
                <Pressable onPress={() => Linking.openSettings()} hitSlop={8} accessibilityRole="button">
                  <Text className="mt-1 text-sm font-bold text-brand">{t('acc.openSettings')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* Save stays at the bottom of the screen, above the keyboard. */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 14, borderTopWidth: 1, borderTopColor: HAIRLINE, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave, busy }}
            className="items-center justify-center rounded-full active:opacity-80"
            style={{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: canSave || busy ? BRAND : SOFT }}>
            {busy ? (
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <ActivityIndicator color={INK} />
                <Text maxFontSizeMultiplier={1.3} className="text-base font-bold" style={{ color: INK }}>
                  {photo ? t('meal.uploading') : t('meal.saving')}
                </Text>
              </View>
            ) : (
              <Text maxFontSizeMultiplier={1.3} className="text-center text-base font-bold" style={{ color: canSave ? INK : MUTED }}>
                {canSave ? t('meal.save') : t('meal.addSomething')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
