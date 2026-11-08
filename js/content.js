import { requireSupabase } from "./supabase.js";
import { escapeHTML, formatDate } from "./utils.js";

function videoCard(row) {
  const video = row.videos?.[0] || row.videos || {};
  const youtubeId = video.youtube_id;
  const thumbnail = row.cover_path
    ? requireSupabase().storage.from("ttfbb-media").getPublicUrl(row.cover_path).data.publicUrl
    : `https://img.youtube.com/vi/${encodeURIComponent(youtubeId || "")}/sddefault.jpg`;
  const url = video.video_url || `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId || "")}`;
  return `
    <article class="video-card">
      <div class="video-wrapper">
        <img class="video-thumbnail" src="${escapeHTML(thumbnail)}" alt="${escapeHTML(row.title)}" loading="lazy">
        <div class="video-overlay">
          <a class="video-play-btn" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" aria-label="Смотреть ${escapeHTML(row.title)}">
            <i class="fas fa-play"></i>
          </a>
        </div>
        <div class="video-date-badge"><i class="fas fa-calendar-alt"></i> ${escapeHTML(formatDate(row.published_at))}</div>
      </div>
      <div class="video-card-content">
        <h3>${escapeHTML(row.title)}</h3>
        <p>${escapeHTML(row.description || "")}</p>
        <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="watch-btn">
          <i class="fab fa-youtube"></i> Смотреть на YouTube
        </a>
      </div>
    </article>`;
}

export async function getVideos({ limit = 3 } = {}) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("content_items")
    .select("id,title,slug,description,cover_path,published_at,videos(youtube_id,video_url,duration_seconds)")
    .eq("type", "video")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function renderVideos(target = "#videoGrid", options = {}) {
  const container = document.querySelector(target);
  if (!container) return;
  try {
    const rows = await getVideos(options);
    container.innerHTML = rows.length
      ? rows.map(videoCard).join("")
      : `<p class="db-empty">Пока нет опубликованных видео.</p>`;
  } catch (error) {
    console.error("TTFBB videos:", error);
    container.innerHTML = `<p class="db-error">Не удалось загрузить видео из базы. Проверь настройки Supabase.</p>`;
  }
}

export async function getNews({ limit = 5 } = {}) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("content_items")
    .select("id,title,slug,description,cover_path,category,published_at,news_articles(excerpt)")
    .eq("type", "news")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function renderNewsSpotlight() {
  const main = document.querySelector("#newsMain");
  const sidebar = document.querySelector("#newsSidebar");
  if (!main || !sidebar) return;
  try {
    const rows = await getNews({ limit: 5 });
    if (!rows.length) {
      main.hidden = true;
      sidebar.innerHTML = `<p class="db-empty">Новости скоро появятся.</p>`;
      return;
    }
    const [featured, ...rest] = rows;
    const cover = featured.cover_path
      ? requireSupabase().storage.from("ttfbb-media").getPublicUrl(featured.cover_path).data.publicUrl
      : "/images/TTFBB-MUSIC.png";
    main.href = `/newswire.html?slug=${encodeURIComponent(featured.slug)}`;
    main.querySelector(".news-main-img").style.backgroundImage = `url("${cover.replace(/["\\]/g, "")}")`;
    main.querySelector(".news-category").textContent = featured.category || "TTFBB COMPANY";
    main.querySelector("h2").textContent = featured.title;
    main.querySelector(".news-date").textContent = formatDate(featured.published_at);
    sidebar.innerHTML = rest.map((item) => {
      const image = item.cover_path
        ? requireSupabase().storage.from("ttfbb-media").getPublicUrl(item.cover_path).data.publicUrl
        : "/images/TTFBB-MUSIC.png";
      return `<a href="/newswire.html?slug=${encodeURIComponent(item.slug)}" class="news-mini-item">
        <div class="news-mini-img" style="background-image:url('${escapeHTML(image)}')"></div>
        <div class="news-mini-info">
          <span class="news-category">${escapeHTML(item.category || "TTFBB COMPANY")}</span>
          <h3>${escapeHTML(item.title)}</h3>
          <span class="news-date">${escapeHTML(formatDate(item.published_at))}</span>
        </div>
      </a>`;
    }).join("");
  } catch (error) {
    console.error("TTFBB news:", error);
    sidebar.innerHTML = `<p class="db-error">Не удалось загрузить новости.</p>`;
  }
}
