"use server";

import { cookies } from "next/headers";

/**
 * Server action to securely set the auth cookie in HTTP headers.
 */
export async function setAuthCookieAction(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    path: "/",
    httpOnly: false, // Accessible by proxy middleware & browser
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Server action to clear the auth cookie.
 */
export async function clearAuthCookieAction() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
}
