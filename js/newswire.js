
import { requireSupabase } from "./supabase.js";
import { escapeHTML, formatDate } from "./utils.js";

const PER_PAGE = 6;
const listSection = document.querySelector("#newsListSection");
const grid = document.querySelector("#news-container");
const pagination = document.querySelector("#news-pagination");
const filtersNode = document.querySelector("#newsFilters");
const detailSection = document.querySelector("#newsDetailSection");
const detailNode = document.querySelector("#newsDetail");
const searchInput = document.querySelector("#searchInput");
const searchBtn = document.querySelector("#searchBtn");

let allNews = [];
let currentPage = 1;
let currentFilter = "all";
let currentSearch = "";

// =====================================================
// ОБЛОЖКИ
// =====================================================

function coverUrl(path) {
  if (!path) return "/images/TTFBB-MUSIC.png";

  const { data } = requireSupabase()
    .storage
    .from("ttfbb-media")
    .getPublicUrl(path);

  return data?.publicUrl || "/images/TTFBB-MUSIC.png";
}

// =====================================================
// ДАННЫЕ НОВОСТИ
// =====================================================

function articleFrom(row) {
  const value = row.news_articles;
  return Array.isArray(value) ? (value[0] || {}) : (value || {});
}

function safeDate(value) {
  return value ? formatDate(value) : "";
}

// Получаем адрес отдельной HTML-страницы.
// Если адрес не задан, используем старую страницу новости.
function getNewsPageUrl(item) {
  const article = articleFrom(item);
  const pageUrl = article.page_url?.trim();

  return pageUrl || `/newswire.html?slug=${encodeURIComponent(item.slug || "")}`;
}

// =====================================================
// ФИЛЬТРАЦИЯ НОВОСТЕЙ
// =====================================================

function getFilteredNews() {
  return allNews.filter((item) => {
    const categoryMatch =
      currentFilter === "all" ||
      (item.category || "TTFBB COMPANY") === currentFilter;

    const haystack = `
      ${item.title || ""}
      ${item.description || ""}
      ${articleFrom(item).excerpt || ""}
    `.toLocaleLowerCase("ru");

    return categoryMatch && (!currentSearch || haystack.includes(currentSearch));
  });
}

// =====================================================
// ФИЛЬТРЫ
// =====================================================

function renderFilters() {
  const categories = [
    ...new Set(allNews.map((item) => item.category).filter(Boolean))
  ];

  const buttons = [
    { value: "all", label: "Все новости" },
    ...categories.map((value) => ({ value, label: value }))
  ];

  filtersNode.innerHTML = buttons.map(({ value, label }) => `
    <button
      type="button"
      class="news-filter-btn ${currentFilter === value ? "active" : ""}"
      data-filter="${escapeHTML(value)}"
    >
      ${escapeHTML(label)}
    </button>
  `).join("");
}

// =====================================================
// ПАГИНАЦИЯ
// =====================================================

function renderPagination(total) {
  const pages = Math.ceil(total / PER_PAGE);

  if (pages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = `
    <button
      class="news-pagination-btn ${currentPage === 1 ? "disabled" : ""}"
      data-page="${currentPage - 1}"
      ${currentPage === 1 ? "disabled" : ""}
      aria-label="Предыдущая страница"
    >
      <i class="fas fa-chevron-left"></i>
    </button>
  `;

  for (let i = 1; i <= pages; i++) {
    html += `
      <button
        class="news-pagination-btn ${i === currentPage ? "active" : ""}"
        data-page="${i}"
      >
        ${i}
      </button>
    `;
  }

  html += `
    <button
      class="news-pagination-btn ${currentPage === pages ? "disabled" : ""}"
      data-page="${currentPage + 1}"
      ${currentPage === pages ? "disabled" : ""}
      aria-label="Следующая страница"
    >
      <i class="fas fa-chevron-right"></i>
    </button>
  `;

  pagination.innerHTML = html;
}

// =====================================================
// ОТОБРАЖЕНИЕ СПИСКА НОВОСТЕЙ
// =====================================================

function renderList() {
  const filtered = getFilteredNews();

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  if (currentPage > pages) currentPage = pages;

  const visible = filtered.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  if (!visible.length) {
    grid.innerHTML = `
      <div class="news-state">
        <i class="fas fa-newspaper"></i>
        <h3>Новостей не найдено</h3>
        <p>Попробуйте изменить фильтр или поисковый запрос.</p>
      </div>
    `;

    renderPagination(0);
    return;
  }

  grid.innerHTML = visible.map((item) => {
    const article = articleFrom(item);
    const excerpt = article.excerpt || item.description || "";
    const category = item.category || "TTFBB COMPANY";
    const image = coverUrl(item.cover_path);
    const pageUrl = getNewsPageUrl(item);

    return `
      <a href="${escapeHTML(pageUrl)}" class="news-card">
        <div class="news-card-image">
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(item.title)}"
            loading="lazy"
          >
          <span class="news-card-badge update">
            ${escapeHTML(category)}
          </span>
        </div>

        <div class="news-card-content">
          <div class="news-card-meta">
            <span class="news-card-date">
              <i class="far fa-calendar"></i>
              ${escapeHTML(safeDate(item.published_at))}
            </span>

            <span class="news-card-category">
              ${escapeHTML(category)}
            </span>
          </div>

          <h3 class="news-card-title">
            ${escapeHTML(item.title)}
          </h3>

          <p class="news-card-excerpt">
            ${escapeHTML(excerpt)}
          </p>

          <div class="news-card-footer">
            <span class="news-card-author">
              <i class="fas fa-user"></i>
              TTFBB COMPANY
            </span>

            <span class="news-read-more">
              Читать <i class="fas fa-arrow-right"></i>
            </span>
          </div>
        </div>
      </a>
    `;
  }).join("");

  renderPagination(filtered.length);
}

// =====================================================
// ЗАГРУЗКА НОВОСТЕЙ ИЗ SUPABASE
// =====================================================

async function loadNews() {
  grid.innerHTML = `
    <div class="news-state">
      Загружаем новости из Supabase…
    </div>
  `;

  const { data, error } = await requireSupabase()
    .from("content_items")
    .select(`
      id,
      title,
      slug,
      description,
      cover_path,
      category,
      published_at,
      news_articles (
        excerpt,
        body,
        page_url
      )
    `)
    .eq("type", "news")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) throw error;

  allNews = data || [];

  renderFilters();

  const slug = new URLSearchParams(window.location.search).get("slug");

  if (slug) {
    await renderArticle(slug);
    return;
  }

  detailSection.hidden = true;
  listSection.hidden = false;

  renderList();
}

// =====================================================
// ОТКРЫТИЕ СТАРОЙ СТРАНИЦЫ НОВОСТИ
// =====================================================

async function renderArticle(slug) {
  const row = allNews.find((item) => item.slug === slug);

  if (!row) {
    const { data, error } = await requireSupabase()
      .from("content_items")
      .select(`
        id,
        title,
        slug,
        description,
        cover_path,
        category,
        published_at,
        news_articles (
          excerpt,
          body,
          page_url
        )
      `)
      .eq("type", "news")
      .eq("status", "published")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "Эта новость не найдена или больше не опубликована."
      );
    }

    allNews.unshift(data);

    return renderArticleContent(data);
  }

  renderArticleContent(row);
}

// =====================================================
// ОТОБРАЖЕНИЕ СТАРОЙ СТРАНИЦЫ НОВОСТИ
// =====================================================

function renderArticleContent(row) {
  const article = articleFrom(row);
  const image = coverUrl(row.cover_path);

  detailNode.innerHTML = `
    <a class="news-back-link" href="/newswire.html">
      <i class="fas fa-arrow-left"></i>
      &nbsp; Ко всем новостям
    </a>

    <article class="news-detail-card">
      ${
        row.cover_path
          ? `
            <img
              class="news-detail-cover"
              src="${escapeHTML(image)}"
              alt="${escapeHTML(row.title)}"
            >
          `
          : ""
      }

      <div class="news-detail-content">
        <div class="news-detail-meta">
          <span>
            ${escapeHTML(row.category || "TTFBB COMPANY")}
          </span>

          <span>
            ${escapeHTML(safeDate(row.published_at))}
          </span>
        </div>

        <h1>${escapeHTML(row.title)}</h1>

        ${
          article.excerpt
            ? `
              <p class="news-card-excerpt">
                ${escapeHTML(article.excerpt)}
              </p>
            `
            : ""
        }

        <div class="news-detail-body">
          ${escapeHTML(
            article.body ||
            row.description ||
            "Текст новости пока не добавлен."
          )}
        </div>
      </div>
    </article>
  `;

  listSection.hidden = true;
  detailSection.hidden = false;

  document.title = `${row.title} · TTFBB COMPANY`;
}

// =====================================================
// ОБРАБОТКА ФИЛЬТРОВ
// =====================================================

filtersNode.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");

  if (!button) return;

  currentFilter = button.dataset.filter;
  currentPage = 1;

  renderFilters();
  renderList();
});

// =====================================================
// ОБРАБОТКА ПАГИНАЦИИ
// =====================================================

pagination.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");

  if (!button || button.disabled) return;

  currentPage = Number(button.dataset.page) || 1;

  renderList();

  window.scrollTo({
    top: 180,
    behavior: "smooth"
  });
});

// =====================================================
// ПОИСК
// =====================================================

searchBtn?.addEventListener("click", (event) => {
  event.preventDefault();

  searchInput?.classList.toggle("active");

  if (searchInput?.classList.contains("active")) {
    searchInput.focus();
  }
});

searchInput?.addEventListener("input", () => {
  currentSearch = searchInput.value
    .trim()
    .toLocaleLowerCase("ru");

  currentPage = 1;

  if (!detailSection.hidden) return;

  renderList();
});

searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    currentSearch = searchInput.value
      .trim()
      .toLocaleLowerCase("ru");

    currentPage = 1;

    if (!detailSection.hidden) {
      window.location.href = "/newswire.html";
      return;
    }

    renderList();
  }
});

document.addEventListener("click", (event) => {
  if (!searchInput || !searchBtn) return;

  if (
    !searchInput.contains(event.target) &&
    !searchBtn.contains(event.target) &&
    !searchInput.value
  ) {
    searchInput.classList.remove("active");
  }
});

// =====================================================
// НАВИГАЦИЯ ПРИ ПРОКРУТКЕ
// =====================================================

let lastScroll = 0;

const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll <= 0) {
    navbar?.classList.remove("hide");
  } else if (currentScroll > lastScroll) {
    navbar?.classList.add("hide");
  } else {
    navbar?.classList.remove("hide");
  }

  lastScroll = currentScroll;

  navbar?.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });

// =====================================================
// МОБИЛЬНОЕ МЕНЮ
// =====================================================

const burger = document.querySelector(".burger");
const menu = document.querySelector(".nav-menu");

burger?.addEventListener("click", () => {
  burger.classList.toggle("active");
  menu?.classList.toggle("active");
  searchInput?.classList.remove("active");
});

menu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    burger?.classList.remove("active");
    menu?.classList.remove("active");
  });
});

// =====================================================
// ЗАПУСК
// =====================================================

try {
  await loadNews();
} catch (error) {
  console.error("TTFBB NEWSWIRE:", error);

  grid.innerHTML = `
    <div class="news-state">
      Не удалось загрузить новости:
      ${escapeHTML(error.message || "ошибка Supabase")}
    </div>
  `;
}
