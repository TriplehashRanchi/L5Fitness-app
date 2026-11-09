import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ProfileForm } from '@/components/profile-form';

export default function EditProfileScreen() {
  const router = useRouter();
  return (
    <>
      <StatusBar style="light" />
      <ProfileForm mode="edit" onDone={() => router.back()} />
    </>
  );
}
