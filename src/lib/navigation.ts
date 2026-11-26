/**
 * Back, or Home when there is nowhere to go back to. A screen that was opened by reloading the app (or from a
 * notification) has no screen behind it, and a plain `router.back()` would do nothing.
 */
export function goBack(router: { canGoBack: () => boolean; back: () => void; replace: (href: '/') => void }) {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
