import { Redirect, router, useLocalSearchParams } from "expo-router";

import RestockingHistoryScreen from "../../src/screens/RestockingHistoryScreen.js";
import { useAuthStore } from "../../src/store/authStore.js";

export default function RestockingDetailPage() {
  const parameters = useLocalSearchParams();
  const restockingId = Array.isArray(parameters.restockingId)
    ? parameters.restockingId[0]
    : parameters.restockingId;
  const session = useAuthStore((state) => state.session);
  const membership = useAuthStore((state) => state.adminMembership);
  const companySessionId = useAuthStore((state) => state.companySessionId);

  if (!session) return <Redirect href="/login" />;
  if (membership?.status !== "approved") return <Redirect href="/access" />;
  if (!companySessionId) return <Redirect href="/company-password" />;

  return (
    <RestockingHistoryScreen
      initialRestockingId={restockingId}
      detailOnly
      onBack={() => router.back()}
    />
  );
}
