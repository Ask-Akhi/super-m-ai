import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.supermai.app',
  appName: 'Super M AI',
  webDir: '.next',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith('http://'),
      }
    : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#07111f',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#07111f',
    },
  },
};

export default config;
