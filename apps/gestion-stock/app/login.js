import {
  Redirect,
  router,
} from "expo-router";

import LoginScreen from
  "../src/screens/LoginScreen.js";

import {
  useAuthStore,
} from "../src/store/authStore.js";

export default function LoginPage() {
  const session =
    useAuthStore(
      (state) => state.session
    );

  if (session) {
    return (
      <Redirect href="/" />
    );
  }

  return (
    <LoginScreen
      onAuthenticated={(result) => {
        router.replace(
          result.membership?.status ===
            "approved"
            ? "/company-password"
            : "/access"
        );
      }}
      onSignUp={() => {
        router.push("/signup");
      }}
    />
  );
}
