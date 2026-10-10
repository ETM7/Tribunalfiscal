import { cookies } from "next/headers";
import { getUser, readSecret, type PublicUser } from "./accounts";
import { openSession, sealSession, SESSION_MAX_AGE_MS } from "./session-token";

const COOKIE = "tf_sesion";

export async function currentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const userId = openSession(token, await readSecret());
  if (!userId) return null;
  return getUser(userId);
}

export async function startSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, sealSession(userId, await readSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
