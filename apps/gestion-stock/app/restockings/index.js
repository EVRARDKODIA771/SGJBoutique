import { Redirect, router, useLocalSearchParams } from "expo-router";

import RestockingHistoryScreen from "../../src/screens/RestockingHistoryScreen.js";
import { useAuthStore } from "../../src/store/authStore.js";

export default function RestockingsPage() {
  const parameters = useLocalSearchParams();
  const selected = Array.isArray(parameters.selected) ? parameters.selected[0] : parameters.selected;
  const session = useAuthStore((state) => state.session);
  const membership = useAuthStore((state) => state.adminMembership);
  const companySessionId = useAuthStore((state) => state.companySessionId);

  if (!session) return <Redirect href="/login" />;
  if (membership?.status !== "approved") return <Redirect href="/access" />;
  if (!companySessionId) return <Redirect href="/company-password" />;

  return (
    <RestockingHistoryScreen
      initialRestockingId={selected}
      onBack={() => router.push("/dashboard")}
      onCreate={() => router.push("/restockings/new")}
    />
  );
}
