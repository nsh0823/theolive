import { Button, ButtonSpinner, ButtonText } from '@theolive/ui/components/button';
import { Heading } from '@theolive/ui/components/heading';
import { Input, InputField } from '@theolive/ui/components/input';
import { Text } from '@theolive/ui/components/text';
import { VStack } from '@theolive/ui/components/vstack';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSignIn } from '@/hooks/useAuth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useSignIn();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <VStack className="flex-1 justify-center gap-4 px-6">
        <Heading size="2xl">Welcome</Heading>
        <Text className="text-muted-foreground">Sign in to continue to theolive.</Text>

        <Input>
          <InputField
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </Input>
        <Input>
          <InputField
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
        </Input>

        {signIn.error ? <Text className="text-destructive">{signIn.error.message}</Text> : null}

        <Button
          onPress={() => signIn.mutate({ email, password })}
          isDisabled={signIn.isPending || !email || !password}
        >
          {signIn.isPending ? <ButtonSpinner /> : null}
          <ButtonText>Sign In</ButtonText>
        </Button>
      </VStack>
    </SafeAreaView>
  );
}
