"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const password = String(formData.get("password") ?? "");
  if (!password) {
    return { error: "Enter the admin password." };
  }
  const ok = await login(password);
  if (!ok) {
    return { error: "Incorrect password." };
  }
  redirect("/products");
}
