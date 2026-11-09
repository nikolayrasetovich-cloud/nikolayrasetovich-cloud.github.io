
import { protectPage } from "./auth.js";

export async function startProtectedPage(initPage) {
  try {
    const hasAccess = await protectPage();

    if (!hasAccess) return;

    await initPage();
  } catch (error) {
    console.error("Ошибка проверки доступа:", error);

    document.body.innerHTML = `
      <main style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        box-sizing:border-box;
        background:#111;
        color:#d5ad62;
        font-family:Arial,sans-serif;
        text-align:center;
      ">
        <h2>Не удалось проверить доступ. Обнови страницу.</h2>
      </main>
    `;
  }
}
    