"use client";

/**
 * Client-side account data hooks.
 *
 * All reads/writes go through the browser Supabase client (anon key, RLS-bound).
 * The user owns their profile/addresses; RLS enforces auth.uid() ownership.
 * No service-role key, no Worker, no API routes — direct RLS-protected access.
 */

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  onboarding_state: "incomplete" | "complete";
  pref_newsletter: boolean;
  pref_product_updates: boolean;
  pref_order_updates: boolean;
  member_since: string;
};

export type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  is_default: boolean;
};

// Fetch the current user's profile.
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (error) {
      setError(error.message);
    } else {
      setProfile(data as Profile | null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refresh: fetchProfile };
}

// Fetch the current user's addresses.
export function useAddresses() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("is_default", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setAddresses((data ?? []) as Address[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAddresses();
  }, [fetchAddresses]);

  return { addresses, loading, error, refresh: fetchAddresses };
}

// Update profile fields the user is allowed to edit.
export async function updateProfile(updates: {
  full_name?: string;
  phone?: string;
  pref_newsletter?: boolean;
  pref_product_updates?: boolean;
  pref_order_updates?: boolean;
  onboarding_state?: "incomplete" | "complete";
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userData.user.id);
  return { error: error?.message ?? null };
}

// Address CRUD — all RLS-protected (user can only touch their own rows).
export async function createAddress(addr: Omit<Address, "id" | "is_default"> & { is_default?: boolean }): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };
  // If setting as default, unset the existing default first.
  if (addr.is_default) {
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userData.user.id)
      .eq("is_default", true);
  }
  const { error } = await supabase.from("addresses").insert({
    user_id: userData.user.id,
    label: addr.label,
    line1: addr.line1,
    line2: addr.line2,
    city: addr.city,
    state: addr.state,
    postcode: addr.postcode,
    country: addr.country,
    phone: addr.phone,
    is_default: addr.is_default ?? false,
  });
  return { error: error?.message ?? null };
}

export async function updateAddress(id: string, updates: Partial<Omit<Address, "id">>): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in." };
  // If setting as default, unset the existing default first.
  if (updates.is_default) {
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userData.user.id)
      .eq("is_default", true);
  }
  const { error } = await supabase
    .from("addresses")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userData.user.id); // belt-and-suspenders — RLS also enforces
  return { error: error?.message ?? null };
}

export async function deleteAddress(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  return { error: error?.message ?? null };
}
