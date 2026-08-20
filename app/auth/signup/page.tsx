import type { Metadata } from "next";
import { AccountFlowShell } from "@/components/auth/AccountFlowShell";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Join Fusion Gadgets to track orders, save favourites, and check out faster.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/auth/signup" },
};

export default function SignUpPage() {
  return <AccountFlowShell />;
}
