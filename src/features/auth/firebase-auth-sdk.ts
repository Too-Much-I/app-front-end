import {
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isCancelledResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import {
  isFirebaseProviderCancellation,
  readFirebaseSdkErrorCode,
} from '@/features/auth/firebase-auth-errors';
import {
  FirebaseAuthenticationError,
  type FirebaseAuthSdk,
} from '@/features/auth/firebase-auth-types';

interface FirebaseProviderConfiguration {
  google?: { webClientId: string; iosClientId?: string };
  apple?: { enabled: true };
  kakao?: { providerId: string };
}

/** 프로젝트 설정 완료 후 한 번 생성한다. 생성 시 Firebase 초기화·통신은 하지 않는다. */
export function createFirebaseAuthSdk(config: FirebaseProviderConfiguration): FirebaseAuthSdk {
  function signInOAuth(provider: OAuthProvider) {
    // RNFirebase 26.4.0의 OAuthProvider.providerId는 private지만 modular API는
    // public providerId를 요구한다. 실제 native 호출이 쓰는 toObject도 함께 전달한다.
    const nativeProvider = {
      providerId: provider.PROVIDER_ID,
      toObject: () => provider.toObject(),
    };
    return signInWithPopup(getAuth(), nativeProvider);
  }

  async function signInGoogle(signal: AbortSignal): ReturnType<FirebaseAuthSdk['signInProvider']> {
    if (!config.google?.webClientId.trim())
      throw new FirebaseAuthenticationError('provider-unavailable');
    try {
      if (
        Platform.OS === 'android' &&
        !(await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        }))
      ) {
        throw new FirebaseAuthenticationError('provider-unavailable');
      }
      if (signal.aborted) return { kind: 'cancelled' };
      // configure의 내부 Promise는 바로 이어지는 signIn에서 기다린다.
      GoogleSignin.configure({
        webClientId: config.google.webClientId,
        iosClientId: config.google.iosClientId,
      });
      const response = await GoogleSignin.signIn();
      if (signal.aborted || isCancelledResponse(response)) return { kind: 'cancelled' };
      const token = response.data.idToken;
      if (!token) throw new FirebaseAuthenticationError('provider-unavailable');
      const { user } = await signInWithCredential(getAuth(), GoogleAuthProvider.credential(token));
      return signal.aborted ? { kind: 'cancelled' } : { kind: 'signed-in', user };
    } catch (error) {
      const code = readFirebaseSdkErrorCode(error);
      if (code === statusCodes.SIGN_IN_CANCELLED) return { kind: 'cancelled' };
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE || code === 'DEVELOPER_ERROR') {
        throw new FirebaseAuthenticationError('provider-unavailable');
      }
      if (code === statusCodes.SIGN_IN_REQUIRED)
        throw new FirebaseAuthenticationError('reauthentication-required');
      // IN_PROGRESS를 사용자 취소로 처리하지 않는다.
      throw error;
    }
  }

  async function signInApple(signal: AbortSignal): ReturnType<FirebaseAuthSdk['signInProvider']> {
    if (!config.apple?.enabled) throw new FirebaseAuthenticationError('provider-unavailable');
    const provider = new OAuthProvider('apple.com');
    if (Platform.OS === 'android') {
      provider.addScope('email');
      const { user } = await signInOAuth(provider);
      return signal.aborted ? { kind: 'cancelled' } : { kind: 'signed-in', user };
    }
    if (!(await AppleAuthentication.isAvailableAsync()))
      throw new FirebaseAuthenticationError('provider-unavailable');
    if (signal.aborted) return { kind: 'cancelled' };
    const rawNonce = Crypto.randomUUID();
    const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    if (signal.aborted) return { kind: 'cancelled' };
    try {
      const response = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce,
      });
      if (signal.aborted) return { kind: 'cancelled' };
      if (!response.identityToken) throw new FirebaseAuthenticationError('unexpected');
      const credential = provider.credential({
        idToken: response.identityToken,
        rawNonce,
      });
      const { user } = await signInWithCredential(getAuth(), credential);
      return signal.aborted ? { kind: 'cancelled' } : { kind: 'signed-in', user };
    } catch (error) {
      if (readFirebaseSdkErrorCode(error) === 'ERR_REQUEST_CANCELED') return { kind: 'cancelled' };
      throw error;
    }
  }

  const signInProvider: FirebaseAuthSdk['signInProvider'] = async (provider, signal) => {
    if (signal.aborted) return { kind: 'cancelled' };
    if (Platform.OS !== 'ios' && Platform.OS !== 'android')
      throw new FirebaseAuthenticationError('provider-unavailable');
    try {
      switch (provider) {
        case 'google':
          return await signInGoogle(signal);
        case 'apple':
          return await signInApple(signal);
        case 'kakao': {
          const providerId = config.kakao?.providerId;
          if (!providerId || !/^oidc\.[\w-]+$/.test(providerId))
            throw new FirebaseAuthenticationError('provider-unavailable');
          // Firebase 콘솔의 Provider ID를 사용한다. oidc.kakao로 가정하지 않는다.
          const { user } = await signInOAuth(new OAuthProvider(providerId));
          return signal.aborted ? { kind: 'cancelled' } : { kind: 'signed-in', user };
        }
      }
    } catch (error) {
      if (signal.aborted || isFirebaseProviderCancellation(error)) return { kind: 'cancelled' };
      throw error;
    }
  };

  const signOutDevice: FirebaseAuthSdk['signOut'] = async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    try {
      await signOut(getAuth());
    } catch {
      // 다음 SNS 로그인이 currentUser를 새 사용자로 바꾸므로 남아도 흐름을 막지 않는다.
    }
    if (!config.google?.webClientId.trim()) return;
    try {
      // Google SDK는 자체 로그인을 따로 기억해, 끊지 않으면 다음 로그인이 같은 계정을 바로 고른다.
      GoogleSignin.configure({
        webClientId: config.google.webClientId,
        iosClientId: config.google.iosClientId,
      });
      await GoogleSignin.signOut();
    } catch {
      // 계정 선택 화면이 생략될 뿐 로그아웃 자체에는 영향이 없다.
    }
  };

  return {
    signInProvider,
    getIdToken,
    getCurrentUid: () => getAuth().currentUser?.uid ?? null,
    signOut: signOutDevice,
  };
}
