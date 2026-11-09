
import { requireSupabase, supabase } from "./supabase.js";
import { escapeHTML, showMessage } from "./utils.js";

// ==========================================
// АВТОРИЗАЦИЯ
// ==========================================

// Получение текущего пользователя
export async function getCurrentUser() {
  const client = requireSupabase();

  const { data, error } = await client.auth.getUser();

  if (error) throw error;

  return data.user;
}

// ==========================================
// ПРОВЕРКА ДОСТУПА ПО РОЛИ
// ==========================================

export async function hasSiteAccess() {
  const client = requireSupabase();

  const {
    data: { user },
    error: authError
  } = await client.auth.getUser();

  if (authError) throw authError;

  // Неавторизованный пользователь не имеет доступа
  if (!user) return false;

  const { data, error } = await client.rpc("has_site_access");

  if (error) throw error;

  return data === true;
}


// Блокировка страницы для пользователей без доступа
export async function protectPage() {
  let allowed = false;

  try {
    allowed = await hasSiteAccess();
  } catch (error) {
    console.error("Ошибка проверки доступа:", error);
  }

  if (allowed) return true;

  // Создаём экран ограничения доступа
  const overlay = document.createElement("div");
  overlay.className = "site-access-overlay";

  const {
    data: { user }
  } = await supabase.auth.getUser();

  overlay.innerHTML = `
    <div class="site-access-card">
      <div class="site-access-icon">🔒</div>
      <h1>Доступ ограничен</h1>
      <p>
        ${
          user
            ? "У твоего аккаунта пока нет необходимой роли для доступа к сайту."
            : "Чтобы пользоваться сайтом, необходимо войти в аккаунт."
        }
      </p>
      ${
        user
          ? `<button type="button" id="accessLogout">Выйти из аккаунта</button>`
          : `<button type="button" id="accessLogin">Войти или зарегистрироваться</button>`
      }
    </div>
  `;

  document.body.appendChild(overlay);

  if (user) {
    overlay.querySelector("#accessLogout").addEventListener("click", async () => {
      try {
        await signOut();
        window.location.reload();
      } catch (error) {
        console.error("Ошибка выхода:", error);
      }
    });
  } else {
    overlay.querySelector("#accessLogin").addEventListener("click", () => {
      authDialog().showModal();
    });
  }

  return false;
}

// Регистрация
export async function signUp({
  email,
  password,
  username,
  displayName
}) {
  const client = requireSupabase();

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username.trim(),
        display_name: (displayName || username).trim()
      }
    }
  });

  if (error) throw error;

  return data;
}

// Вход
export async function signIn(email, password) {
  const client = requireSupabase();

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  return data;
}

// Выход
export async function signOut() {
  const client = requireSupabase();

  const { error } = await client.auth.signOut();

  if (error) throw error;
}

// Обновление профиля
export async function updateMyProfile(fields) {
  const client = requireSupabase();

  const {
    data: { user },
    error: userError
  } = await client.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error("Сначала войди в аккаунт.");
  }

  const allowed = {
    display_name: fields.display_name?.trim(),
    avatar_url: fields.avatar_url?.trim(),
    description: fields.description?.trim()
  };

  Object.keys(allowed).forEach((key) => {
    if (allowed[key] === undefined) {
      delete allowed[key];
    }
  });

  if (Object.keys(allowed).length === 0) {
    throw new Error("Нет данных для обновления.");
  }

  const { data, error } = await client
    .from("profiles")
    .update(allowed)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}


// ==========================================
// ОКНО ВХОДА И РЕГИСТРАЦИИ
// ==========================================

function authDialog() {
  let dialog = document.querySelector("#ttfbbAuthDialog");

  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "ttfbbAuthDialog";
  dialog.className = "ttfbb-auth-dialog";

  dialog.innerHTML = `
    <form method="dialog" class="auth-dialog-head">
      <strong>TTFBB ACCOUNT</strong>
      <button class="auth-close" aria-label="Закрыть">×</button>
    </form>

    <div class="auth-tabs">
      <button type="button" data-mode="login" class="is-active">
        Вход
      </button>

      <button type="button" data-mode="register">
        Регистрация
      </button>
    </div>

    <form id="ttfbbAuthForm" class="auth-form">

      <label data-register-only hidden>
        Имя пользователя
        <input
          name="username"
          minlength="3"
          maxlength="32"
          autocomplete="username"
        >
      </label>

      <label data-register-only hidden>
        Отображаемое имя
        <input
          name="displayName"
          maxlength="60"
        >
      </label>

      <label>
        Email
        <input
          name="email"
          type="email"
          required
          autocomplete="email"
        >
      </label>

      <label>
        Пароль
        <input
          name="password"
          type="password"
          required
          minlength="6"
          autocomplete="current-password"
        >
      </label>

      <button class="auth-submit" type="submit">
        Войти
      </button>

      <p class="auth-feedback" aria-live="polite"></p>
    </form>
  `;

  document.body.append(dialog);

  let mode = "login";

  const form = dialog.querySelector("#ttfbbAuthForm");

  const updateMode = (nextMode) => {
    mode = nextMode;

    dialog.querySelectorAll("[data-mode]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.mode === mode
      );
    });

    dialog.querySelectorAll("[data-register-only]").forEach((field) => {
      field.hidden = mode !== "register";

      const input = field.querySelector("input");

      if (input) {
        input.required =
          mode === "register" && input.name === "username";
      }
    });

    form.querySelector(".auth-submit").textContent =
      mode === "login" ? "Войти" : "Создать аккаунт";

    form.elements.password.autocomplete =
      mode === "login" ? "current-password" : "new-password";
  };

  dialog.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      updateMode(button.dataset.mode);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = form.querySelector(".auth-submit");
    const feedback = form.querySelector(".auth-feedback");

    const values = Object.fromEntries(
      new FormData(form).entries()
    );

    submit.disabled = true;
    feedback.textContent = "Подождите…";

    try {
      if (mode === "register") {
        await signUp(values);

        feedback.textContent =
          "Аккаунт создан. Если требуется подтверждение email, проверь почту.";
      } else {
        const result = await signIn(
          values.email,
          values.password
        );

        dialog.close();

        window.location.href =
          `/profile.html?id=${encodeURIComponent(result.user.id)}`;
      }
    } catch (error) {
      console.error("Ошибка авторизации:", error);

      feedback.textContent =
        error.message || "Не удалось выполнить операцию.";
    } finally {
      submit.disabled = false;
    }
  });

  updateMode("login");

  return dialog;
}


// ==========================================
// УВЕДОМЛЕНИЯ
// ==========================================

function getNotificationIcon(type) {
  const icons = {
    friend_request: "👤",
    friend_accepted: "🤝",
    achievement: "🏆",
    event: "📅",
    system: "🔔"
  };

  return icons[type] || "🔔";
}

// Форматирование даты
function formatNotificationDate(date) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

let notificationChannel = null;


// Обновление счётчика
function updateNotificationBadge(count) {
  const badge = document.querySelector("#notificationBadge");

  if (!badge) return;

  badge.textContent = count > 99 ? "99+" : String(count);
  badge.hidden = count === 0;
}


// Загрузка уведомлений
async function loadNotifications(userId) {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, title, body, link_path, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Ошибка загрузки уведомлений:", error);
    return [];
  }

  const notifications = (data || []).map((item) => ({
    ...item,
    is_read: item.read_at !== null
  }));

  updateNotificationBadge(
    notifications.filter((item) => !item.is_read).length
  );

  return notifications;
}


// Отображение уведомлений
function renderNotifications(items) {
  const list = document.querySelector("#notificationList");

  if (!list) return;

  if (!items.length) {
    list.innerHTML = `
      <div class="notification-empty">
        <span>🔔</span>
        <p>Пока уведомлений нет</p>
      </div>
    `;

    return;
  }

  list.innerHTML = items.map((item) => {
    const safeLink =
      typeof item.link_path === "string" &&
      item.link_path.startsWith("/") &&
      !item.link_path.startsWith("//")
        ? item.link_path
        : "";

    return `
      <article
        class="notification-item ${item.is_read ? "" : "is-unread"}"
        data-notification-id="${escapeHTML(item.id)}"
      >
        <span class="notification-icon">
          🔔
        </span>

        <div class="notification-content">
          <strong>${escapeHTML(item.title)}</strong>

          <p>${escapeHTML(item.body)}</p>

          <time>
            ${escapeHTML(formatNotificationDate(item.created_at))}
          </time>

          ${
            safeLink
              ? `<a
                  class="notification-open-link"
                  href="${escapeHTML(safeLink)}"
                  data-open-notification="${escapeHTML(item.id)}"
                >Открыть</a>`
              : ""
          }
        </div>

        ${
          !item.is_read
            ? `<button
                type="button"
                class="notification-read-button"
                data-read-notification="${escapeHTML(item.id)}"
                title="Отметить прочитанным"
                aria-label="Отметить прочитанным"
              >✓</button>`
            : ""
        }
      </article>
    `;
  }).join("");
}


// Отметить одно уведомление прочитанным
async function markNotificationRead(notificationId, userId) {
  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: new Date().toISOString()
    })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
}


// Отметить все уведомления прочитанными
async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: new Date().toISOString()
    })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
}


// ==========================================
// ПАНЕЛЬ УВЕДОМЛЕНИЙ
// ==========================================

function createNotificationPanel(user) {
  const area = document.querySelector("#authArea");

  if (!area || !user) return;

  document.querySelector("#notificationPanel")?.remove();

  const panel = document.createElement("div");

  panel.id = "notificationPanel";
  panel.className = "notification-panel";

  panel.innerHTML = `
    <div class="notification-panel-header">
      <div>
        <strong>Уведомления</strong>
        <span>Твои последние события</span>
      </div>

      <button
        type="button"
        id="markAllNotificationsRead"
        class="notification-mark-all"
      >
        Прочитать все
      </button>
    </div>

    <div id="notificationList" class="notification-list">
      <p class="notification-loading">Загрузка...</p>
    </div>
  `;

  area.appendChild(panel);

  requestAnimationFrame(() => {
    panel.classList.add("is-open");
  });

  const closePanel = () => {
    panel.classList.remove("is-open");

    document.removeEventListener("click", outsideClick);
    document.removeEventListener("keydown", escapeClick);

    setTimeout(() => panel.remove(), 200);
  };

  const outsideClick = (event) => {
    if (!panel.contains(event.target) && !area.contains(event.target)) {
      closePanel();
    }
  };

  const escapeClick = (event) => {
    if (event.key === "Escape") closePanel();
  };

  setTimeout(() => {
    document.addEventListener("click", outsideClick);
    document.addEventListener("keydown", escapeClick);
  }, 0);

  loadNotifications(user.id)
    .then(renderNotifications)
    .catch((error) => {
      console.error("Ошибка отображения уведомлений:", error);

      const list = panel.querySelector("#notificationList");

      if (list) {
        list.innerHTML = `
          <div class="notification-empty">
            <p>Не удалось загрузить уведомления.</p>
          </div>
        `;
      }
    });


  // Прочитать все
  panel.querySelector("#markAllNotificationsRead")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;

      button.disabled = true;

      try {
        await markAllNotificationsRead(user.id);

        const items = await loadNotifications(user.id);

        renderNotifications(items);

        showMessage("Все уведомления прочитаны.");
      } catch (error) {
        console.error("Ошибка обновления уведомлений:", error);

        showMessage(
          "Не удалось обновить уведомления.",
          "error"
        );
      } finally {
        button.disabled = false;
      }
    });


  // Обработка прочтения и открытия уведомлений
  panel.addEventListener("click", async (event) => {
    const readButton = event.target.closest(
      "[data-read-notification]"
    );

    const openLink = event.target.closest(
      "[data-open-notification]"
    );

    const notificationId =
      readButton?.dataset.readNotification ||
      openLink?.dataset.openNotification;

    if (!notificationId) return;

    if (openLink) {
      event.preventDefault();
    }

    try {
      await markNotificationRead(notificationId, user.id);

      const items = await loadNotifications(user.id);

      renderNotifications(items);

      if (openLink) {
        window.location.href = openLink.href;
      }
    } catch (error) {
      console.error("Ошибка прочтения уведомления:", error);

      showMessage(
        "Не удалось отметить уведомление.",
        "error"
      );

      if (openLink) {
        window.location.href = openLink.href;
      }
    }
  });
}


// ==========================================
// REALTIME — НОВЫЕ УВЕДОМЛЕНИЯ
// ==========================================

function subscribeToNotifications(userId) {
  if (!supabase || !userId) return;

  if (notificationChannel) {
    supabase.removeChannel(notificationChannel);
    notificationChannel = null;
  }

  notificationChannel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`
      },
      async () => {
        const items = await loadNotifications(userId);

        const panel = document.querySelector("#notificationPanel");

        if (panel) {
          renderNotifications(items);
        }
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Не удалось подключить обновление уведомлений.");
      }
    });
}


// ==========================================
// МЕНЮ ПРОФИЛЯ
// ==========================================

function profileMenuDialog(profile, user) {
  const area = document.querySelector("#authArea");

  if (!area) return;

  document.querySelector("#ttfbbProfileDropdown")?.remove();

  const label =
    profile?.display_name ||
    profile?.username ||
    user.email ||
    "Пользователь";

  const username = profile?.username
    ? `@${profile.username}`
    : "";

  const menu = document.createElement("div");

  menu.id = "ttfbbProfileDropdown";
  menu.className = "profile-dropdown";

  menu.innerHTML = `
    <div class="profile-dropdown-user">
      <strong>${escapeHTML(label)}</strong>
      <span>${escapeHTML(username)}</span>
    </div>

    <div class="profile-dropdown-divider"></div>

    <a
      href="/profile.html?id=${encodeURIComponent(user.id)}"
      class="profile-dropdown-item"
    >
      <span class="profile-dropdown-icon">◉</span>
      <span>Мой профиль</span>
      <span class="profile-dropdown-arrow">↗</span>
    </a>

    <button
      type="button"
      class="profile-dropdown-item profile-dropdown-logout"
      id="profileDropdownLogout"
    >
      <span class="profile-dropdown-icon">↪</span>
      <span>Выйти из аккаунта</span>
    </button>
  `;

  area.appendChild(menu);

  requestAnimationFrame(() => {
    menu.classList.add("is-open");
  });

  let closing = false;

  const closeMenu = () => {
    if (closing) return;

    closing = true;
    menu.classList.remove("is-open");

    document.removeEventListener("click", outsideClick);
    document.removeEventListener("keydown", escapeClick);

    setTimeout(() => menu.remove(), 200);
  };

  const outsideClick = (event) => {
    if (!menu.contains(event.target) && !area.contains(event.target)) {
      closeMenu();
    }
  };

  const escapeClick = (event) => {
    if (event.key === "Escape") closeMenu();
  };

  setTimeout(() => {
    document.addEventListener("click", outsideClick);
    document.addEventListener("keydown", escapeClick);
  }, 0);

  menu.querySelector("#profileDropdownLogout")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;

      button.disabled = true;

      try {
        await signOut();

        closeMenu();

        await renderAuthArea();

        showMessage("Ты вышел из аккаунта.");
      } catch (error) {
        console.error("Ошибка выхода:", error);

        showMessage(
          error.message || "Не удалось выйти из аккаунта.",
          "error"
        );

        button.disabled = false;
      }
    });
}


// ==========================================
// ОТОБРАЖЕНИЕ АВТОРИЗАЦИИ В ШАПКЕ
// ==========================================

export async function renderAuthArea() {
  const area = document.querySelector("#authArea");

  if (!area) return;

  if (!supabase) {
    area.innerHTML = `
      <a class="auth-link" href="character.html">
        Аккаунт
      </a>
    `;

    return;
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Ошибка авторизации:", authError);
  }

  if (!user) {
    if (notificationChannel) {
      supabase.removeChannel(notificationChannel);
      notificationChannel = null;
    }

    area.innerHTML = `
      <button
        class="auth-link"
        type="button"
        id="authOpen"
      >
        Войти
      </button>
    `;

    area.querySelector("#authOpen")
      ?.addEventListener("click", () => {
        authDialog().showModal();
      });

    return;
  }


  // Получение данных профиля
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Ошибка загрузки профиля:", profileError);
  }

  const label =
    profile?.display_name ||
    profile?.username ||
    user.email ||
    "Пользователь";

  const initial = escapeHTML(
    label.trim().charAt(0).toUpperCase() || "?"
  );

  const avatarUrl = profile?.avatar_url;


  // HTML шапки
  area.innerHTML = `
    <div class="auth-actions">

      <button
        type="button"
        class="notification-bell-button"
        id="notificationBell"
        aria-label="Уведомления"
        aria-expanded="false"
        title="Уведомления"
      >
        <span class="notification-bell-icon">♧</span>

        <span
          class="notification-badge"
          id="notificationBadge"
          hidden
        >0</span>
      </button>

      <button
        type="button"
        class="auth-avatar-button"
        id="authProfileMenu"
        aria-label="Открыть меню профиля"
        title="${escapeHTML(label)}"
        aria-expanded="false"
      >
        ${
          avatarUrl
            ? `<img
                class="auth-avatar-image"
                src="${escapeHTML(avatarUrl)}"
                alt=""
              >`
            : `<span class="auth-avatar-initial">${initial}</span>`
        }
      </button>

    </div>
  `;


  // Запасной вариант, если аватар не загрузился
  const avatarButton = area.querySelector("#authProfileMenu");

  const avatarImage = area.querySelector(".auth-avatar-image");

  if (avatarImage) {
    avatarImage.addEventListener("error", () => {
      avatarButton.innerHTML = `
        <span class="auth-avatar-initial">${initial}</span>
      `;
    });
  }


  // Открытие меню профиля
  avatarButton.addEventListener("click", (event) => {
    event.stopPropagation();

    const existingMenu = document.querySelector(
      "#ttfbbProfileDropdown"
    );

    if (existingMenu) {
      existingMenu.classList.remove("is-open");

      avatarButton.setAttribute("aria-expanded", "false");

      setTimeout(() => existingMenu.remove(), 200);

      return;
    }

    document.querySelector("#notificationPanel")?.remove();

    profileMenuDialog(profile, user);

    avatarButton.setAttribute("aria-expanded", "true");
  });


  // Открытие центра уведомлений
  const bellButton = area.querySelector("#notificationBell");

  bellButton.addEventListener("click", (event) => {
    event.stopPropagation();

    const existingPanel = document.querySelector(
      "#notificationPanel"
    );

    if (existingPanel) {
      existingPanel.classList.remove("is-open");

      bellButton.setAttribute("aria-expanded", "false");

      setTimeout(() => existingPanel.remove(), 200);

      return;
    }

    document.querySelector("#ttfbbProfileDropdown")?.remove();

    createNotificationPanel(user);

    bellButton.setAttribute("aria-expanded", "true");
  });


  // Первичная загрузка счётчика
  await loadNotifications(user.id);

  // Подписка на новые уведомления
  subscribeToNotifications(user.id);


  // Обновление при возвращении на вкладку
  if (!area.dataset.notificationFocusBound) {
    window.addEventListener("focus", async () => {
      try {
        const {
          data: { user: activeUser }
        } = await supabase.auth.getUser();

        if (activeUser) {
          await loadNotifications(activeUser.id);
        }
      } catch (error) {
        console.error("Ошибка обновления уведомлений:", error);
      }
    });

    area.dataset.notificationFocusBound = "true";
  }
}


// ==========================================
// ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ АВТОРИЗАЦИИ
// ==========================================

export function watchAuthChanges() {
  if (!supabase) return;

  supabase.auth.onAuthStateChange(() => {
    queueMicrotask(() => {
      renderAuthArea().catch((error) => {
        console.error("Ошибка обновления шапки:", error);
      });
    });
  });
}
