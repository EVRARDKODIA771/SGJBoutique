import "react-native-url-polyfill/auto";

import AsyncStorage from
  "@react-native-async-storage/async-storage";

import {
  AppState,
  Platform,
} from "react-native";

import {
  createClient,
  processLock,
} from "@supabase/supabase-js";

import { env } from "../config/env.js";

export const supabase = createClient(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  }
);

if (Platform.OS !== "web") {
  AppState.addEventListener(
    "change",
    (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    }
  );
}
