import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { VStack } from '@theolive/ui/components/vstack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/hooks/useAuth';

export default function HomeScreen() {
  const { session } = useSession();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <VStack className="gap-2 p-6">
        <Heading size="2xl">Home</Heading>
        <Text className="text-muted-foreground">Signed in as {session?.user.email}</Text>
      </VStack>
    </SafeAreaView>
  );
}
