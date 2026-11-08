
import { requireSupabase } from "./supabase.js";
import { getCurrentUser } from "./auth.js";
import { escapeHTML, showMessage } from "./utils.js";

const supabase = requireSupabase();

const escape = (value) => escapeHTML(value ?? "");

export async function initFriendsUI() {
  const section = document.querySelector("#friendsSection");
  if (!section) return;

  const user = await getCurrentUser();

  if (!user) {
    section.innerHTML = `
      <div class="friends-container">
        <h2>Друзья</h2>
        <p>Войди в аккаунт, чтобы искать друзей и отправлять заявки.</p>
      </div>
    `;
    return;
  }

  section.innerHTML = `
    <div class="friends-container">
      <h2>Друзья</h2>

      <form id="friendSearchForm" class="friend-search">
        <label for="friendUsername">Добавить друга по username</label>
        <div class="friend-search-row">
          <input
            id="friendUsername"
            name="username"
            type="text"
            placeholder="Например, nesoqiton"
            minlength="3"
            maxlength="32"
            pattern="[a-zA-Z0-9_]+"
            required
          >
          <button type="submit">Найти</button>
        </div>
      </form>

      <div id="friendSearchResult" aria-live="polite"></div>

      <div class="friend-requests">
        <h3>Входящие заявки</h3>
        <div id="incomingRequests">
          <p>Загрузка...</p>
        </div>
      </div>

      <div class="friend-list">
        <h3>Мои друзья</h3>
        <div id="friendsList">
          <p>Загрузка...</p>
        </div>
      </div>
    </div>
  `;

  document.querySelector("#friendSearchForm")
    ?.addEventListener("submit", searchFriend);

  await Promise.all([
    loadIncomingRequests(),
    loadFriends()
  ]);
}

async function searchFriend(event) {
  event.preventDefault();

  const input = document.querySelector("#friendUsername");
  const result = document.querySelector("#friendSearchResult");
  const username = input.value.trim().toLowerCase();

  result.innerHTML = "<p>Ищем пользователя...</p>";

  const { data, error } = await supabase.rpc(
    "find_user_by_username",
    { search_username: username }
  );

  if (error) {
    console.error(error);
    result.textContent = "Не удалось выполнить поиск.";
    return;
  }

  const profile = data?.[0];

  if (!profile) {
    result.textContent = "Пользователь не найден.";
    return;
  }

  result.innerHTML = `
    <div class="friend-item">
      <div class="friend-info">
        <strong>${escape(profile.display_name)}</strong>
        <span>@${escape(profile.username)}</span>
      </div>
      <button type="button" id="sendFriendRequest">
        Добавить в друзья
      </button>
    </div>
  `;

  document.querySelector("#sendFriendRequest")
    ?.addEventListener("click", async () => {
      const button = document.querySelector("#sendFriendRequest");
      button.disabled = true;

      const { error } = await supabase.rpc(
        "send_friend_request",
        { target_username: profile.username }
      );

      if (error) {
        console.error(error);
        showMessage(error.message || "Не удалось отправить заявку.", "error");
        button.disabled = false;
        return;
      }

      showMessage("Заявка в друзья отправлена!", "success");
      button.textContent = "Заявка отправлена";
    });
}

async function loadIncomingRequests() {
  const container = document.querySelector("#incomingRequests");
  if (!container) return;

  const { data, error } = await supabase.rpc(
    "get_incoming_friend_requests"
  );

  if (error) {
    console.error(error);
    container.textContent = "Не удалось загрузить заявки.";
    return;
  }

  if (!data?.length) {
    container.innerHTML = "<p>Новых заявок нет.</p>";
    return;
  }

  container.innerHTML = data.map((request, index) => `
    <div class="friend-item">
      <div class="friend-info">
        <strong>${escape(request.display_name)}</strong>
        <span>@${escape(request.username)}</span>
      </div>
      <div class="friend-actions">
        <button type="button" data-action="accept" data-index="${index}">
          Принять
        </button>
        <button type="button" data-action="reject" data-index="${index}">
          Отклонить
        </button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      const request = data[Number(button.dataset.index)];
      const accept = button.dataset.action === "accept";

      button.disabled = true;

      const { error } = await supabase.rpc(
        "respond_friend_request",
        {
          requester_user_id: request.requester_id,
          accept_request: accept
        }
      );

      if (error) {
        console.error(error);
        showMessage("Не удалось обработать заявку.", "error");
        button.disabled = false;
        return;
      }

      showMessage(
        accept ? "Теперь вы друзья!" : "Заявка отклонена.",
        "success"
      );

      await loadIncomingRequests();

      if (accept) {
        await loadFriends();
      }
    });
  });
}

async function loadFriends() {
  const container = document.querySelector("#friendsList");
  if (!container) return;

  const user = await getCurrentUser();

  if (!user) {
    container.textContent = "Войди в аккаунт.";
    return;
  }

  const { data: relations, error: relationsError } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted");

  if (relationsError) {
    console.error(relationsError);
    container.textContent = "Не удалось загрузить список друзей.";
    return;
  }

  const friendIds = (relations || []).map((relation) =>
    relation.requester_id === user.id
      ? relation.addressee_id
      : relation.requester_id
  );

  if (!friendIds.length) {
    container.innerHTML = "<p>Пока друзей нет.</p>";
    return;
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, description")
    .in("id", friendIds);

  if (error) {
    console.error(error);
    container.textContent = "Не удалось загрузить профили друзей.";
    return;
  }

  container.innerHTML = (profiles || []).map((profile) => {
    const profileUrl = `/profile.html?id=${encodeURIComponent(profile.id)}`;

    return `
      <div class="friend-item">
        <a
          class="friend-info friend-profile-link"
          href="${escape(profileUrl)}"
          aria-label="Открыть профиль ${escape(profile.display_name)}"
        >
          <img
            class="friend-avatar"
            src="${escape(profile.avatar_url || "/images/brothers-gallery/Никита.jpg")}"
            alt=""
            onerror="this.onerror=null;this.src='/images/brothers-gallery/Никита.jpg';"
          >
          <div>
            <strong>${escape(profile.display_name || "Пользователь")}</strong>
            <span>@${escape(profile.username)}</span>
          </div>
        </a>

        <button
          type="button"
          data-remove-id="${escape(profile.id)}"
        >
          Удалить
        </button>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Удалить этого пользователя из друзей?")) return;

      button.disabled = true;

      const { error } = await supabase.rpc(
        "remove_friend",
        { friend_user_id: button.dataset.removeId }
      );

      if (error) {
        console.error(error);
        showMessage("Не удалось удалить друга.", "error");
        button.disabled = false;
        return;
      }

      showMessage("Пользователь удалён из друзей.", "success");
      await loadFriends();
    });
  });
}
