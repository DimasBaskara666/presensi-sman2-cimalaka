import type { CurrentPerson } from "./types";
import { toSyntheticEmail } from "./synthetic-email";

export type LoginDependencies = {
  signIn: (email: string, password: string) => Promise<string | null>;
  findPerson: (authUserId: string) => Promise<CurrentPerson | null>;
  signOut: () => Promise<void>;
};

export type LoginResult =
  | { status: "authenticated"; person: CurrentPerson }
  | { status: "invalid" };

export async function authenticateWithLoginId(
  loginId: string,
  password: string,
  domain: string,
  dependencies: LoginDependencies,
): Promise<LoginResult> {
  if (!password) return { status: "invalid" };

  let email: string;
  try {
    email = toSyntheticEmail(loginId, domain);
  } catch {
    return { status: "invalid" };
  }

  const authUserId = await dependencies.signIn(email, password);
  if (!authUserId) return { status: "invalid" };

  const person = await dependencies.findPerson(authUserId);
  if (!person || !person.isActive || person.authUserId !== authUserId) {
    await dependencies.signOut();
    return { status: "invalid" };
  }

  return { status: "authenticated", person };
}
