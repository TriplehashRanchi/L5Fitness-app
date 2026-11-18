import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

const BRAND = '#3ddc68';

/** Small "Done" / "Pending" label with a check or an open circle. */
export function StatusChip({ done }: { done: boolean }) {
  return (
    <View
      className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${done ? 'bg-brand/15' : 'bg-white/10'}`}
      accessible
      accessibilityLabel={done ? 'Done' : 'Pending'}>
      <SymbolView
        name={done ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
        tintColor={done ? BRAND : '#8fa396'}
        size={13}
      />
      <Text maxFontSizeMultiplier={1.3} className={`text-xs font-bold ${done ? 'text-brand' : 'text-muted'}`}>
        {done ? 'Done' : 'Pending'}
      </Text>
    </View>
  );
}
