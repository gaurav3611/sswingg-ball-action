import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/screen';
import { Button, Card, Choices, Field, Segmented, Txt } from '@/components/ui';
import type { BowlingStyle, Experience } from '@/data/types';
import { hasErrors, validateProfile, type FieldErrors } from '@/data/validation';
import type { CameraView, Side } from '@/pose/types';
import { useApp } from '@/state/app';
import { space } from '@/theme/tokens';

export default function EditBowler() {
  const app = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? app.myBowlers.find((b) => b.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [age, setAge] = useState(existing?.age?.toString() ?? '');
  const [height, setHeight] = useState(existing?.heightCm?.toString() ?? '');
  const [mass, setMass] = useState(existing?.massKg?.toString() ?? '');
  const [arm, setArm] = useState<Side>(existing?.bowlingArm ?? 'right');
  const [style, setStyle] = useState<BowlingStyle>(existing?.style ?? 'fast');
  const [experience, setExperience] = useState<Experience>(existing?.experience ?? 'club');
  const [view, setView] = useState<CameraView>(existing?.preferredView ?? 'side');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const v = validateProfile({ name, age, heightCm: height, massKg: mass });
    setErrors(v.errors);
    if (hasErrors(v.errors)) return;
    setBusy(true);
    try {
      await app.saveBowler({
        id: existing?.id,
        name: name.trim(),
        age: v.age,
        heightCm: v.heightCm,
        massKg: v.massKg,
        bowlingArm: arm,
        style,
        experience,
        preferredView: view,
      });
      router.back();
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!existing) return;
    Alert.alert(
      `Delete ${existing.name}?`,
      'This also deletes every session recorded for this bowler, including the video. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await app.deleteBowler(existing.id);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <Screen title={existing ? 'Edit bowler' : 'New bowler'} back>
      <Card>
        <Field label="Name" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
        <Segmented
          label="Bowling arm"
          value={arm}
          onChange={setArm}
          options={[
            { value: 'right', label: 'Right arm' },
            { value: 'left', label: 'Left arm' },
          ]}
        />
        <Choices
          label="Bowling style"
          value={style}
          onChange={setStyle}
          options={[
            { value: 'fast', label: 'Fast' },
            { value: 'medium', label: 'Medium pace' },
            { value: 'swing', label: 'Swing' },
            { value: 'seam', label: 'Seam' },
            { value: 'spin', label: 'Spin' },
          ]}
        />
        <Choices
          label="Experience"
          value={experience}
          onChange={setExperience}
          options={[
            { value: 'junior', label: 'Junior' },
            { value: 'club', label: 'Club' },
            { value: 'academy', label: 'Academy' },
            { value: 'advanced', label: 'Advanced' },
          ]}
        />
        <Segmented
          label="Preferred camera view"
          value={view}
          onChange={setView}
          options={[
            { value: 'side', label: 'Side' },
            { value: 'front', label: 'Front' },
            { value: 'rear', label: 'Rear' },
          ]}
        />
      </Card>
      <Card>
        <Txt variant="heading">Optional details</Txt>
        <Txt variant="small" tone="muted">
          Leave these empty if you prefer. Body mass is only needed for the momentum estimate, which is not built yet. Nothing here is sent anywhere.
        </Txt>
        <Field label="Age (years)" value={age} onChangeText={setAge} error={errors.age} keyboardType="number-pad" />
        <Field label="Height (cm)" value={height} onChangeText={setHeight} error={errors.heightCm} keyboardType="decimal-pad" />
        <Field label="Body mass (kg)" value={mass} onChangeText={setMass} error={errors.massKg} keyboardType="decimal-pad" />
      </Card>
      <View style={{ gap: space.sm }}>
        <Button label="Save" onPress={save} loading={busy} />
        {existing ? <Button label="Delete this bowler" variant="danger" onPress={remove} /> : null}
      </View>
    </Screen>
  );
}
