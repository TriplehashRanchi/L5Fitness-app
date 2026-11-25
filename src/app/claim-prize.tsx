import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { Cheque, STAMP_COLORS } from '@/components/offer-card';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { fmtKg } from '@/lib/body';
import { getChallenge, sendClaim, type ChallengeState, type Claim, type ClaimStatus, type PhotoKind } from '@/lib/challenge-api';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { uploadPhoto } from '@/lib/fitness-api';
import { messageFrom } from '@/lib/http';
import { useAuth } from '@/providers/auth-provider';

const GOLD = '#ffd66b';
const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const LINE = 'rgba(255,255,255,0.08)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const DAY_MS = 86_400_000;

type ImagePickerModule = typeof import('expo-image-picker');
let picker: ImagePickerModule | null | undefined;
/** The photo picker is a native part of the app: an old build may not have it, and must not crash. */
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

type Photo = { uri: string; mimeType?: string | null };
const PHOTOS: { kind: PhotoKind; title: string; hint: string; icon: SymbolViewProps['name'] }[] = [
  { kind: 'bodyBefore', title: 'You, before', hint: 'A photo from when you started', icon: { ios: 'figure.stand', android: 'accessibility_new', web: 'accessibility_new' } },
  { kind: 'bodyAfter', title: 'You, now', hint: 'Same pose, taken now', icon: { ios: 'figure.arms.open', android: 'emoji_people', web: 'emoji_people' } },
  { kind: 'scaleBefore', title: 'Scale, before', hint: 'The scale showing your start weight', icon: { ios: 'scalemass', android: 'monitor_weight', web: 'monitor_weight' } },
  { kind: 'scaleAfter', title: 'Scale, now', hint: 'The scale showing your weight now', icon: { ios: 'scalemass.fill', android: 'monitor_weight', web: 'monitor_weight' } },
];

/** A numbered part of the form: a big gold number, what is asked, and why. */
function Step({ n, title, hint, children }: { n: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 30 }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <DisplayText {...COMPACT_TEXT} style={{ color: GOLD, fontSize: 34, lineHeight: 38, letterSpacing: -1 }}>
          {n}
        </DisplayText>
        <View className="flex-1">
          <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-black text-white" style={{ fontSize: 18 }}>
            {title}
          </Text>
          <Text {...COMPACT_TEXT} style={{ color: MUTED, fontSize: 13, lineHeight: 18 }}>
            {hint}
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 14, gap: 12 }}>{children}</View>
    </View>
  );
}

function Field({ label, ...input }: { label: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text {...COMPACT_TEXT} className="font-bold uppercase" style={{ color: MUTED, fontSize: 11, letterSpacing: 1.1, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#5d7165"
        selectionColor={GOLD}
        cursorColor={GOLD}
        maxFontSizeMultiplier={1.3}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...input}
        style={[
          { color: '#ffffff', fontSize: 16, minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: focused ? GOLD : 'transparent' },
          input.multiline ? { minHeight: 92, textAlignVertical: 'top' } : null,
        ]}
      />
    </View>
  );
}

/** One of the four proof photos: an empty frame to tap, or the photo with a way to change it. */
function PhotoTile({ title, hint, icon, photo, onPress }: { title: string; hint: string; icon: SymbolViewProps['name']; photo: Photo | null; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={photo ? `${title}: photo added. Change it` : `${title}: add a photo. ${hint}`}
      className="flex-1 overflow-hidden active:opacity-80"
      style={{ aspectRatio: 0.82, borderRadius: 20, borderWidth: 1.5, borderStyle: photo ? 'solid' : 'dashed', borderColor: photo ? GOLD : 'rgba(255,214,107,0.4)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} contentFit="cover" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} accessible={false} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.65)' }}>
            <Text {...COMPACT_TEXT} numberOfLines={1} className="font-black text-white" style={{ fontSize: 13 }}>
              {title}
            </Text>
            <Text {...COMPACT_TEXT} className="font-bold" style={{ color: GOLD, fontSize: 11 }}>
              Tap to change
            </Text>
          </View>
          <View className="items-center justify-center" style={{ position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD }}>
            <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={13} />
          </View>
        </>
      ) : (
        <View className="flex-1 items-center justify-center" style={{ padding: 10 }}>
          <SymbolView name={icon} tintColor={GOLD} size={34} />
          <Text {...COMPACT_TEXT} className="mt-2 text-center font-black text-white" style={{ fontSize: 14 }}>
            {title}
          </Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-center" style={{ color: MUTED, fontSize: 11.5, lineHeight: 15 }}>
            {hint}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const STEPS: { status: ClaimStatus | 'sent'; label: string }[] = [
  { status: 'sent', label: 'Claim sent' },
  { status: 'pending', label: 'Being checked' },
  { status: 'approved', label: 'Approved' },
  { status: 'paid', label: 'Prize paid' },
];
const REACHED: Record<ClaimStatus, number> = { pending: 1, approved: 2, paid: 3, rejected: 1 };

/** After the claim is sent: where it stands, and what was sent. */
function ClaimStatusView({ claim, prize }: { claim: Claim; prize: string }) {
  const at = REACHED[claim.status];
  return (
    <View style={{ marginTop: 26 }}>
      <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-black text-white" style={{ fontSize: 18 }}>
        {claim.status === 'paid' ? `${prize} is on its way to you.` : claim.status === 'approved' ? 'Approved. Your payment is next.' : 'We have your claim.'}
      </Text>
      <Text {...COMPACT_TEXT} style={{ color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
        {claim.status === 'paid'
          ? 'It was sent to the account you gave. Thank you for showing everyone it can be done.'
          : claim.status === 'approved'
            ? 'The gym has checked your photos and details. You will get a notification when the prize is paid.'
            : 'The gym is checking your photos and details. You will get a notification as soon as there is news.'}
      </Text>

      <View style={{ marginTop: 20 }}>
        {STEPS.map((s, i) => {
          const done = i <= at;
          return (
            <View key={s.label} className="flex-row" style={{ gap: 14 }} accessible accessibilityLabel={`${s.label}: ${done ? 'done' : 'not yet'}`}>
              <View className="items-center">
                <View className="items-center justify-center" style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: done ? GOLD : 'rgba(255,255,255,0.08)' }}>
                  {done ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={12} /> : null}
                </View>
                {i < STEPS.length - 1 ? <View style={{ width: 2, height: 22, backgroundColor: i < at ? GOLD : 'rgba(255,255,255,0.08)' }} /> : null}
              </View>
              <Text {...COMPACT_TEXT} className={done ? 'font-bold text-white' : 'font-semibold'} style={{ fontSize: 15, lineHeight: 26, color: done ? '#ffffff' : MUTED }}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      {claim.adminNote ? (
        <View style={{ marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,214,107,0.1)' }}>
          <Text {...COMPACT_TEXT} className="font-bold uppercase" style={{ color: GOLD, fontSize: 11, letterSpacing: 1.1 }}>
            Note from the gym
          </Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-white" style={{ fontSize: 14, lineHeight: 20 }}>
            {claim.adminNote}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: LINE, gap: 10 }}>
        {[
          ['Name', claim.fullName],
          ['Phone', claim.phone],
          ['Address', claim.address],
          claim.payoutMethod === 'upi' ? ['Pay to UPI', claim.upiId ?? ''] : ['Pay to account', `${claim.accountNumber ?? ''} · ${claim.ifsc ?? ''}`],
        ].map(([label, value]) => (
          <View key={label} className="flex-row" style={{ gap: 12 }}>
            <Text {...COMPACT_TEXT} style={{ color: MUTED, fontSize: 13, width: 110 }}>
              {label}
            </Text>
            <Text {...COMPACT_TEXT} selectable className="flex-1 text-white" style={{ fontSize: 14, lineHeight: 19 }}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row" style={{ gap: 8, marginTop: 16 }}>
        {PHOTOS.map((p) => (
          <View key={p.kind} className="flex-1 overflow-hidden" style={{ aspectRatio: 0.82, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <Image source={{ uri: claim.photos[p.kind] }} contentFit="cover" style={{ flex: 1 }} accessibilityLabel={p.title} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Claiming the prize. Only a member whose logged weight reached the goal inside their 90 days gets the form;
 * the server checks that again when the claim arrives. After sending, the same screen shows how it is going.
 */
export default function ClaimPrizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth().session?.user ?? null;
  const { now, format } = useDeviceClock();
  const todayKey = toDayKey(getZonedParts(now, format.timeZone));

  const [state, setState] = useState<ChallengeState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setState(await getChallenge(todayKey));
      setLoadError(null);
    } catch (e) {
      setLoadError(messageFrom(e));
    }
  }, [todayKey]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const [fullName, setFullName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [photos, setPhotos] = useState<Partial<Record<PhotoKind, Photo>>>({});
  const [agreed, setAgreed] = useState(false);
  const [choosing, setChoosing] = useState<PhotoKind | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);
  /** Photos already uploaded (by their address on the phone), so trying again does not upload them twice. */
  const uploaded = useRef<Record<string, string>>({});
  /** A rejected claim is being filled in again. */
  const [redo, setRedo] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    const kind = choosing;
    setChoosing(null);
    if (!kind) return;
    setError(null);
    setNeedsSettings(false);
    const ImagePicker = loadPicker();
    if (!ImagePicker) return setError('Photos need the latest version of the L5 Fitness app. Install the newest build, then try again.');
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Camera access is turned off for L5 Fitness.');
          setNeedsSettings(permission.canAskAgain === false);
          return;
        }
      }
      // Camera photos are taken at quality 1: shrinking a fresh full-size photo needs so much memory that Android
      // can close the app (see add-meal.tsx).
      const options: import('expo-image-picker').ImagePickerOptions = { mediaTypes: ['images'], quality: source === 'camera' ? 1 : 0.7, exif: false };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhotos((prev) => ({ ...prev, [kind]: { uri: asset.uri, mimeType: asset.mimeType } }));
    } catch {
      setError(`Could not open the ${source === 'camera' ? 'camera' : 'photo library'}. Please try again.`);
    }
  };

  const missing =
    fullName.trim().length < 2
      ? 'Enter your full name.'
      : phone.replace(/\D/g, '').length < 8
        ? 'Enter your phone number.'
        : address.trim().length < 10
          ? 'Enter your full address.'
          : method === 'upi' && !upiId.includes('@')
            ? 'Enter your UPI ID, like name@bank.'
            : method === 'bank' && (!accountName.trim() || accountNumber.replace(/\D/g, '').length < 9 || ifsc.trim().length !== 11)
              ? 'Enter the account name, account number and the 11-character IFSC code.'
              : PHOTOS.some((p) => !photos[p.kind])
                ? 'Add all four photos.'
                : !agreed
                  ? 'Tick the box to confirm the details are yours and true.'
                  : null;

  const submit = async () => {
    if (busy) return;
    if (missing) return setError(missing);
    setError(null);
    try {
      const ids = {} as Record<PhotoKind, string>;
      for (const [i, p] of PHOTOS.entries()) {
        const photo = photos[p.kind]!;
        setBusy(`Uploading photo ${i + 1} of ${PHOTOS.length}…`);
        uploaded.current[photo.uri] ??= await uploadPhoto(photo.uri, photo.mimeType);
        ids[p.kind] = uploaded.current[photo.uri];
      }
      setBusy('Sending your claim…');
      const next = await sendClaim({
        today: todayKey,
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        payoutMethod: method,
        ...(method === 'upi' ? { upiId: upiId.trim() } : { accountName: accountName.trim(), accountNumber: accountNumber.replace(/\s/g, ''), ifsc: ifsc.trim().toUpperCase(), bankName: bankName.trim() || undefined }),
        photos: ids,
      });
      setState(next);
      setRedo(false);
    } catch (e) {
      setError(e instanceof Error && !(e as { status?: number }).status ? e.message || messageFrom(e) : messageFrom(e));
    } finally {
      setBusy(null);
    }
  };

  const entry = state?.entry ?? null;
  const claim = state?.claim ?? null;
  const rejected = claim?.status === 'rejected';
  const showForm = !!entry?.reached && (!claim || (rejected && redo));
  const daysTaken = entry?.reachedOn ? Math.round((Date.parse(entry.reachedOn) - Date.parse(entry.startedOn)) / DAY_MS) + 1 : null;
  const stamp = claim?.status === 'paid' ? 'PAID' : claim?.status === 'approved' ? 'APPROVED' : claim && !rejected ? 'IN REVIEW' : 'EARNED';

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 20, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" className="h-11 w-11 justify-center active:opacity-60" style={{ marginLeft: -6 }}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={20} />
          </Pressable>

          {!state ? (
            <View className="items-center" style={{ paddingVertical: 80 }}>
              {loadError ? (
                <>
                  <Text {...COMPACT_TEXT} className="text-center text-base font-bold text-white">
                    {loadError}
                  </Text>
                  <Pressable onPress={load} accessibilityRole="button" className="mt-4 min-h-11 justify-center rounded-full bg-brand px-6 active:opacity-80">
                    <Text {...COMPACT_TEXT} className="text-sm font-bold text-ink">
                      Try again
                    </Text>
                  </Pressable>
                </>
              ) : (
                <ActivityIndicator color={GOLD} size="large" />
              )}
            </View>
          ) : !entry?.reached ? (
            <View style={{ paddingVertical: 40 }}>
              <DisplayText {...COMPACT_TEXT} style={{ color: '#ffffff', fontSize: 30, lineHeight: 36 }}>
                Not yet.
              </DisplayText>
              <Text {...COMPACT_TEXT} style={{ color: MUTED, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
                The prize can be claimed once you have lost {state.rules.goalKg} kg inside your {state.rules.days} days. Keep going, and log your weight in Profile.
              </Text>
            </View>
          ) : (
            <>
              <Text {...COMPACT_TEXT} className="font-black uppercase" style={{ color: GOLD, fontSize: 11, letterSpacing: 1.6, marginTop: 6 }}>
                Challenge complete
              </Text>
              <DisplayText {...COMPACT_TEXT} accessibilityRole="header" style={{ color: '#ffffff', fontSize: 34, lineHeight: 40, letterSpacing: -1, marginTop: 6 }}>
                You did it.{'\n'}
                <Text style={{ color: GOLD }}>{state.rules.prize}</Text> is yours.
              </DisplayText>

              {/* what they did, in three numbers */}
              <View className="flex-row" style={{ gap: 8, marginTop: 16 }}>
                {[
                  [fmtKg(entry.lostKg), 'lost'],
                  [daysTaken ? String(daysTaken) : '–', daysTaken === 1 ? 'day' : 'days'],
                  [String(state.totals.completed), state.totals.completed === 1 ? 'finisher so far' : 'finishers so far'],
                ].map(([value, label]) => (
                  <View key={label} accessible accessibilityLabel={`${value} ${label}`} className="flex-1" style={{ paddingVertical: 12, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(255,214,107,0.1)' }}>
                    <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit style={{ color: GOLD, fontSize: 22, lineHeight: 26 }}>
                      {value}
                    </DisplayText>
                    <Text {...COMPACT_TEXT} numberOfLines={1} className="font-semibold" style={{ color: MUTED, fontSize: 11.5 }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              <Cheque payee={(claim?.fullName || fullName || user?.name || 'You').trim()} date={entry.reachedOn ? new Date(`${entry.reachedOn}T12:00:00Z`).toLocaleDateString(format.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null} stamp={stamp} stampColor={STAMP_COLORS.green} />

              {claim && !showForm ? (
                <>
                  {rejected ? (
                    <View>
                      <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-black text-white" style={{ fontSize: 18 }}>
                        Your claim needs a fix.
                      </Text>
                      <View style={{ marginTop: 10, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,122,122,0.12)' }}>
                        <Text {...COMPACT_TEXT} className="font-bold uppercase" style={{ color: '#ff9a9a', fontSize: 11, letterSpacing: 1.1 }}>
                          Note from the gym
                        </Text>
                        <Text {...COMPACT_TEXT} className="mt-1 text-white" style={{ fontSize: 14, lineHeight: 20 }}>
                          {claim.adminNote || 'Please check your details and photos and send the claim again.'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setFullName(claim.fullName);
                          setPhone(claim.phone);
                          setAddress(claim.address);
                          setMethod(claim.payoutMethod);
                          setRedo(true);
                        }}
                        accessibilityRole="button"
                        className="items-center justify-center rounded-full active:opacity-80"
                        style={{ minHeight: 54, marginTop: 16, backgroundColor: GOLD }}>
                        <Text {...COMPACT_TEXT} className="font-black" style={{ color: INK, fontSize: 16 }}>
                          Fix and send again
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <ClaimStatusView claim={claim} prize={state.rules.prize} />
                  )}
                </>
              ) : (
                <>
                  <Text {...COMPACT_TEXT} style={{ color: MUTED, fontSize: 14, lineHeight: 20 }}>
                    Three short steps and the gym can pay you. Your details are only used to check your claim and send the prize.
                  </Text>

                  <Step n="01" title="Who do we pay?" hint="Your name as it is on your bank account, and where to reach you.">
                    <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" autoComplete="name" maxLength={80} />
                    <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="98765 43210" keyboardType="phone-pad" autoComplete="tel" maxLength={16} />
                    <Field label="Address" value={address} onChangeText={setAddress} placeholder="House, street, city, PIN code" multiline maxLength={300} />
                  </Step>

                  <Step n="02" title="Where do we send it?" hint="Pick one. UPI is the quickest.">
                    <View className="flex-row rounded-full" style={{ padding: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} accessibilityRole="tablist">
                      {(['upi', 'bank'] as const).map((m) => {
                        const on = method === m;
                        return (
                          <Pressable key={m} onPress={() => setMethod(m)} accessibilityRole="tab" accessibilityState={{ selected: on }} className="flex-1 items-center justify-center rounded-full active:opacity-80" style={{ minHeight: 44, backgroundColor: on ? GOLD : 'transparent' }}>
                            <Text {...COMPACT_TEXT} className="font-black" style={{ color: on ? INK : MUTED, fontSize: 15 }}>
                              {m === 'upi' ? 'UPI' : 'Bank account'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {method === 'upi' ? (
                      <Field label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="name@bank" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={80} />
                    ) : (
                      <>
                        <Field label="Name on the account" value={accountName} onChangeText={setAccountName} placeholder="As printed on your passbook" autoCapitalize="words" maxLength={80} />
                        <Field label="Account number" value={accountNumber} onChangeText={setAccountNumber} placeholder="9 to 18 digits" keyboardType="number-pad" maxLength={18} />
                        <Field label="IFSC code" value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} placeholder="HDFC0001234" autoCapitalize="characters" autoCorrect={false} maxLength={11} />
                        <Field label="Bank name (optional)" value={bankName} onChangeText={setBankName} placeholder="Your bank" autoCapitalize="words" maxLength={80} />
                      </>
                    )}
                  </Step>

                  <Step n="03" title="Show us the change" hint="Four photos: you and your weighing scale, before and now. Clear photos get approved faster.">
                    {[0, 2].map((row) => (
                      <View key={row} className="flex-row" style={{ gap: 12 }}>
                        {PHOTOS.slice(row, row + 2).map((p) => (
                          <PhotoTile key={p.kind} title={p.title} hint={p.hint} icon={p.icon} photo={photos[p.kind] ?? null} onPress={() => setChoosing(p.kind)} />
                        ))}
                      </View>
                    ))}
                  </Step>

                  <Pressable onPress={() => setAgreed((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} className="flex-row items-center active:opacity-70" style={{ gap: 12, marginTop: 26, minHeight: 48 }}>
                    <View className="items-center justify-center" style={{ width: 26, height: 26, borderRadius: 8, borderWidth: agreed ? 0 : 2, borderColor: MUTED, backgroundColor: agreed ? GOLD : 'transparent' }}>
                      {agreed ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={13} /> : null}
                    </View>
                    <Text {...COMPACT_TEXT} className="flex-1 text-white" style={{ fontSize: 14, lineHeight: 20 }}>
                      These details and photos are mine and they are true.
                    </Text>
                  </Pressable>

                  {error ? (
                    <View accessibilityRole="alert" style={{ marginTop: 14 }}>
                      <Text {...COMPACT_TEXT} className="font-semibold" style={{ color: '#ff7a7a', fontSize: 14, lineHeight: 20 }}>
                        {error}
                      </Text>
                      {needsSettings ? (
                        <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button" className="min-h-11 justify-center active:opacity-60">
                          <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
                            Open settings
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  <Pressable
                    onPress={submit}
                    disabled={!!busy}
                    accessibilityRole="button"
                    accessibilityLabel="Send my claim"
                    accessibilityState={{ busy: !!busy }}
                    className="flex-row items-center justify-center rounded-full active:opacity-80"
                    style={{ gap: 10, minHeight: 58, marginTop: 18, backgroundColor: GOLD, opacity: busy ? 0.8 : 1 }}>
                    {busy ? <ActivityIndicator color={INK} size="small" /> : <SymbolView name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }} tintColor={INK} size={18} />}
                    <Text {...COMPACT_TEXT} className="font-black" style={{ color: INK, fontSize: 17 }}>
                      {busy ?? 'Send my claim'}
                    </Text>
                  </Pressable>
                  <Text {...COMPACT_TEXT} className="text-center" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, lineHeight: 16, marginTop: 10 }}>
                    The gym checks every claim before paying. You will get a notification with the result.
                  </Text>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Camera or library, for the photo tile that was tapped. */}
      <Modal visible={choosing !== null} transparent animationType="fade" onRequestClose={() => setChoosing(null)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={() => setChoosing(null)} accessibilityLabel="Close">
          <View accessibilityViewIsModal style={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 10, backgroundColor: '#101510', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
            <Text {...COMPACT_TEXT} className="text-center font-black text-white" style={{ fontSize: 16, marginVertical: 6 }}>
              {PHOTOS.find((p) => p.kind === choosing)?.title ?? 'Add a photo'}
            </Text>
            {(
              [
                ['camera', 'Take a photo', { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }],
                ['library', 'Choose from your photos', { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }],
              ] as const
            ).map(([source, label, icon]) => (
              <Pressable key={source} onPress={() => void pick(source)} accessibilityRole="button" className="flex-row items-center rounded-2xl active:opacity-80" style={{ gap: 12, minHeight: 56, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <SymbolView name={icon} tintColor={BRAND} size={20} />
                <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 16 }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
