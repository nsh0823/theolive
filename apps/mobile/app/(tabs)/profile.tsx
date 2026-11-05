import { Button, ButtonText } from '@theolive/ui/components/button';
import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { VStack } from '@theolive/ui/components/vstack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSignOut } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { useAppStore, type ColorMode } from '@/store/useAppStore';

const COLOR_MODES: ColorMode[] = ['system', 'light', 'dark'];

export default function ProfileScreen() {
  const profile = useCurrentProfile();
  const signOut = useSignOut();
  const { colorMode, setColorMode } = useAppStore();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <VStack className="gap-4 p-6">
        <Heading size="2xl">Profile</Heading>
        <Text className="text-muted-foreground">
          {profile.data?.username ?? (profile.isLoading ? 'Loading…' : 'No username set')}
        </Text>

        <Text className="font-semibold">Appearance</Text>
        <VStack className="gap-2">
          {COLOR_MODES.map((mode) => (
            <Button
              key={mode}
              variant={mode === colorMode ? 'default' : 'outline'}
              onPress={() => setColorMode(mode)}
            >
              <ButtonText className="capitalize">{mode}</ButtonText>
            </Button>
          ))}
        </VStack>

        <Button variant="destructive" onPress={() => signOut.mutate()}>
          <ButtonText>Sign Out</ButtonText>
        </Button>
      </VStack>
    </SafeAreaView>
  );
}
