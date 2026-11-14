
import { supabase, requireSupabase } from "./supabase.js";
import { protectPage, getCurrentUser } from "./auth.js";

const elements = {
    balance: document.getElementById("coinBalance"),
    energy: document.getElementById("energyValue"),
    maxEnergy: document.getElementById("maxEnergyValue"),
    energyProgress: document.getElementById("energyProgress"),
    level: document.getElementById("playerLevel"),
    clickPower: document.getElementById("clickPower"),
    experience: document.getElementById("experienceValue"),
    experienceProgress: document.getElementById("experienceProgress"),
    coinButton: document.getElementById("coinButton"),
    message: document.getElementById("gameMessage"),
    content: document.getElementById("gameContent"),
    contentTitle: document.getElementById("gameContentTitle"),
    contentBody: document.getElementById("gameContentBody"),
    closeContent: document.getElementById("closeGameContent")
};

let currentUser = null;
let player = null;

let pendingClicks = 0;
let processingClicks = false;
let energyTimer = null;

let clickPowerUpgradeLevel = 0;
let maxEnergyUpgradeLevel = 0;
let energyRegenUpgradeLevel = 0;

let buyingUpgrade = false;

// --------------------------------------------------
// СООБЩЕНИЯ
// --------------------------------------------------

function showMessage(message, isError = false) {
    elements.message.textContent = message;
    elements.message.style.color = isError
        ? "#ff7777"
        : "#a78bfa";
}

// --------------------------------------------------
// ТЕКУЩАЯ ЭНЕРГИЯ
// --------------------------------------------------

function getCurrentEnergy() {
    if (!player) return 0;

    const energy = Number(player.energy) || 0;
    const maxEnergy = Number(player.max_energy) || 100;

    const regenSeconds = Math.max(
        0.5,
        Number(player.energy_regen_seconds) || 2
    );

    if (energy >= maxEnergy) return maxEnergy;

    if (!player.last_energy_update) return energy;

    const lastUpdate = new Date(
        player.last_energy_update
    ).getTime();

    if (!Number.isFinite(lastUpdate)) return energy;

    const elapsed = Math.max(0, Date.now() - lastUpdate);

    const regenerated = Math.floor(
        elapsed / (regenSeconds * 1000)
    );

    return Math.min(maxEnergy, energy + regenerated);
}

// --------------------------------------------------
// ОТОБРАЖЕНИЕ ПРОФИЛЯ
// --------------------------------------------------

function renderPlayer() {
    if (!player) return;

    const coins = Number(player.coins) || 0;
    const energy = getCurrentEnergy();

    const maxEnergy = Number(player.max_energy) || 100;
    const level = Number(player.level) || 1;
    const power = Number(player.click_power) || 1;
    const experience = Number(player.experience) || 0;

    elements.balance.textContent =
        coins.toLocaleString("ru-RU");

    elements.energy.textContent = Math.floor(energy);
    elements.maxEnergy.textContent = maxEnergy;
    elements.level.textContent = level;

    elements.clickPower.textContent = `+${power} за клик`;

    elements.experience.textContent =
        `${experience.toLocaleString("ru-RU")} XP`;

    const energyPercent = maxEnergy > 0
        ? Math.min(100, (energy / maxEnergy) * 100)
        : 0;

    elements.energyProgress.style.width = `${energyPercent}%`;

    const experiencePercent = experience % 100;

    elements.experienceProgress.style.width =
        `${experiencePercent}%`;

    elements.coinButton.disabled =
        energy < 1 && pendingClicks === 0;
}

// --------------------------------------------------
// ЗАГРУЗКА ПРОФИЛЯ
// --------------------------------------------------

async function loadPlayer() {
    const { data, error } = await supabase
        .from("game_profiles")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();

    if (error) throw error;

    if (!data) {
        throw new Error("Игровой профиль не найден.");
    }

    player = data;
    renderPlayer();
}

// --------------------------------------------------
// ЗАГРУЗКА УЛУЧШЕНИЙ
// --------------------------------------------------

async function loadClickPowerUpgrade() {
    const { data, error } = await supabase
        .from("game_player_upgrades")
        .select("upgrade_level")
        .eq("user_id", currentUser.id)
        .eq("upgrade_code", "click_power")
        .maybeSingle();

    if (error) throw error;

    clickPowerUpgradeLevel =
        Number(data?.upgrade_level) || 0;
}

async function loadMaxEnergyUpgrade() {
    const { data, error } = await supabase
        .from("game_player_upgrades")
        .select("upgrade_level")
        .eq("user_id", currentUser.id)
        .eq("upgrade_code", "max_energy")
        .maybeSingle();

    if (error) throw error;

    maxEnergyUpgradeLevel =
        Number(data?.upgrade_level) || 0;
}

async function loadEnergyRegenUpgrade() {
    const { data, error } = await supabase
        .from("game_player_upgrades")
        .select("upgrade_level")
        .eq("user_id", currentUser.id)
        .eq("upgrade_code", "energy_regen")
        .maybeSingle();

    if (error) throw error;

    energyRegenUpgradeLevel =
        Number(data?.upgrade_level) || 0;
}

// --------------------------------------------------
// АНИМАЦИЯ МОНЕТЫ
// --------------------------------------------------

function animateCoin() {
    elements.coinButton.classList.remove("coin-clicked");
    void elements.coinButton.offsetWidth;
    elements.coinButton.classList.add("coin-clicked");
}

// --------------------------------------------------
// ОБРАБОТКА КЛИКОВ
// --------------------------------------------------

async function handleCoinClick() {
    if (!player) return;

    const energy = getCurrentEnergy();

    if (energy < 1 && pendingClicks === 0) {
        showMessage("Недостаточно энергии. Подожди восстановления.");
        renderPlayer();
        return;
    }

    animateCoin();
    pendingClicks++;

    showMessage(`Нажатий в очереди: ${pendingClicks}`);

    if (processingClicks) return;

    processingClicks = true;

    let successfulClicks = 0;

    try {
        while (pendingClicks > 0) {
            pendingClicks--;

            const { data, error } = await supabase.rpc("game_click");

            if (error) throw error;

            if (data && data.success === false) {
                pendingClicks = 0;
                break;
            }

            successfulClicks++;
        }

        await loadPlayer();

        if (successfulClicks > 0) {
            showMessage(`Успешных кликов: ${successfulClicks}!`);
        }

        if (getCurrentEnergy() < 1) {
            showMessage("Энергия закончилась. Жди восстановления.");
        }

    } catch (error) {
        console.error("Ошибка клика:", error);
        pendingClicks = 0;
        showMessage("Не удалось обработать клики. Попробуй ещё раз.", true);

    } finally {
        processingClicks = false;
        renderPlayer();
    }
}

// --------------------------------------------------
// ОБНОВЛЕНИЕ ЭНЕРГИИ
// --------------------------------------------------

function startEnergyTimer() {
    if (energyTimer) clearInterval(energyTimer);

    energyTimer = setInterval(() => {
        if (player) renderPlayer();
    }, 250);
}

// --------------------------------------------------
// ОТОБРАЖЕНИЕ УЛУЧШЕНИЙ
// --------------------------------------------------

function renderUpgrades() {
    if (!player) return;

    const coins = Number(player.coins) || 0;
    const power = Number(player.click_power) || 1;
    const maxEnergy = Number(player.max_energy) || 100;

    const regenSeconds = Math.max(
        0.5,
        Number(player.energy_regen_seconds) || 2
    );

    const clickCost = 250 * (clickPowerUpgradeLevel + 1);
    const energyCost = 500 * (maxEnergyUpgradeLevel + 1);
    const regenCost = 750 * (energyRegenUpgradeLevel + 1);

    elements.contentBody.innerHTML = `
        <div class="upgrades-grid">

            <div class="upgrade-card">
                <div class="upgrade-icon">🪙</div>
                <h3>Сила клика</h3>
                <p>Получай больше монет за каждое нажатие.</p>

                <div class="upgrade-info">
                    <div><span>Уровень</span><strong>${clickPowerUpgradeLevel}</strong></div>
                    <div><span>Сейчас</span><strong>+${power}</strong></div>
                    <div><span>После покупки</span><strong>+${power + 1}</strong></div>
                </div>

                <div class="upgrade-price">
                    Цена: <strong>${clickCost.toLocaleString("ru-RU")} 🪙</strong>
                </div>

                <button type="button" id="buyClickPowerButton"
                    class="game-upgrade-button"
                    ${coins < clickCost || buyingUpgrade ? "disabled" : ""}>
                    ${buyingUpgrade ? "Покупка..." : "Улучшить"}
                </button>

                <p class="upgrade-hint">
                    ${coins < clickCost ? "Недостаточно монет." : "Улучшение навсегда."}
                </p>
            </div>

            <div class="upgrade-card">
                <div class="upgrade-icon">⚡</div>
                <h3>Максимальная энергия</h3>
                <p>Увеличивай запас энергии для большего количества кликов.</p>

                <div class="upgrade-info">
                    <div><span>Уровень</span><strong>${maxEnergyUpgradeLevel}</strong></div>
                    <div><span>Сейчас</span><strong>${maxEnergy}</strong></div>
                    <div><span>После покупки</span><strong>${maxEnergy + 25}</strong></div>
                </div>

                <div class="upgrade-price">
                    Цена: <strong>${energyCost.toLocaleString("ru-RU")} 🪙</strong>
                </div>

                <button type="button" id="buyMaxEnergyButton"
                    class="game-upgrade-button"
                    ${coins < energyCost || buyingUpgrade ? "disabled" : ""}>
                    ${buyingUpgrade ? "Покупка..." : "Улучшить"}
                </button>

                <p class="upgrade-hint">
                    ${coins < energyCost ? "Недостаточно монет." : "Максимум энергии +25."}
                </p>
            </div>

            <div class="upgrade-card">
                <div class="upgrade-icon">⏱️</div>
                <h3>Скорость восстановления</h3>
                <p>Восстанавливай энергию быстрее и кликай чаще.</p>

                <div class="upgrade-info">
                    <div><span>Уровень</span><strong>${energyRegenUpgradeLevel}</strong></div>
                    <div><span>Сейчас</span><strong>${regenSeconds.toFixed(1)} сек.</strong></div>
                    <div><span>После покупки</span><strong>${Math.max(0.5, regenSeconds - 0.2).toFixed(1)} сек.</strong></div>
                </div>

                <div class="upgrade-price">
                    Цена: <strong>${regenCost.toLocaleString("ru-RU")} 🪙</strong>
                </div>

                <button type="button" id="buyEnergyRegenButton"
                    class="game-upgrade-button"
                    ${coins < regenCost || buyingUpgrade || regenSeconds <= 0.5 ? "disabled" : ""}>
                    ${regenSeconds <= 0.5 ? "Максимальный уровень" : buyingUpgrade ? "Покупка..." : "Улучшить"}
                </button>

                <p class="upgrade-hint">
                    ${regenSeconds <= 0.5 ? "Скорость уже максимальная." : coins < regenCost ? "Недостаточно монет." : "Ускорение восстановления энергии."}
                </p>
            </div>

        </div>
    `;

    document.getElementById("buyClickPowerButton")
        .addEventListener("click", buyClickPower);

    document.getElementById("buyMaxEnergyButton")
        .addEventListener("click", buyMaxEnergy);

    document.getElementById("buyEnergyRegenButton")
        .addEventListener("click", buyEnergyRegen);
}

// --------------------------------------------------
// ПОКУПКА УЛУЧШЕНИЙ
// --------------------------------------------------

async function buyClickPower() {
    if (buyingUpgrade || !player) return;

    buyingUpgrade = true;
    renderUpgrades();

    try {
        const { data, error } = await supabase.rpc("buy_click_power");
        if (error) throw error;

        if (!data || data.success !== true) {
            showMessage(data?.message || "Недостаточно монет.", true);
            return;
        }

        await loadPlayer();
        await loadClickPowerUpgrade();

        showMessage(`Сила клика улучшена! Теперь +${data.click_power} монет за клик.`);

    } catch (error) {
        console.error("Ошибка покупки силы клика:", error);
        showMessage("Не удалось купить улучшение силы клика.", true);

    } finally {
        buyingUpgrade = false;
        renderUpgrades();
    }
}

async function buyMaxEnergy() {
    if (buyingUpgrade || !player) return;

    buyingUpgrade = true;
    renderUpgrades();

    try {
        const { data, error } = await supabase.rpc("buy_max_energy");
        if (error) throw error;

        if (!data || data.success !== true) {
            showMessage(data?.message || "Недостаточно монет.", true);
            return;
        }

        await loadPlayer();
        await loadMaxEnergyUpgrade();

        showMessage(`Максимальная энергия увеличена до ${data.max_energy}!`);

    } catch (error) {
        console.error("Ошибка покупки энергии:", error);
        showMessage("Не удалось купить улучшение энергии.", true);

    } finally {
        buyingUpgrade = false;
        renderUpgrades();
    }
}

async function buyEnergyRegen() {
    if (buyingUpgrade || !player) return;

    buyingUpgrade = true;
    renderUpgrades();

    try {
        const { data, error } = await supabase.rpc("buy_energy_regen");
        if (error) throw error;

        if (!data || data.success !== true) {
            showMessage(data?.message || "Не удалось купить улучшение.", true);
            return;
        }

        await loadPlayer();
        await loadEnergyRegenUpgrade();

        showMessage(
            `Энергия теперь восстанавливается за ${Number(data.energy_regen_seconds).toFixed(1)} секунды!`
        );

    } catch (error) {
        console.error("Ошибка покупки скорости восстановления:", error);
        showMessage("Не удалось купить улучшение восстановления.", true);

    } finally {
        buyingUpgrade = false;
        renderUpgrades();
    }
}

// --------------------------------------------------
// ДОСТИЖЕНИЯ
// --------------------------------------------------

async function renderAchievements() {
    elements.contentBody.innerHTML = `
        <div class="leaderboard-loading">
            <p>Загружаем достижения...</p>
        </div>
    `;

    const { data: achievements, error: achievementsError } =
        await supabase
            .from("game_achievements")
            .select("*")
            .eq("is_active", true)
            .order("requirement_value", { ascending: true });

    if (achievementsError) throw achievementsError;

    const { data: completed, error: completedError } =
        await supabase
            .from("game_player_achievements")
            .select("achievement_id")
            .eq("user_id", currentUser.id);

    if (completedError) throw completedError;

    const completedIds = new Set(
        (completed || []).map(item => item.achievement_id)
    );

    const total = achievements.length;
    const completedCount = completedIds.size;

    const cards = achievements.map(item => {
        const isCompleted = completedIds.has(item.id);

        return `
            <article class="upgrade-card">
                <div class="upgrade-icon">
                    ${escapeHTML(item.icon || "🏆")}
                </div>

                <h3>
                    ${escapeHTML(item.title)}
                    ${isCompleted ? "✅" : ""}
                </h3>

                <p>${escapeHTML(item.description)}</p>

                <div class="upgrade-info">
                    <div>
                        <span>Награда</span>
                        <strong>
                            ${formatNumber(item.reward_coins)} 🪙
                        </strong>
                    </div>

                    <div>
                        <span>Опыт</span>
                        <strong>
                            ${formatNumber(item.reward_experience)} XP
                        </strong>
                    </div>
                </div>

                <p class="upgrade-hint">
                    ${isCompleted ? "Достижение выполнено!" : "Пока не выполнено"}
                </p>
            </article>
        `;
    }).join("");

    elements.contentBody.innerHTML = `
        <section class="upgrades-grid">

            <div class="upgrade-card">
                <div class="upgrade-icon">🏆</div>
                <h3>Мои достижения</h3>
                <p>
                    Выполнено:
                    <strong>${completedCount} / ${total}</strong>
                </p>
                <div class="experience-progress">
                    <div style="
                        width: ${total ? completedCount / total * 100 : 0}%;
                    "></div>
                </div>
            </div>

            ${cards}

        </section>
    `;
}

// --------------------------------------------------
// ЗАДАНИЯ
// --------------------------------------------------

async function renderTasks(activeTab = "daily") {
    elements.contentBody.innerHTML = `
        <div class="leaderboard-loading">
            <p>Загружаем задания...</p>
        </div>
    `;

    const tabs = [
        { id: "daily", title: "Ежедневные" },
        { id: "weekly", title: "Еженедельные" },
        { id: "permanent", title: "Постоянные" }
    ];

    // Загружаем каталог заданий.
    // Прогресс обновляется только через game_click() на сервере.

    const { data: tasks, error: tasksError } = await supabase
        .from("game_tasks")
        .select("*")
        .eq("is_active", true)
        .eq("task_type", activeTab)
        .order("id", { ascending: true });

    if (tasksError) throw tasksError;

    // Загружаем прогресс игрока.

    const { data: progress, error: progressError } = await supabase
        .from("game_player_tasks")
        .select("*")
        .eq("user_id", currentUser.id);

    if (progressError) throw progressError;

    const now = new Date();

    const dailyKey = [
        now.getUTCFullYear(),
        String(now.getUTCMonth() + 1).padStart(2, "0"),
        String(now.getUTCDate()).padStart(2, "0")
    ].join("-");

    // Получаем номер недели в формате ISO: YYYY-WW.

    const weeklyKey = (() => {
        const date = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        ));

        const day = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - day);

        const yearStart = new Date(Date.UTC(
            date.getUTCFullYear(), 0, 1
        ));

        const week = Math.ceil(
            (((date - yearStart) / 86400000) + 1) / 7
        );

        return `${date.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
    })();

    const periodKey = activeTab === "daily"
        ? dailyKey
        : activeTab === "weekly"
            ? weeklyKey
            : "permanent";

    const progressMap = new Map(
        (progress || [])
            .filter(item => item.period_key === periodKey)
            .map(item => [item.task_id, item])
    );

    const completedCount = tasks.filter(task => {
        const item = progressMap.get(task.id);
        return item?.claimed_at;
    }).length;

    const cards = tasks.map(task => {
        const item = progressMap.get(task.id);

        const current = Number(item?.progress) || 0;
        const target = Number(task.target_value) || 1;

        const percent = Math.min(
            100,
            current / target * 100
        );

        const completed = Boolean(item?.completed_at);
        const claimed = Boolean(item?.claimed_at);

        let buttonHTML = "";

        if (claimed) {
            buttonHTML = `
                <button class="game-upgrade-button" disabled>
                    Награда получена ✅
                </button>
            `;
        } else if (completed) {
            buttonHTML = `
                <button
                    type="button"
                    class="game-upgrade-button claim-task-button"
                    data-task-id="${task.id}">
                    Забрать награду
                </button>
            `;
        } else {
            buttonHTML = `
                <button class="game-upgrade-button" disabled>
                    Выполняется...
                </button>
            `;
        }

        return `
            <article class="upgrade-card">
                <div class="upgrade-icon">🎯</div>

                <h3>${escapeHTML(task.title)}</h3>

                <p>${escapeHTML(task.description || "")}</p>

                <div class="upgrade-info">
                    <div>
                        <span>Прогресс</span>
                        <strong>
                            ${formatNumber(current)} /
                            ${formatNumber(target)}
                        </strong>
                    </div>

                    <div>
                        <span>Монеты</span>
                        <strong>
                            ${formatNumber(task.reward_coins)} 🪙
                        </strong>
                    </div>

                    <div>
                        <span>Опыт</span>
                        <strong>
                            ${formatNumber(task.reward_experience)} XP
                        </strong>
                    </div>
                </div>

                <div class="experience-progress">
                    <div style="width: ${percent}%"></div>
                </div>

                ${buttonHTML}
            </article>
        `;
    }).join("");

    elements.contentBody.innerHTML = `
        <section>
            <div class="upgrades-grid">
                <div class="upgrade-card">
                    <div class="upgrade-icon">🎯</div>
                    <h3>Мои задания</h3>
                    <p>
                        Получено наград:
                        <strong>${completedCount} / ${tasks.length}</strong>
                    </p>
                </div>
            </div>

            <div class="task-tabs">
                ${tabs.map(tab => `
                    <button
                        type="button"
                        class="game-upgrade-button"
                        data-task-tab="${tab.id}"
                        ${activeTab === tab.id ? "disabled" : ""}>
                        ${tab.title}
                    </button>
                `).join("")}
            </div>

            <section class="upgrades-grid">
                ${cards || `
                    <div class="upgrade-card">
                        <p>Пока нет заданий в этой категории.</p>
                    </div>
                `}
            </section>
        </section>
    `;

    // Переключение категорий заданий.

    elements.contentBody
        .querySelectorAll("[data-task-tab]")
        .forEach(button => {
            button.addEventListener("click", () => {
                renderTasks(button.dataset.taskTab)
                    .catch(error => {
                        console.error(error);
                        showMessage("Не удалось загрузить задания.", true);
                    });
            });
        });

    // Получение награды.

    elements.contentBody
        .querySelectorAll(".claim-task-button")
        .forEach(button => {
            button.addEventListener("click", async () => {
                button.disabled = true;
                button.textContent = "Получаем награду...";

                try {
                    const { data, error } = await supabase.rpc(
                        "claim_game_task",
                        { p_task_id: Number(button.dataset.taskId) }
                    );

                    if (error) throw error;

                    if (!data?.success) {
                        throw new Error(
                            data?.message || "Не удалось получить награду."
                        );
                    }

                    await loadPlayer();

                    showMessage(
                        `Получено: ${formatNumber(data.reward_coins)} монет и ${formatNumber(data.reward_experience)} XP!`
                    );

                    await renderTasks(activeTab);

                } catch (error) {
                    console.error("Ошибка получения награды:", error);

                    showMessage(
                        error.message || "Не удалось получить награду.",
                        true
                    );

                    await renderTasks(activeTab);
                }
            });
        });
}

// --------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ РЕЙТИНГА
// --------------------------------------------------

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatNumber(value) {
    return (Number(value) || 0).toLocaleString("ru-RU");
}

// --------------------------------------------------
// АВАТАРКА ИГРОКА
// --------------------------------------------------

function renderLeaderboardAvatar(item, className = "") {
    const name = item.player_name || item.username || "Игрок";
    const initial = escapeHTML(
        name.trim().charAt(0).toUpperCase() || "?"
    );

    const avatarUrl = item.avatar_url;

    if (!avatarUrl) {
        return `
            <div class="leaderboard-avatar ${className}">
                <span>${initial}</span>
            </div>
        `;
    }

    return `
        <div class="leaderboard-avatar ${className}">
            <img
                src="${escapeHTML(avatarUrl)}"
                alt="Аватар ${initial}"
                loading="lazy"
                onerror="
                    this.style.display='none';
                    this.nextElementSibling.style.display='flex';
                "
            >
            <span style="display:none">${initial}</span>
        </div>
    `;
}

// --------------------------------------------------
// РЕЙТИНГ И ПЬЕДЕСТАЛ
// --------------------------------------------------

async function renderLeaderboard() {
    elements.contentBody.innerHTML = `
        <div class="leaderboard-loading">
            <p>Загружаем рейтинг игроков...</p>
        </div>
    `;

    const { data, error } = await supabase.rpc(
        "get_game_leaderboard"
    );

    if (error) {
        console.error("Ошибка загрузки рейтинга:", error);
        throw error;
    }

    if (!data || data.length === 0) {
        elements.contentBody.innerHTML = `
            <div class="leaderboard-empty">
                <h3>Рейтинг пока пуст</h3>
                <p>Сделай первые клики и стань первым игроком!</p>
            </div>
        `;
        return;
    }

    const players = [...data].sort((a, b) =>
        Number(b.experience || 0) - Number(a.experience || 0) ||
        Number(b.level || 0) - Number(a.level || 0) ||
        Number(b.coins || 0) - Number(a.coins || 0)
    );

    const topPlayers = players.slice(0, 3);
    const otherPlayers = players.slice(3);

    const podiumCards = topPlayers.map((item, index) => {
        const rank = index + 1;

        const name = escapeHTML(
            item.player_name || item.username || "Игрок"
        );

        return `
            <article class="podium-card podium-place-${rank}">

                <span class="podium-rank">
                    ${rank} место
                </span>

                ${renderLeaderboardAvatar(item, "podium-avatar")}

                <h3 class="podium-name">${name}</h3>

                <span class="podium-level">
                    Уровень ${formatNumber(item.level)}
                </span>

                <div class="podium-stats">
                    <div>
                        <strong>${formatNumber(item.experience)}</strong>
                        <small>ОПЫТ XP</small>
                    </div>

                    <div>
                        <strong>${formatNumber(item.achievements_count)}</strong>
                        <small>ДОСТИЖЕНИЙ</small>
                    </div>
                </div>

            </article>
        `;
    }).join("");

    const otherRows = otherPlayers.map((item, index) => {
        const rank = index + 4;

        const name = escapeHTML(
            item.player_name || item.username || "Игрок"
        );

        return `
            <article class="leaderboard-row">

                <div class="leaderboard-rank">
                    #${rank}
                </div>

                ${renderLeaderboardAvatar(item)}

                <div class="leaderboard-player">
                    <strong>${name}</strong>
                    <small>
                        Уровень ${formatNumber(item.level)}
                    </small>
                </div>

                <div class="leaderboard-stats">
                    <strong>
                        ${formatNumber(item.experience)} XP
                    </strong>
                    <small>
                        🏆 ${formatNumber(item.achievements_count)} достижений
                    </small>
                </div>

            </article>
        `;
    }).join("");

    elements.contentBody.innerHTML = `
        <section class="leaderboard-section">

            <div class="leaderboard-heading">
                <span class="leaderboard-eyebrow">
                    TTFBB COMPANY
                </span>

                <h2>Лига лидеров</h2>

                <p>
                    Стань лучшим игроком и займи первое место!
                </p>
            </div>

            <div class="leaderboard-podium">
                ${podiumCards}
            </div>

            ${
                otherPlayers.length
                    ? `
                        <div class="leaderboard-rest">
                            <h3>Остальные игроки</h3>

                            <div class="leaderboard-list">
                                ${otherRows}
                            </div>
                        </div>
                    `
                    : ""
            }

        </section>
    `;
}

// --------------------------------------------------
// РАЗДЕЛЫ ИГРЫ
// --------------------------------------------------

async function openGameSection(section) {
    const sections = {
        upgrades: {
            title: "Улучшения"
        },
        skills: {
            title: "Навыки",
            description: "Здесь появится система навыков и развития игрока."
        },
        tasks: {
            title: "Задания",
            description: "Выполняй ежедневные, еженедельные и постоянные задания, чтобы получать награды."
        },
        shop: {
            title: "Магазин",
            description: "Здесь появится магазин игровых предметов."
        },
        achievements: {
            title: "Достижения",
            description: "Здесь появятся достижения и награды."
        },
        rating: {
            title: "Рейтинг игроков"
        }
    };

    const selected = sections[section];
    if (!selected) return;

    elements.contentTitle.textContent = selected.title;
    elements.contentBody.textContent = "Загрузка...";
    elements.content.hidden = false;

    elements.content.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

    if (section === "upgrades") {
        try {
            await loadPlayer();
            await loadClickPowerUpgrade();
            await loadMaxEnergyUpgrade();
            await loadEnergyRegenUpgrade();
            renderUpgrades();

        } catch (error) {
            console.error("Ошибка загрузки улучшений:", error);
            elements.contentBody.textContent = "Не удалось загрузить улучшения.";
        }

        return;
    }

    if (section === "rating") {
        try {
            await renderLeaderboard();
        } catch (error) {
            console.error("Ошибка отображения рейтинга:", error);
            elements.contentBody.textContent = "Не удалось загрузить рейтинг игроков.";
        }

        return;
    }

    if (section === "achievements") {
        try {
            await renderAchievements();
        } catch (error) {
            console.error("Ошибка загрузки достижений:", error);
            elements.contentBody.textContent =
                "Не удалось загрузить достижения.";
        }

        return;
    }

    // Открытие заданий.

    if (section === "tasks") {
        try {
            await renderTasks();
        } catch (error) {
            console.error("Ошибка загрузки заданий:", error);
            elements.contentBody.textContent =
                "Не удалось загрузить задания.";
        }

        return;
    }

    elements.contentBody.textContent = selected.description || "";
}

// --------------------------------------------------
// ЗАПУСК ИГРЫ
// --------------------------------------------------

async function initGame() {
    try {
        showMessage("Проверяем аккаунт...");

        const allowed = await protectPage();

        if (!allowed) {
            elements.coinButton.disabled = true;
            return;
        }

        requireSupabase();

        currentUser = await getCurrentUser();

        if (!currentUser) {
            throw new Error("Пользователь не авторизован.");
        }

        showMessage("Загружаем игровой профиль...");

        await loadPlayer();
        await loadClickPowerUpgrade();
        await loadMaxEnergyUpgrade();
        await loadEnergyRegenUpgrade();

        startEnergyTimer();

        showMessage("Игра готова! Нажимай на монету.");

    } catch (error) {
        console.error("Ошибка запуска игры:", error);

        elements.coinButton.disabled = true;

        showMessage(
            error.message || "Не удалось загрузить игру.",
            true
        );
    }
}

// --------------------------------------------------
// СОБЫТИЯ
// --------------------------------------------------

elements.coinButton.addEventListener("click", handleCoinClick);

document.querySelectorAll(".game-menu-card").forEach((button) => {
    button.addEventListener("click", () => {
        openGameSection(button.dataset.section);
    });
});

elements.closeContent.addEventListener("click", () => {
    elements.content.hidden = true;
});

// --------------------------------------------------
// СТАРТ
// --------------------------------------------------

initGame();
