import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useCaptureSync } from '@/features/inbox/capture';
import { useTheme } from '@/theme/useTheme';
import { ToastHost } from '@/ui/Toast';

export default function RootLayout() {
  const theme = useTheme();
  useCaptureSync();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="add" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="settle" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="capture-consent" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
