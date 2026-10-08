import type { Metadata } from "next";
import AuthPanel from "@/features/auth/components/AuthPanel";

export const metadata: Metadata = {
  title: "SparkGo | Log in or sign up",
  description: "Log in to SparkGo or create an account to get your team moving.",
};

export default function AuthPage() {
  return <AuthPanel />;
}
