"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, ADMIN_COOKIE } from "@/lib/admin-session";

export type LoginResult = { ok: false; error: string };

export async function adminLogin(formData: FormData): Promise<LoginResult> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, error: "ADMIN_PASSWORD no está configurado en el servidor." };
  if (password !== expected) return { ok: false, error: "Contraseña incorrecta." };

  (await cookies()).set(ADMIN_COOKIE, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/panel");
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
