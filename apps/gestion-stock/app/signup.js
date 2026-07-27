import {
  Redirect,
  router,
} from "expo-router";

import SignupScreen from
  "../src/screens/SignupScreen.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

export default function SignupPage() {
  const session =
    useAuthStore(
      (state) => state.session
    );

  if (session) {
    return <Redirect href="/" />;
  }

  return (
    <SignupScreen
      onBack={() =>
        router.replace("/login")
      }
      onRegistered={({
        hasSession,
      }) => {
        router.replace(
          hasSession
            ? "/"
            : "/login"
        );
      }}
    />
  );
}
