import { requireSupabase } from "./supabase.js";
import { escapeHTML, formatDate } from "./utils.js";

export async function toggleLike(contentId) {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Войди в аккаунт, чтобы поставить лайк.");

  const { data: existing, error: readError } = await client
    .from("likes").select("content_id").eq("user_id", user.id).eq("content_id", contentId).maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error } = await client.from("likes").delete()
      .eq("user_id", user.id).eq("content_id", contentId);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from("likes").insert({ user_id: user.id, content_id: contentId });
  if (error) throw error;
  return true;
}

export async function toggleFavorite(contentId) {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Войди в аккаунт, чтобы добавить в избранное.");

  const { data: existing, error: readError } = await client
    .from("favorites").select("content_id").eq("user_id", user.id).eq("content_id", contentId).maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error } = await client.from("favorites").delete()
      .eq("user_id", user.id).eq("content_id", contentId);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from("favorites").insert({ user_id: user.id, content_id: contentId });
  if (error) throw error;
  return true;
}

async function attachProfiles(comments) {
  if (!comments.length) return comments;
  const client = requireSupabase();
  const ids = [...new Set(comments.map((comment) => comment.user_id))];
  const { data: profiles, error } = await client.from("profiles")
    .select("id,display_name,username").in("id", ids);
  if (error) throw error;
  const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return comments.map((comment) => ({ ...comment, profile: byId.get(comment.user_id) || null }));
}

export async function addComment(contentId, body, parentId = null) {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Войди в аккаунт, чтобы оставить комментарий.");
  const text = String(body || "").trim();
  if (!text) throw new Error("Комментарий не может быть пустым.");

  const { data, error } = await client.from("comments")
    .insert({ content_id: contentId, user_id: user.id, body: text, parent_id: parentId })
    .select("id,body,created_at,parent_id,user_id")
    .single();
  if (error) throw error;
  const [withProfile] = await attachProfiles([data]);
  return withProfile;
}

export async function getComments(contentId) {
  const client = requireSupabase();
  const { data, error } = await client.from("comments")
    .select("id,body,created_at,parent_id,user_id")
    .eq("content_id", contentId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return attachProfiles(data || []);
}

export async function renderComments(contentId, target) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) return;
  const comments = await getComments(contentId);
  container.innerHTML = comments.map((comment) => {
    const name = comment.profile?.display_name || comment.profile?.username || "Пользователь";
    return `<article class="ttfbb-comment">
      <strong>${escapeHTML(name)}</strong>
      <time>${escapeHTML(formatDate(comment.created_at))}</time>
      <p>${escapeHTML(comment.body)}</p>
    </article>`;
  }).join("") || `<p class="db-empty">Комментариев пока нет.</p>`;
}
