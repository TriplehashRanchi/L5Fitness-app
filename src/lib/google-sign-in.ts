/**
 * "Continue with Google": the phone's own Google account picker, then Firebase.
 *
 * The picker is native code, so it exists only in the installed (development or store) app,
 * not in Expo Go or on the web.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Platform } from 'react-native';

import { auth, GOOGLE_WEB_CLIENT_ID } from '@/lib/firebase';

type GoogleModule = typeof import('react-native-nitro-google-signin');

export type GoogleResult =
  | { type: 'success' }
  /** The member closed the account picker. Not an error: just stay on the login screen. */
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

const FAILED = 'Google sign-in could not be completed. Please try again.';

let google: GoogleModule | null | undefined;
function load(): GoogleModule | null {
  if (google !== undefined) return google;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (google = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    google = require('react-native-nitro-google-signin') as GoogleModule;
    google.GoogleOneTapSignIn.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  } catch {
    google = null;
  }
  return google;
}

export async function googleSignIn(): Promise<GoogleResult> {
  if (Platform.OS === 'web') {
    return { type: 'error', message: 'Google sign-in is available in the L5 Fitness phone app.' };
  }
  const lib = load();
  if (!lib) {
    return {
      type: 'error',
      message: 'Google sign-in needs the installed L5 Fitness app (it does not work in Expo Go).',
    };
  }

  try {
    if (Platform.OS === 'android') await lib.GoogleOneTapSignIn.checkPlayServices();
    const response = await lib.GoogleOneTapSignIn.presentExplicitSignIn();
    if (lib.isCancelledResponse(response)) return { type: 'cancelled' };
    if (!lib.isSuccessResponse(response) || !response.data.idToken) return { type: 'error', message: FAILED };

    // Hand Google's proof of identity to Firebase, which creates or finds the member's account.
    await signInWithCredential(auth, GoogleAuthProvider.credential(response.data.idToken));
    return { type: 'success' };
  } catch (e) {
    if (lib.isErrorWithCode(e) && e.code === lib.statusCodes.SIGN_IN_CANCELLED) return { type: 'cancelled' };
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/network-request-failed')
      return {
        type: 'error',
        message:
          "Can't reach Google. Check your phone's internet connection and try again." +
          (__DEV__ ? '\n\n(Developer note: the phone could not reach Firebase, not your own API.)' : ''),
      };
    console.warn('Google sign-in failed:', code || (e as Error).message);
    // Developers see the real reason; members get the plain sentence.
    return { type: 'error', message: __DEV__ ? `${FAILED}\n\n(Developer note: ${code || (e as Error).message})` : FAILED };
  }
}
