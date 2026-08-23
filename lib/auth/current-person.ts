import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { findPersonByAuthUserId } from "./people";

export const getCurrentPerson = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  if (error || typeof authUserId !== "string") return null;
  const person = await findPersonByAuthUserId(supabase, authUserId);
  return person?.isActive ? person : null;
});
