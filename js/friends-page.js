
import { initFriendsUI } from "./friends.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initFriendsUI();
  } catch (error) {
    console.error("Ошибка загрузки системы друзей:", error);

    const section = document.querySelector("#friendsSection");
    if (section) {
      section.innerHTML = `
        <p>Не удалось загрузить систему друзей. Проверь консоль браузера.</p>
      `;
    }
  }
});
