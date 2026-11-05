import { router } from 'expo-router';
import { Screen } from './screen';
import { Button, EmptyState } from './ui';

/** Shown where there is no camera to use, for example in a web browser. */
export function NoCamera({ title }: { title: string }) {
  return (
    <Screen title={title} back>
      <EmptyState
        icon="video"
        title="The camera is not available here"
        detail="Recording and pose tracking run on an Android or iOS phone. This screen needs the phone's camera."
        action={<Button label="Go back" variant="secondary" onPress={() => router.back()} />}
      />
    </Screen>
  );
}
