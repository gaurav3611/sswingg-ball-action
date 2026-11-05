import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AuthError } from '@/data/auth';
import type { Role } from '@/data/types';
import { MIN_PASSWORD, hasErrors, validateRegistration, type FieldErrors } from '@/data/validation';
import { Screen } from '@/components/screen';
import { Button, Card, Field, Segmented, Txt } from '@/components/ui';
import { useApp } from '@/state/app';
import { space } from '@/theme/tokens';

export default function Register() {
  const app = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('bowler');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const e = validateRegistration({ name, email, password });
    setErrors(e);
    setFailure(null);
    if (hasErrors(e)) return;
    setBusy(true);
    try {
      await app.register({ name, email, password, role });
    } catch (err) {
      setFailure(err instanceof AuthError ? err.message : 'The account could not be created. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Create an account" back={() => router.replace('/login')}>
      <Card>
        <Field label="Your name" value={name} onChangeText={setName} error={errors.name} autoComplete="name" textContentType="name" />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Segmented
          label="I am a"
          value={role}
          onChange={setRole}
          options={[
            { value: 'bowler', label: 'Bowler' },
            { value: 'coach', label: 'Coach' },
          ]}
        />
        <Txt variant="small" tone="muted">
          A coach can keep several bowlers under one account. Sharing sessions between accounts is not built yet.
        </Txt>
        {failure ? (
          <Txt variant="small" tone="red" accessibilityRole="alert">
            {failure}
          </Txt>
        ) : null}
        <View style={{ gap: space.sm }}>
          <Button label="Create account" onPress={submit} loading={busy} />
        </View>
      </Card>
    </Screen>
  );
}
