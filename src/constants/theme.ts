import { Platform } from 'react-native';

/**
 * Colours, fonts and spacing live in Tailwind (src/global.css → @theme).
 * Only values that Tailwind classes can't express go here.
 */

/** Height of the native bottom tab bar (content scrolls behind it). */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
