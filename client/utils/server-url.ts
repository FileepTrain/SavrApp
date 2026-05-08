import { Platform } from 'react-native';

function normalizeBase(url: string) {
  return url.replace(/\/$/, '');
}

function defaultWebApiBase(): string {
  if (
    typeof window !== 'undefined' &&
    window.location?.protocol === 'http:' &&
    window.location.hostname
  ) {
    return `http://${window.location.hostname}:3000`;
  }
  return 'http://localhost:3000';
}

/**
 * API base URL (no trailing slash).
 * - Web (HTTP): same hostname as the page (e.g. 192.168.x.x:8081 → API on :3000).
 * - Web (SSR / no window): localhost.
 * - iOS simulator: localhost.
 * - Android emulator: 10.0.2.2 is the host loopback alias.
 * - Physical devices / tunnels: set EXPO_PUBLIC_SERVER_URL.
 */
export const SERVER_URL: string = (() => {
  const fromEnv = process.env.EXPO_PUBLIC_SERVER_URL;
  if (fromEnv) return normalizeBase(fromEnv);

  if (Platform.OS === 'web') return defaultWebApiBase();
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
})();
