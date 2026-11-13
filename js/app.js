
import { supabase } from "./supabase.js";
import { renderVideos, renderNewsSpotlight } from "./content.js";
import {
  renderAuthArea,
  watchAuthChanges,
  protectPage
} from "./auth.js";
import { showMessage } from "./utils.js";

// ===============================
// НАВИГАЦИЯ
// ===============================

function initNavigation() {
  let lastScroll = 0;

  const navbar = document.querySelector(".navbar");

  if (navbar) {
    window.addEventListener("scroll", () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll <= 0) {
        navbar.classList.remove("hide");
      } else if (currentScroll > lastScroll) {
        navbar.classList.add("hide");
      } else {
        navbar.classList.remove("hide");
      }

      lastScroll = currentScroll;

      navbar.classList.toggle(
        "scrolled",
        window.scrollY > 20
      );
    }, { passive: true });
  }

  // Мобильное меню
  const burger = document.querySelector(".burger");
  const menu = document.querySelector(".nav-menu");

  burger?.addEventListener("click", () => {
    burger.classList.toggle("active");
    menu?.classList.toggle("active");
  });

  menu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      burger?.classList.remove("active");
      menu?.classList.remove("active");
    });
  });
}

// ===============================
// АВТОРИЗАЦИЯ
// ===============================

async function initAuth() {
  if (!supabase) return;

  try {
    await renderAuthArea();
    watchAuthChanges();
  } catch (error) {
    console.error("Ошибка авторизации:", error);
  }
}

// ===============================
// КОНТЕНТ
// ===============================

async function initContent() {
  if (!supabase) {
    const grid = document.querySelector("#videoGrid");

    if (grid) {
      grid.innerHTML = `
        <p class="db-empty">
          Подключи Supabase, чтобы загружать видео из базы данных.
        </p>
      `;
    }

    return;
  }

  const results = await Promise.allSettled([
    renderVideos("#videoGrid", { limit: 3 }),
    renderNewsSpotlight()
  ]);

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Ошибка загрузки контента:", result.reason);
    }
  });
}

// ===============================
// ЗАПУСК САЙТА
// ===============================

async function init() {
  // Инициализация навигации
  initNavigation();

  // Проверка подключения Supabase
  if (!supabase) {
    showMessage(
      "Supabase пока не настроен: заполни js/config.js",
      "error"
    );
    return;
  }

  // Инициализация авторизации
  await initAuth();

  // Проверка авторизации и особой роли
  const hasAccess = await protectPage();

  // Если доступа нет, прекращаем загрузку
  if (!hasAccess) {
    return;
  }

  // Загружаем контент только при наличии доступа
  await initContent();
}

// ===============================
// ОБРАБОТКА ОШИБОК
// ===============================

init().catch((error) => {
  console.error("Ошибка запуска сайта:", error);

  showMessage(
    error.message || "Ошибка инициализации сайта",
    "error"
  );
});
