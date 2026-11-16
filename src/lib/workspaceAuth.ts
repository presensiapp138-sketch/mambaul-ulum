import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

let isSigningIn = false;
// Keep OAuth access token strictly in memory (never in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export function initWorkspaceAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthCleared?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) {
        cachedAccessToken = null;
      }
      onAuthCleared?.();
    }
  });
}

export async function googleWorkspaceSignIn(
  loginHintEmail?: string
): Promise<{ user: User; accessToken: string }> {
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }

  const customParams: Record<string, string> = {
    prompt: 'consent select_account',
  };
  if (loginHintEmail && loginHintEmail.trim()) {
    customParams.login_hint = loginHintEmail.trim();
  }
  provider.setCustomParameters(customParams);

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Drive & Sheets.');
    }

    cachedAccessToken = credential.accessToken;
    return {
      user: result.user,
      accessToken: cachedAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export function getWorkspaceAccessToken(): string | null {
  return cachedAccessToken;
}

export function getCurrentWorkspaceUser(): User | null {
  return auth.currentUser;
}

export async function logoutWorkspaceAuth(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}
