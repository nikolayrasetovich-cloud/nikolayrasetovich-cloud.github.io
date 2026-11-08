import { supabase } from './supabase-client.js';

// Универсальные безопасные чтения. Используйте реальные имена таблиц/полей
// из вашей уже установленной SQL-схемы; не угадывайте их.
export async function getPublishedRows(table, { limit = 50, orderBy = 'created_at' } = {}) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('status', 'published')
    .order(orderBy, { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getRows(table, { limit = 100, orderBy = 'created_at' } = {}) {
  const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}
