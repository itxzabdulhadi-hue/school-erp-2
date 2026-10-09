import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createQueryClient, useReactQueryRN } from './src/api/query';
import { SessionProvider } from './src/auth/session';
import { ThemeProvider } from './src/branding/theme';
import { OfflineBanner } from './src/components/OfflineBanner';
import { RootNavigator } from './src/navigation/RootNavigator';
import { setupNotificationHandler } from './src/utils/push';

setupNotificationHandler();

function Wiring({ children }: { children: React.ReactNode }): React.JSX.Element {
  useReactQueryRN();
  return <>{children}</>;
}

export default function App(): React.JSX.Element {
  const queryClient = useMemo(() => createQueryClient(), []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ThemeProvider>
            <Wiring>
              <StatusBar style="auto" />
              <OfflineBanner />
              <RootNavigator />
            </Wiring>
          </ThemeProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
