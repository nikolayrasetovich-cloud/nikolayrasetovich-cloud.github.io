
// =====================================================
// TTFBB COMPANY — ADMIN PANEL
// =====================================================

import { supabase } from "./supabase.js";

import {
  renderAuthArea,
  watchAuthChanges
} from "./auth.js";

import {
  createNews,
  createVideo,
  listContent,
  publishContent,
  archiveContent,
  deleteContent,
  getNewsForEdit,
  updateNews,
  listNewsCategories,
  createNewsCategory,
  renameNewsCategory,
  deleteNewsCategory
} from "./admin.js";

import {
  showMessage,
  escapeHTML
} from "./utils.js";

// =====================================================
// ЭЛЕМЕНТЫ СТРАНИЦЫ
// =====================================================

const statusNode = document.querySelector("#adminStatus");
const rowsNode = document.querySelector("#contentRows");
const newsForm = document.querySelector("#newsForm");
const videoForm = document.querySelector("#videoForm");
const editPanel = document.querySelector("#editNewsPanel");
const editForm = document.querySelector("#editNewsForm");
const newCoverPreview = document.querySelector("#newCoverPreview");
const editCoverPreview = document.querySelector("#editCoverPreview");
const refreshButton = document.querySelector("#refreshContent");

let newCoverObjectUrl = null;
let editCoverObjectUrl = null;
let allItems = [];
let allCategories = [];

// =====================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================================

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = getElement(id);
  if (node) node.textContent = String(value);
}

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function categoryName(value) {
  return value || "Без категории";
}

function getUniqueNewsCategories() {
  const names = new Set(
    allCategories.map((category) => category.name)
  );

  allItems
    .filter((item) => item.type === "news" && item.category)
    .forEach((item) => names.add(item.category));

  return [...names].sort((a, b) => a.localeCompare(b));
}

// =====================================================
// ПРОВЕРКА ПРАВ ДОСТУПА
// =====================================================

async function requireAdminAccess() {
  if (!supabase) {
    throw new Error("Сначала настрой js/config.js.");
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) throw error;

  if (!user) {
    throw new Error("Войди в аккаунт через кнопку в шапке.");
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) throw roleError;

  const isAllowed = (roles || []).some((row) =>
    ["admin", "editor"].includes(row.role)
  );

  if (!isAllowed) {
    throw new Error("У аккаунта нет роли Editor или Admin.");
  }

  statusNode.textContent = `Доступ разрешён: ${user.email}`;
}

// =====================================================
// ПОЛУЧЕНИЕ URL ОБЛОЖКИ
// =====================================================

async function getCoverUrl(path) {
  if (!path) return "";

  if (/^https?:\/\//i.test(path) || path.startsWith("/")) {
    return path;
  }

  const bucket = "ttfbb-media";

  const normalizedPath = path.startsWith(`${bucket}/`)
    ? path.slice(bucket.length + 1)
    : path;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(normalizedPath, 3600);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(normalizedPath);

  return publicData?.publicUrl || "";
}

// =====================================================
// ПРЕДПРОСМОТР ИЗОБРАЖЕНИЙ
// =====================================================

function showFilePreview(input, preview, mode) {
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showMessage("Выбери файл изображения.", "error");
    input.value = "";
    return;
  }

  const objectUrl = URL.createObjectURL(file);

  if (mode === "new") {
    if (newCoverObjectUrl) {
      URL.revokeObjectURL(newCoverObjectUrl);
    }

    newCoverObjectUrl = objectUrl;
  } else {
    if (editCoverObjectUrl) {
      URL.revokeObjectURL(editCoverObjectUrl);
    }

    editCoverObjectUrl = objectUrl;
  }

  preview.src = objectUrl;
  preview.hidden = false;
}

newsForm.elements.coverFile?.addEventListener("change", () => {
  showFilePreview(
    newsForm.elements.coverFile,
    newCoverPreview,
    "new"
  );
});

// =====================================================
// СТАТИСТИКА ГЛАВНОЙ ПАНЕЛИ
// =====================================================

function updateDashboard() {
  const news = allItems.filter((item) => item.type === "news");
  const videos = allItems.filter((item) => item.type === "video");

  const published = allItems.filter(
    (item) => item.status === "published"
  );

  const drafts = allItems.filter(
    (item) => item.status === "draft"
  );

  const archived = allItems.filter(
    (item) => item.status === "archived"
  );

  setText("statTotalNews", news.length);
  setText("statPublished", published.length);
  setText("statDrafts", drafts.length);
  setText("statArchived", archived.length);
  setText("statVideos", videos.length);
  setText("statTotalMaterials", allItems.length);
}

// =====================================================
// ЗАПОЛНЕНИЕ ВЫБОРА КАТЕГОРИЙ
// =====================================================

function populateCategorySelect(select, selectedValue = "") {
  if (!select) return;

  const names = getUniqueNewsCategories();

  select.innerHTML = `
    <option value="">Без категории</option>
    ${names.map((name) => `
      <option value="${escapeHTML(name)}">
        ${escapeHTML(name)}
      </option>
    `).join("")}
  `;

  select.value = selectedValue || "";
}

function updateCategoryInputs() {
  populateCategorySelect(newsForm.elements.category);
  populateCategorySelect(editForm.elements.category);
}

// =====================================================
// ФИЛЬТРЫ СПИСКА МАТЕРИАЛОВ
// =====================================================

function setupFilters() {
  const categoryFilter = getElement("filterCategory");

  if (categoryFilter) {
    const currentValue = categoryFilter.value;

    categoryFilter.innerHTML = `
      <option value="">Все категории</option>
      ${getUniqueNewsCategories().map((name) => `
        <option value="${escapeHTML(name)}">
          ${escapeHTML(name)}
        </option>
      `).join("")}
    `;

    categoryFilter.value = currentValue;
  }
}

function getFilteredItems() {
  const search = normalize(getElement("contentSearch")?.value);
  const type = getElement("filterType")?.value || "";
  const status = getElement("filterStatus")?.value || "";
  const category = getElement("filterCategory")?.value || "";

  return allItems.filter((item) => {
    const matchesSearch = !search || [
      item.title,
      item.slug,
      item.description
    ].some((value) => normalize(value).includes(search));

    const matchesType = !type || item.type === type;
    const matchesStatus = !status || item.status === status;

    const matchesCategory =
      !category ||
      (item.type === "news" && item.category === category);

    return (
      matchesSearch &&
      matchesType &&
      matchesStatus &&
      matchesCategory
    );
  });
}

// =====================================================
// ОТОБРАЖЕНИЕ СПИСКА МАТЕРИАЛОВ
// =====================================================

function renderContentList() {
  const items = getFilteredItems();

  const rows = items.map((item) => {
    const editButton = item.type === "news"
      ? `
        <button
          type="button"
          data-action="edit"
          data-id="${escapeHTML(item.id)}"
        >
          Редактировать
        </button>
      `
      : "";

    const publishButton = item.status !== "published"
      ? `
        <button
          type="button"
          data-action="publish"
          data-id="${escapeHTML(item.id)}"
        >
          Опубликовать
        </button>
      `
      : "";

    const archiveButton = item.status !== "archived"
      ? `
        <button
          type="button"
          data-action="archive"
          data-id="${escapeHTML(item.id)}"
        >
          В архив
        </button>
      `
      : "";

    const category = item.type === "news"
      ? categoryName(item.category)
      : "—";

    return `
      <tr>
        <td>${escapeHTML(item.type)}</td>
        <td>${escapeHTML(item.title)}</td>
        <td>${escapeHTML(category)}</td>
        <td>
          <span class="admin-status admin-status-${escapeHTML(item.status)}">
            ${escapeHTML(item.status)}
          </span>
        </td>
        <td class="admin-actions">
          ${editButton}
          ${publishButton}
          ${archiveButton}
          <button
            type="button"
            data-action="delete"
            data-id="${escapeHTML(item.id)}"
            class="danger"
          >
            Удалить
          </button>
        </td>
      </tr>
    `;
  });

  rowsNode.innerHTML = rows.join("") || `
    <tr>
      <td colspan="5">Материалов не найдено.</td>
    </tr>
  `;

  setText("filteredCount", items.length);
}

// =====================================================
// ОБНОВЛЕНИЕ КАТЕГОРИЙ
// =====================================================

async function refreshCategories() {
  allCategories = await listNewsCategories();
  updateCategoryInputs();
  setupFilters();
  renderCategoryManager();
}

// =====================================================
// УПРАВЛЕНИЕ КАТЕГОРИЯМИ
// =====================================================

function renderCategoryManager() {
  const container = getElement("categoryRows");
  if (!container) return;

  const names = getUniqueNewsCategories();

  container.innerHTML = names.map((name) => {
    const category = allCategories.find(
      (item) => item.name === name
    );

    const count = allItems.filter(
      (item) => item.type === "news" && item.category === name
    ).length;

    if (!category) {
      return `
        <div class="category-row">
          <span>${escapeHTML(name)}</span>
          <span>${count} новостей</span>
        </div>
      `;
    }

    return `
      <div class="category-row">
        <span>${escapeHTML(name)}</span>
        <span>${count} новостей</span>
        <button
          type="button"
          data-category-action="rename"
          data-id="${escapeHTML(category.id)}"
        >
          Переименовать
        </button>
        <button
          type="button"
          class="danger"
          data-category-action="delete"
          data-id="${escapeHTML(category.id)}"
        >
          Удалить
        </button>
      </div>
    `;
  }).join("") || "<p>Категорий пока нет.</p>";
}

// =====================================================
// ДОБАВЛЕНИЕ КАТЕГОРИИ
// =====================================================

const addCategoryForm = getElement("addCategoryForm");

addCategoryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = getElement("newCategoryName");
  const name = input?.value.trim();

  if (!name) {
    showMessage("Введи название категории.", "error");
    return;
  }

  try {
    await createNewsCategory(name);

    if (input) input.value = "";

    await refreshCategories();

    showMessage("Категория добавлена.", "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  }
});

// =====================================================
// ПЕРЕИМЕНОВАНИЕ И УДАЛЕНИЕ КАТЕГОРИЙ
// =====================================================

const categoryRows = getElement("categoryRows");

categoryRows?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-category-action]");
  if (!button) return;

  const { categoryAction, id } = button.dataset;

  const category = allCategories.find((item) => item.id === id);
  if (!category) return;

  try {
    button.disabled = true;

    if (categoryAction === "rename") {
      const newName = prompt(
        "Новое название категории:",
        category.name
      );

      if (newName === null) return;

      await renameNewsCategory(id, newName);
      showMessage("Категория переименована.", "success");
    }

    if (categoryAction === "delete") {
      const confirmed = confirm(
        `Удалить категорию "${category.name}"? Новости сохранятся без категории.`
      );

      if (!confirmed) return;

      await deleteNewsCategory(id);
      showMessage("Категория удалена.", "success");
    }

    await refreshList();
    await refreshCategories();
  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

// =====================================================
// ПОИСК И ФИЛЬТРЫ
// =====================================================

[
  "contentSearch",
  "filterType",
  "filterStatus",
  "filterCategory"
].forEach((id) => {
  getElement(id)?.addEventListener("input", renderContentList);
  getElement(id)?.addEventListener("change", renderContentList);
});

getElement("resetFilters")?.addEventListener("click", () => {
  [
    "contentSearch",
    "filterType",
    "filterStatus",
    "filterCategory"
  ].forEach((id) => {
    const element = getElement(id);
    if (element) element.value = "";
  });

  renderContentList();
});

// =====================================================
// ОБНОВЛЕНИЕ СПИСКА И СТАТИСТИКИ
// =====================================================

async function refreshList() {
  rowsNode.innerHTML = `
    <tr>
      <td colspan="5">Загрузка материалов…</td>
    </tr>
  `;

  allItems = await listContent({ limit: 500 });

  updateDashboard();
  setupFilters();
  renderContentList();
  renderCategoryManager();
}

refreshButton?.addEventListener("click", async () => {
  try {
    await refreshList();
    await refreshCategories();

    showMessage("Список обновлён.", "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  }
});

// =====================================================
// СОЗДАНИЕ НОВОСТИ
// =====================================================

newsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;

  const values = Object.fromEntries(
    new FormData(form).entries()
  );

  const submitButton = form.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = "Создаём…";

  try {
    await createNews({
      ...values,
      pageUrl: values.pageUrl,
      coverFile: form.elements.coverFile.files[0] || null,
      publish: form.elements.publish.checked
    });

    form.reset();

    newCoverPreview.hidden = true;
    newCoverPreview.removeAttribute("src");

    if (newCoverObjectUrl) {
      URL.revokeObjectURL(newCoverObjectUrl);
      newCoverObjectUrl = null;
    }

    showMessage("Новость успешно создана.", "success");

    await refreshList();
    await refreshCategories();
  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Создать новость";
  }
});

// =====================================================
// СОЗДАНИЕ ВИДЕО
// =====================================================

videoForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;

  const values = Object.fromEntries(
    new FormData(form).entries()
  );

  const submitButton = form.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = "Добавляем…";

  try {
    await createVideo({
      ...values,
      publish: form.elements.publish.checked
    });

    form.reset();

    showMessage("Видео добавлено.", "success");

    await refreshList();
  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Добавить видео";
  }
});

// =====================================================
// ОТКРЫТИЕ ФОРМЫ РЕДАКТИРОВАНИЯ
// =====================================================

async function openEditForm(contentId) {
  try {
    editPanel.hidden = false;

    editPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    editForm.reset();

    editCoverPreview.hidden = true;
    editCoverPreview.removeAttribute("src");

    const titleNode = editPanel.querySelector("h2");
    titleNode.textContent = "Загрузка новости…";

    const news = await getNewsForEdit(contentId);

    editForm.elements.contentId.value = news.id;
    editForm.elements.title.value = news.title || "";
    editForm.elements.slug.value = news.slug || "";
    editForm.elements.description.value = news.description || "";
    editForm.elements.excerpt.value = news.excerpt || "";
    editForm.elements.body.value = news.body || "";

    // Загружаем сохранённый URL отдельной страницы новости.
    if (editForm.elements.pageUrl) {
      editForm.elements.pageUrl.value = news.page_url || "";
    }

    populateCategorySelect(
      editForm.elements.category,
      news.category || ""
    );

    editForm.elements.coverFile.value = "";
    editForm.dataset.currentCoverPath = news.cover_path || "";

    const coverUrl = await getCoverUrl(news.cover_path);

    if (coverUrl) {
      editCoverPreview.src = coverUrl;
      editCoverPreview.hidden = false;
    }

    titleNode.textContent = "Редактировать новость";
  } catch (error) {
    console.error(error);

    editPanel.hidden = true;

    showMessage(
      `Не удалось открыть новость: ${error.message}`,
      "error"
    );
  }
}

// =====================================================
// ПРЕДПРОСМОТР ОБЛОЖКИ ПРИ РЕДАКТИРОВАНИИ
// =====================================================

editForm.elements.coverFile.addEventListener("change", () => {
  showFilePreview(
    editForm.elements.coverFile,
    editCoverPreview,
    "edit"
  );
});

// =====================================================
// СОХРАНЕНИЕ НОВОСТИ
// =====================================================

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const contentId = form.elements.contentId.value;

  const values = Object.fromEntries(
    new FormData(form).entries()
  );

  const submitButton = form.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = "Сохраняем…";

  try {
    await updateNews(contentId, {
      title: values.title,
      slug: values.slug,
      category: values.category,
      description: values.description,
      excerpt: values.excerpt,
      body: values.body,
      pageUrl: values.pageUrl,
      coverFile: form.elements.coverFile.files[0] || null
    });

    showMessage("Новость успешно обновлена.", "success");

    closeEditForm();

    await refreshList();
    await refreshCategories();
  } catch (error) {
    console.error(error);

    showMessage(
      `Не удалось сохранить изменения: ${error.message}`,
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Сохранить изменения";
  }
});

// =====================================================
// ЗАКРЫТИЕ ФОРМЫ РЕДАКТИРОВАНИЯ
// =====================================================

function closeEditForm() {
  editPanel.hidden = true;
  editForm.reset();

  editCoverPreview.hidden = true;
  editCoverPreview.removeAttribute("src");

  delete editForm.dataset.currentCoverPath;

  if (editCoverObjectUrl) {
    URL.revokeObjectURL(editCoverObjectUrl);
    editCoverObjectUrl = null;
  }
}

getElement("cancelEditNews")?.addEventListener("click", closeEditForm);

// =====================================================
// ДЕЙСТВИЯ В СПИСКЕ МАТЕРИАЛОВ
// =====================================================

rowsNode.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "edit") {
    await openEditForm(id);
    return;
  }

  if (
    action === "delete" &&
    !confirm("Точно удалить материал?")
  ) {
    return;
  }

  try {
    button.disabled = true;

    if (action === "publish") {
      await publishContent(id);
    }

    if (action === "archive") {
      await archiveContent(id);
    }

    if (action === "delete") {
      await deleteContent(id);
    }

    await refreshList();

    showMessage("Изменения сохранены.", "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

// =====================================================
// ЗАПУСК АДМИН-ПАНЕЛИ
// =====================================================

try {
  await renderAuthArea();
  watchAuthChanges();

  await requireAdminAccess();

  await refreshList();
  await refreshCategories();
} catch (error) {
  console.error(error);
  statusNode.textContent = error.message;
}
