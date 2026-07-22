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
      onAuthenticated={() => {
        router.replace("/");
      }}
    />
  );
}
