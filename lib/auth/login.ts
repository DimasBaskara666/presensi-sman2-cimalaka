import type { CurrentPerson } from "./types";

export type LoginDependencies = {
  resolveEmail: (loginId: string) => string;
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
  dependencies: LoginDependencies,
): Promise<LoginResult> {
  if (!password) return { status: "invalid" };

  let email: string;
  try {
    email = dependencies.resolveEmail(loginId);
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
