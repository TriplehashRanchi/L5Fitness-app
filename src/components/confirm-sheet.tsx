import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

/**
 * A confirmation box that looks the same on iPhone, Android and web (the system alert does not
 * work on web). Use it before anything that cannot be undone.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/70 px-6">
        <View accessibilityViewIsModal className="w-full max-w-[420px] rounded-3xl bg-card p-6">
          <Text maxFontSizeMultiplier={1.3} className="text-lg font-black text-white">
            {title}
          </Text>
          <Text maxFontSizeMultiplier={1.3} className="mt-2 text-sm leading-5 text-muted">
            {message}
          </Text>
          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              className="flex-1 items-center rounded-full border border-white/15 py-3 active:opacity-70">
              <Text maxFontSizeMultiplier={1.3} className="font-bold text-white">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              accessibilityRole="button"
              className={`flex-1 items-center rounded-full py-3 active:opacity-80 ${
                destructive ? 'bg-accent' : 'bg-brand'
              }`}>
              {busy ? (
                <ActivityIndicator color={destructive ? '#ffffff' : '#0b0b0d'} />
              ) : (
                <Text
                  maxFontSizeMultiplier={1.3}
                  className={`font-bold ${destructive ? 'text-white' : 'text-ink'}`}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
