import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// --- Auth ---
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// --- Users ---
export const getUsers = async () => {
  const { data, error } = await supabase.from('users').select('*').order('last_active', { ascending: false });
  return { data: data || [], error };
};

export const updateLastActive = async (userId: string) => {
  await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', userId);
};

// --- Company Settings ---
export const getCompanySettings = async () => {
  const { data, error } = await supabase.from('company_settings').select('*').single();
  if (error) return null;
  return data;
};

export const updateCompanySettings = async (settings: any) => {
  const { data, error } = await supabase.from('company_settings').update(settings).eq('id', settings.id).select().single();
  return { data, error };
};

// --- Activity Logs ---
export const getActivityLogs = async (limit = 20) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
};

export const logActivity = async (action: string, details: string = '', userId?: string, userName?: string) => {
  await supabase.from('activity_logs').insert({ action, details, user_id: userId, user_name: userName });
};