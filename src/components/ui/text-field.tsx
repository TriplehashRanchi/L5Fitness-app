import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState, type Ref } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';

type Props = TextInputProps & {
  label: string;
  icon: SymbolViewProps['name'];
  error?: string;
  /** Adds a show / hide toggle and hides the text by default. */
  secure?: boolean;
  ref?: Ref<TextInputInstance>;
};

export function TextField({ label, icon, error, secure, ref, onFocus, onBlur, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const border = error ? 'border-red-400' : focused ? 'border-brand' : 'border-white/10';

  return (
    <View className="gap-2">
      <Text maxFontSizeMultiplier={1.4} className="pl-1 text-sm font-semibold text-white/80">
        {label}
      </Text>
      <View className={`h-14 flex-row items-center gap-3 rounded-full border bg-card px-5 ${border}`}>
        <SymbolView name={icon} size={18} tintColor={focused ? '#c6f432' : '#8b8b94'} />
        <TextInput
          ref={ref}
          {...input}
          secureTextEntry={secure ? hidden : input.secureTextEntry}
          placeholderTextColor="#5c5c66"
          selectionColor="#c6f432"
          cursorColor="#c6f432"
          maxFontSizeMultiplier={1.4}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className="h-full flex-1 text-base text-white"
        />
        {secure ? (
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}>
            <SymbolView
              name={
                hidden
                  ? { ios: 'eye', android: 'visibility', web: 'visibility' }
                  : { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
              }
              size={18}
              tintColor="#8b8b94"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text maxFontSizeMultiplier={1.4} className="pl-5 text-xs text-red-400">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
