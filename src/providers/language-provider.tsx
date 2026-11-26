import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api } from '@/lib/http';
import { fromDevice, isLanguage, LANGUAGES, setCurrentLanguage, translate, type Language, type Translate } from '@/lib/i18n';
import { useAuth } from '@/providers/auth-provider';

const STORE = 'l5-language';

type Ctx = { language: Language; setLanguage: (code: Language) => void; t: Translate; languages: typeof LANGUAGES };

const LanguageContext = createContext<Ctx | null>(null);

const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

/**
 * The app's language. Until the member chooses one it follows the phone's own (if the app speaks it). A choice
 * is kept on the phone and, once signed in, sent to the server so the dietitian knows which language to write in.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [language, setLang] = useState<Language>(() => fromDevice(getLocales()[0]?.languageCode));
  const chosen = useRef(false);
  const loaded = useRef(false);

  // The saved choice, read once when the app starts.
  useEffect(() => {
    AsyncStorage.getItem(STORE)
      .then((saved) => {
        if (isLanguage(saved)) {
          chosen.current = true;
          setLang(saved);
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  // After sign-in: adopt the server's choice when this phone has none, otherwise tell the server this phone's.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    api<{ language: Language | null }>('/me/language')
      .then(({ language: server }) => {
        if (!live) return;
        if (server && isLanguage(server) && !chosen.current) setLang(server);
        else if (chosen.current && server !== language) void api('/me/language', { method: 'PUT', body: { language, timeZone: timeZone() } }).catch(() => {});
        else void api('/me/language', { method: 'PUT', body: { timeZone: timeZone() } }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // Only when the person signs in: a later change is sent by setLanguage itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setLanguage = useCallback(
    (code: Language) => {
      chosen.current = true;
      setLang(code);
      AsyncStorage.setItem(STORE, code).catch(() => {});
      if (userId) void api('/me/language', { method: 'PUT', body: { language: code, timeZone: timeZone() } }).catch(() => {});
    },
    [userId]
  );

  // Before any screen below draws, so code outside components speaks the same language.
  setCurrentLanguage(language);

  const value = useMemo<Ctx>(() => ({ language, setLanguage, t: (key, vars) => translate(language, key, vars), languages: LANGUAGES }), [language, setLanguage]);
  return <LanguageContext value={value}>{children}</LanguageContext>;
}

export function useLanguage() {
  const ctx = use(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}

/** `const t = useT();  t('common.save')` */
export const useT = () => useLanguage().t;
