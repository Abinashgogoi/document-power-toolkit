import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { ProfileRow } from "./database.types";

export interface CloudIdentity {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
}

export async function getCloudIdentity(): Promise<CloudIdentity> {
  if (!supabase) return { session: null, user: null, profile: null };
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.user) return { session: null, user: null, profile: null };
  const profile = await getProfile(session.user.id);
  return { session, user: session.user, profile };
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
) {
  if (!supabase) throw new Error("Supabase backend is not configured.");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase backend is not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback: () => void) {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange(() => callback());
  return () => data.subscription.unsubscribe();
}

export async function updateDisplayName(
  displayName: string,
): Promise<ProfileRow> {
  if (!supabase) throw new Error("Supabase backend is not configured.");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in required.");
  const { data, error } = await (supabase as any)
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
