import { Redirect, router } from "expo-router";

import RestockingFormScreen from "../../src/screens/RestockingFormScreen.js";
import { useAuthStore } from "../../src/store/authStore.js";

export default function NewRestockingPage() {
  const session = useAuthStore((state) => state.session);
  const membership = useAuthStore((state) => state.adminMembership);
  const companySessionId = useAuthStore((state) => state.companySessionId);

  if (!session) return <Redirect href="/login" />;
  if (membership?.status !== "approved") return <Redirect href="/access" />;
  if (!companySessionId) return <Redirect href="/company-password" />;

  return (
    <RestockingFormScreen
      onBack={() => router.back()}
      onCreated={(restocking) => router.replace(`/restockings/${restocking.id}`)}
    />
  );
}
