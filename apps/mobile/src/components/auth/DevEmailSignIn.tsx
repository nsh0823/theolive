import { Button, ButtonSpinner, ButtonText } from '@theolive/ui/components/button';
import { Input, InputField } from '@theolive/ui/components/input';
import { Text } from '@theolive/ui/components/text';
import { VStack } from '@theolive/ui/components/vstack';
import { useState } from 'react';

import { useSignIn } from '@/hooks/useAuth';

/**
 * DEV-ONLY escape hatch so developers can sign in against local Supabase before OAuth
 * exists. Not part of the PRD (AUTH-01 is social login); rendered only when __DEV__.
 */
export function DevEmailSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useSignIn();

  return (
    <VStack className="gap-3">
      <Text size="xs" className="text-center text-muted-foreground">
        개발용 이메일 로그인
      </Text>
      <Input className="min-h-11 bg-card">
        <InputField
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </Input>
      <Input className="min-h-11 bg-card">
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
        variant="outline"
        className="min-h-11 rounded-full"
        onPress={() => signIn.mutate({ email, password })}
        isDisabled={signIn.isPending || !email || !password}
      >
        {signIn.isPending ? <ButtonSpinner /> : null}
        <ButtonText>Sign In</ButtonText>
      </Button>
    </VStack>
  );
}
