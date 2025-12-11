// app/index.tsx
import { Redirect } from "expo-router";

export default function Index() {
  // When the app launches, go straight to /login
  return <Redirect href="/login" />;
}
