import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AuthError } from '@/data/auth';
import { hasErrors, validateLogin, type FieldErrors } from '@/data/validation';
import { Screen } from '@/components/screen';
import { Button, Card, ErrorState, Field, Txt } from '@/components/ui';
import { useApp } from '@/state/app';
import { space } from '@/theme/tokens';

export default function Login() {
  const app = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const e = validateLogin({ email, password });
    setErrors(e);
    setFailure(null);
    if (hasErrors(e)) return;
    setBusy(true);
    try {
      await app.login(email, password);
    } catch (err) {
      setFailure(err instanceof AuthError ? err.message : 'Sign in did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen brand>
      <View style={{ gap: space.lg, paddingTop: space.lg }}>
        <Txt variant="display">Sign in</Txt>
        <Card>
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
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
          />
          {failure ? (
            <Txt variant="small" tone="red" accessibilityRole="alert">
              {failure}
            </Txt>
          ) : null}
          <Button label="Sign in" onPress={submit} loading={busy} />
        </Card>
        <Txt variant="small" tone="muted">
          Accounts are kept on this phone only. There is no server and no password reset: if you forget the password, delete the app data and start again.
        </Txt>
        <Button label="Create an account" variant="secondary" onPress={() => router.push('/register')} />
      </View>
    </Screen>
  );
}
