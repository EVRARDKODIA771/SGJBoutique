import { Redirect, router } from "expo-router";

import ProfitHistoryScreen from "../../src/screens/ProfitHistoryScreen.js";
import { useAuthStore } from "../../src/store/authStore.js";

export default function RestockingProfitsPage() {
  const session = useAuthStore((state) => state.session);
  const membership = useAuthStore((state) => state.adminMembership);
  const companySessionId = useAuthStore((state) => state.companySessionId);

  if (!session) return <Redirect href="/login" />;
  if (membership?.status !== "approved") return <Redirect href="/access" />;
  if (!companySessionId) return <Redirect href="/company-password" />;

  return (
    <ProfitHistoryScreen
      onBack={() => router.back()}
      onOpenRestocking={(id) => router.push(`/restockings/${id}`)}
    />
  );
}
