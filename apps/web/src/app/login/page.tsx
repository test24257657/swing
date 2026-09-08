import { screenMetadata } from "@/lib/seo";

import { LoginForm } from "./login-form";

export const metadata = screenMetadata({
  title: "Sign in",
  description: "Sign in to Swing Terminal.",
  path: "/login",
  noindex: true,
});

export default function LoginPage() {
  return <LoginForm />;
}
