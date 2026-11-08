
// Функции админ-панели.
// Все изменения дополнительно защищаются RLS в Supabase.

import { requireSupabase } from "./supabase.js";

const MEDIA_BUCKET = "ttfbb-media";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const CATEGORIES_TABLE = "news_categories";

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};


// =====================================================
// ПРОВЕРКА ПРАВ ПОЛЬЗОВАТЕЛЯ
// =====================================================

async function assertEditor() {
  const client = requireSupabase();

  const {
    data: { user },
    error: userError
  } = await client.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error("Необходимо войти.");
  }

  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) throw error;

  const allowed = (data || []).some(({ role }) =>
    ["admin", "editor"].includes(role)
  );

  if (!allowed) {
    throw new Error("Недостаточно прав: нужен Editor или Admin.");
  }

  return { client, user };
}


// =====================================================
// ПРОВЕРКА ИЗОБРАЖЕНИЯ
// =====================================================

function validateImage(file) {
  if (!file) return;

  if (!ALLOWED_IMAGE_TYPES[file.type]) {
    throw new Error("Выбери изображение JPG, PNG или WebP.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Размер изображения не должен превышать 5 МБ.");
  }
}


// =====================================================
// ЗАГРУЗКА ОБЛОЖКИ
// =====================================================

async function uploadNewsCover(client, file) {
  if (!file) return null;

  validateImage(file);

  const extension = ALLOWED_IMAGE_TYPES[file.type];
  const filePath = `covers/news/${crypto.randomUUID()}.${extension}`;

  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  return filePath;
}


// =====================================================
// УДАЛЕНИЕ ФАЙЛА ИЗ STORAGE
// =====================================================

async function removeStorageFile(client, path) {
  if (!path || typeof path !== "string") return;

  if (/^https?:\/\//i.test(path) || path.startsWith("/")) {
    return;
  }

  const normalizedPath = path.startsWith(`${MEDIA_BUCKET}/`)
    ? path.slice(MEDIA_BUCKET.length + 1)
    : path;

  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .remove([normalizedPath]);

  if (error) {
    console.warn("Не удалось удалить файл из Storage:", error);
  }
}


// =====================================================
// КАТЕГОРИИ НОВОСТЕЙ
// =====================================================

// Получить все категории.
export async function listNewsCategories() {
  const { client } = await assertEditor();

  const { data, error } = await client
    .from(CATEGORIES_TABLE)
    .select("id, name, created_at")
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}


// Добавить категорию.
export async function createNewsCategory(name) {
  const { client } = await assertEditor();

  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    throw new Error("Введи название категории.");
  }

  if (normalizedName.length > 60) {
    throw new Error("Название категории не должно превышать 60 символов.");
  }

  const { data, error } = await client
    .from(CATEGORIES_TABLE)
    .insert({ name: normalizedName })
    .select("id, name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Такая категория уже существует.");
    }

    throw error;
  }

  return data;
}


// Переименовать категорию и связанные новости.
export async function renameNewsCategory(categoryId, newName) {
  const { client } = await assertEditor();

  const normalizedName = String(newName || "").trim();

  if (!categoryId) {
    throw new Error("Не выбрана категория.");
  }

  if (!normalizedName) {
    throw new Error("Введи новое название категории.");
  }

  if (normalizedName.length > 60) {
    throw new Error("Название категории не должно превышать 60 символов.");
  }

  const { data: oldCategory, error: readError } = await client
    .from(CATEGORIES_TABLE)
    .select("id, name")
    .eq("id", categoryId)
    .single();

  if (readError) throw readError;

  if (oldCategory.name === normalizedName) {
    return oldCategory;
  }

  // Сначала обновляем категории у новостей.
  const { error: newsError } = await client
    .from("content_items")
    .update({ category: normalizedName })
    .eq("type", "news")
    .eq("category", oldCategory.name);

  if (newsError) throw newsError;

  // Затем переименовываем саму категорию.
  const { data, error } = await client
    .from(CATEGORIES_TABLE)
    .update({ name: normalizedName })
    .eq("id", categoryId)
    .select("id, name, created_at")
    .single();

  if (error) {
    // Пытаемся вернуть прежнее значение новостям.
    const { error: rollbackError } = await client
      .from("content_items")
      .update({ category: oldCategory.name })
      .eq("type", "news")
      .eq("category", normalizedName);

    if (rollbackError) {
      console.error("Не удалось восстановить категории новостей:", rollbackError);
    }

    if (error.code === "23505") {
      throw new Error("Категория с таким названием уже существует.");
    }

    throw error;
  }

  return data;
}


// Удалить категорию.
// Новости сохраняются, их категория становится "Без категории".
export async function deleteNewsCategory(categoryId) {
  const { client } = await assertEditor();

  if (!categoryId) {
    throw new Error("Не выбрана категория.");
  }

  const { data: category, error: readError } = await client
    .from(CATEGORIES_TABLE)
    .select("id, name")
    .eq("id", categoryId)
    .single();

  if (readError) throw readError;

  // Переносим новости в значение без категории.
  const { error: newsError } = await client
    .from("content_items")
    .update({ category: null })
    .eq("type", "news")
    .eq("category", category.name);

  if (newsError) throw newsError;

  const { error } = await client
    .from(CATEGORIES_TABLE)
    .delete()
    .eq("id", categoryId);

  if (error) {
    // Если удалить категорию не удалось, возвращаем новости.
    const { error: rollbackError } = await client
      .from("content_items")
      .update({ category: category.name })
      .eq("type", "news")
      .is("category", null);

    if (rollbackError) {
      console.error("Не удалось восстановить категории новостей:", rollbackError);
    }

    throw error;
  }

  return true;
}


// =====================================================
// СОЗДАНИЕ НОВОСТИ
// =====================================================

export async function createNews({
  title,
  slug,
  description,
  category,
  excerpt,
  body,
  coverPath,
  coverFile,
  publish = false
}) {
  const { client, user } = await assertEditor();

  let uploadedPath = null;

  try {
    if (coverFile?.size) {
      uploadedPath = await uploadNewsCover(client, coverFile);
    }

    const finalCoverPath = uploadedPath || coverPath || null;

    const { data: item, error } = await client
      .from("content_items")
      .insert({
        type: "news",
        title,
        slug,
        description,
        category: category?.trim() || null,
        cover_path: finalCoverPath,
        status: publish ? "published" : "draft",
        published_at: publish ? new Date().toISOString() : null,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    const { error: childError } = await client
      .from("news_articles")
      .insert({
        content_id: item.id,
        excerpt: excerpt || null,
        body
      });

    if (childError) {
      await client.from("content_items").delete().eq("id", item.id);
      throw childError;
    }

    return item;

  } catch (error) {
    if (uploadedPath) {
      await removeStorageFile(client, uploadedPath);
    }

    throw error;
  }
}


// =====================================================
// ПОЛУЧЕНИЕ НОВОСТИ ДЛЯ РЕДАКТИРОВАНИЯ
// =====================================================

export async function getNewsForEdit(contentId) {
  const { client } = await assertEditor();

  const { data: item, error } = await client
    .from("content_items")
    .select(`
      id,
      type,
      title,
      slug,
      description,
      category,
      cover_path,
      status,
      published_at
    `)
    .eq("id", contentId)
    .eq("type", "news")
    .single();

  if (error) throw error;

  const { data: article, error: articleError } = await client
    .from("news_articles")
    .select("excerpt, body")
    .eq("content_id", contentId)
    .single();

  if (articleError) throw articleError;

  return {
    ...item,
    ...article
  };
}


// =====================================================
// ОБНОВЛЕНИЕ НОВОСТИ
// =====================================================

export async function updateNews(contentId, {
  title,
  slug,
  description,
  category,
  excerpt,
  body,
  coverFile
}) {
  const { client } = await assertEditor();

  const oldNews = await getNewsForEdit(contentId);

  let uploadedPath = null;
  let itemUpdateSucceeded = false;
  let updateCommitted = false;

  try {
    if (coverFile?.size) {
      uploadedPath = await uploadNewsCover(client, coverFile);
    }

    const updateFields = {
      title,
      slug,
      description,
      category: category?.trim() || null
    };

    if (uploadedPath) {
      updateFields.cover_path = uploadedPath;
    }

    const { error: itemError } = await client
      .from("content_items")
      .update(updateFields)
      .eq("id", contentId)
      .eq("type", "news")
      .select("id")
      .single();

    if (itemError) throw itemError;

    itemUpdateSucceeded = true;

    const { error: articleError } = await client
      .from("news_articles")
      .update({
        excerpt: excerpt || null,
        body
      })
      .eq("content_id", contentId)
      .select("content_id")
      .single();

    if (articleError) {
      const { error: rollbackError } = await client
        .from("content_items")
        .update({
          title: oldNews.title,
          slug: oldNews.slug,
          description: oldNews.description,
          category: oldNews.category,
          cover_path: oldNews.cover_path
        })
        .eq("id", contentId)
        .eq("type", "news");

      if (rollbackError) {
        console.error("Не удалось восстановить прежние данные новости:", rollbackError);
      } else {
        itemUpdateSucceeded = false;
      }

      throw articleError;
    }

    updateCommitted = true;

    if (uploadedPath && oldNews.cover_path !== uploadedPath) {
      await removeStorageFile(client, oldNews.cover_path);
    }

    return await getNewsForEdit(contentId);

  } catch (error) {
    if (uploadedPath && !updateCommitted && !itemUpdateSucceeded) {
      await removeStorageFile(client, uploadedPath);
    }

    throw error;
  }
}


// =====================================================
// СОЗДАНИЕ ВИДЕО
// =====================================================

export async function createVideo({
  title,
  slug,
  description,
  youtubeId,
  coverPath,
  publish = false
}) {
  const { client, user } = await assertEditor();

  const { data: item, error } = await client
    .from("content_items")
    .insert({
      type: "video",
      title,
      slug,
      description,
      cover_path: coverPath || null,
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
      created_by: user.id
    })
    .select()
    .single();

  if (error) throw error;

  const { error: childError } = await client
    .from("videos")
    .insert({
      content_id: item.id,
      youtube_id: youtubeId,
      video_url: `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`
    });

  if (childError) {
    await client.from("content_items").delete().eq("id", item.id);
    throw childError;
  }

  return item;
}


// =====================================================
// ПУБЛИКАЦИЯ МАТЕРИАЛА
// =====================================================

export async function publishContent(contentId) {
  const { client } = await assertEditor();

  const { data, error } = await client
    .from("content_items")
    .update({
      status: "published",
      published_at: new Date().toISOString()
    })
    .eq("id", contentId)
    .select()
    .single();

  if (error) throw error;

  return data;
}


// =====================================================
// АРХИВИРОВАНИЕ МАТЕРИАЛА
// =====================================================

export async function archiveContent(contentId) {
  const { client } = await assertEditor();

  const { data, error } = await client
    .from("content_items")
    .update({ status: "archived" })
    .eq("id", contentId)
    .select()
    .single();

  if (error) throw error;

  return data;
}


// =====================================================
// УДАЛЕНИЕ МАТЕРИАЛА
// =====================================================

export async function deleteContent(contentId) {
  const { client } = await assertEditor();

  const { data: item, error: readError } = await client
    .from("content_items")
    .select("cover_path")
    .eq("id", contentId)
    .single();

  if (readError) throw readError;

  const { error } = await client
    .from("content_items")
    .delete()
    .eq("id", contentId);

  if (error) throw error;

  await removeStorageFile(client, item.cover_path);
}


// =====================================================
// СПИСОК МАТЕРИАЛОВ
// =====================================================

export async function listContent({
  type = null,
  limit = 500
} = {}) {
  const { client } = await assertEditor();

  let query = client
    .from("content_items")
    .select(`
      id,
      type,
      title,
      slug,
      status,
      published_at,
      created_at,
      cover_path,
      description,
      category
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}


// =====================================================
// СОЗДАНИЕ СОБЫТИЯ
// =====================================================

export async function createEvent({
  title,
  slug,
  description,
  startsAt,
  endsAt,
  location,
  publish = false
}) {
  const { client, user } = await assertEditor();

  const { data: item, error } = await client
    .from("content_items")
    .insert({
      type: "event",
      title,
      slug,
      description,
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
      created_by: user.id
    })
    .select()
    .single();

  if (error) throw error;

  const { error: childError } = await client
    .from("events")
    .insert({
      content_id: item.id,
      starts_at: startsAt,
      ends_at: endsAt || null,
      location: location || null
    });

  if (childError) {
    await client.from("content_items").delete().eq("id", item.id);
    throw childError;
  }

  return item;
}


// =====================================================
// СОЗДАНИЕ МУЗЫКАЛЬНОГО ТРЕКА
// =====================================================

export async function createTrack({
  title,
  slug,
  description,
  artistId,
  albumId,
  audioPath,
  durationSeconds,
  publish = false
}) {
  const { client, user } = await assertEditor();

  const { data: item, error } = await client
    .from("content_items")
    .insert({
      type: "track",
      title,
      slug,
      description,
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
      created_by: user.id
    })
    .select()
    .single();

  if (error) throw error;

  const { error: childError } = await client
    .from("tracks")
    .insert({
      content_id: item.id,
      artist_id: artistId || null,
      album_id: albumId || null,
      audio_path: audioPath || null,
      duration_seconds: durationSeconds || null
    });

  if (childError) {
    await client.from("content_items").delete().eq("id", item.id);
    throw childError;
  }

  return item;
}
