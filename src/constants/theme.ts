import { Platform } from 'react-native';

/**
 * Colours, fonts and spacing live in Tailwind (src/global.css → @theme).
 * Only values that Tailwind classes can't express go here.
 */

/** Space the floating pill tab bar takes above the safe area (content scrolls behind it). */
export const BottomTabInset = Platform.select({ ios: 76, android: 76 }) ?? 0;
