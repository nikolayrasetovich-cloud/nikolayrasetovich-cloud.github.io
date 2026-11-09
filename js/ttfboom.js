
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

    const elapsed = Math.max(
        0,
        Date.now() - lastUpdate
    );

    const regenerated = Math.floor(
        elapsed / (regenSeconds * 1000)
    );

    return Math.min(
        maxEnergy,
        energy + regenerated
    );
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

    elements.clickPower.textContent =
        `+${power} за клик`;

    elements.experience.textContent =
        `${experience.toLocaleString("ru-RU")} XP`;

    const energyPercent = maxEnergy > 0
        ? Math.min(100, (energy / maxEnergy) * 100)
        : 0;

    elements.energyProgress.style.width =
        `${energyPercent}%`;

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
// ЗАГРУЗКА УЛУЧШЕНИЯ СИЛЫ КЛИКА
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

// --------------------------------------------------
// ЗАГРУЗКА УЛУЧШЕНИЯ МАКСИМАЛЬНОЙ ЭНЕРГИИ
// --------------------------------------------------

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

// --------------------------------------------------
// ЗАГРУЗКА СКОРОСТИ ВОССТАНОВЛЕНИЯ
// --------------------------------------------------

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
        showMessage(
            "Недостаточно энергии. Подожди восстановления."
        );

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

            const { data, error } = await supabase.rpc(
                "game_click"
            );

            if (error) throw error;

            if (data && data.success === false) {
                pendingClicks = 0;
                break;
            }

            successfulClicks++;
        }

        await loadPlayer();

        if (successfulClicks > 0) {
            showMessage(
                `Успешных кликов: ${successfulClicks}!`
            );
        }

        if (getCurrentEnergy() < 1) {
            showMessage(
                "Энергия закончилась. Жди восстановления."
            );
        }

    } catch (error) {
        console.error("Ошибка клика:", error);

        pendingClicks = 0;

        showMessage(
            "Не удалось обработать клики. Попробуй ещё раз.",
            true
        );

    } finally {
        processingClicks = false;
        renderPlayer();
    }
}

// --------------------------------------------------
// ОБНОВЛЕНИЕ ЭНЕРГИИ
// --------------------------------------------------

function startEnergyTimer() {
    if (energyTimer) {
        clearInterval(energyTimer);
    }

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

    const clickCost =
        250 * (clickPowerUpgradeLevel + 1);

    const energyCost =
        500 * (maxEnergyUpgradeLevel + 1);

    const regenCost =
        750 * (energyRegenUpgradeLevel + 1);

    const clickButtonDisabled =
        coins < clickCost || buyingUpgrade;

    const energyButtonDisabled =
        coins < energyCost || buyingUpgrade;

    const regenButtonDisabled =
        coins < regenCost ||
        buyingUpgrade ||
        regenSeconds <= 0.5;

    elements.contentBody.innerHTML = `
        <div class="upgrades-grid">

            <div class="upgrade-card">
                <div class="upgrade-icon">🪙</div>

                <h3>Сила клика</h3>

                <p>
                    Получай больше монет за каждое нажатие.
                </p>

                <div class="upgrade-info">
                    <div>
                        <span>Уровень</span>
                        <strong>${clickPowerUpgradeLevel}</strong>
                    </div>

                    <div>
                        <span>Сейчас</span>
                        <strong>+${power}</strong>
                    </div>

                    <div>
                        <span>После покупки</span>
                        <strong>+${power + 1}</strong>
                    </div>
                </div>

                <div class="upgrade-price">
                    Цена:
                    <strong>
                        ${clickCost.toLocaleString("ru-RU")} 🪙
                    </strong>
                </div>

                <button
                    type="button"
                    id="buyClickPowerButton"
                    class="game-upgrade-button"
                    ${clickButtonDisabled ? "disabled" : ""}
                >
                    ${buyingUpgrade ? "Покупка..." : "Улучшить"}
                </button>

                <p class="upgrade-hint">
                    ${
                        coins < clickCost
                            ? "Недостаточно монет."
                            : "Улучшение навсегда."
                    }
                </p>
            </div>

            <div class="upgrade-card">
                <div class="upgrade-icon">⚡</div>

                <h3>Максимальная энергия</h3>

                <p>
                    Увеличивай запас энергии для большего
                    количества кликов.
                </p>

                <div class="upgrade-info">
                    <div>
                        <span>Уровень</span>
                        <strong>${maxEnergyUpgradeLevel}</strong>
                    </div>

                    <div>
                        <span>Сейчас</span>
                        <strong>${maxEnergy}</strong>
                    </div>

                    <div>
                        <span>После покупки</span>
                        <strong>${maxEnergy + 25}</strong>
                    </div>
                </div>

                <div class="upgrade-price">
                    Цена:
                    <strong>
                        ${energyCost.toLocaleString("ru-RU")} 🪙
                    </strong>
                </div>

                <button
                    type="button"
                    id="buyMaxEnergyButton"
                    class="game-upgrade-button"
                    ${energyButtonDisabled ? "disabled" : ""}
                >
                    ${buyingUpgrade ? "Покупка..." : "Улучшить"}
                </button>

                <p class="upgrade-hint">
                    ${
                        coins < energyCost
                            ? "Недостаточно монет."
                            : "Максимум энергии +25."
                    }
                </p>
            </div>

            <div class="upgrade-card">
                <div class="upgrade-icon">⏱️</div>

                <h3>Скорость восстановления</h3>

                <p>
                    Восстанавливай энергию быстрее и
                    кликай чаще.
                </p>

                <div class="upgrade-info">
                    <div>
                        <span>Уровень</span>
                        <strong>${energyRegenUpgradeLevel}</strong>
                    </div>

                    <div>
                        <span>Сейчас</span>
                        <strong>${regenSeconds.toFixed(1)} сек.</strong>
                    </div>

                    <div>
                        <span>После покупки</span>
                        <strong>
                            ${Math.max(0.5, regenSeconds - 0.2).toFixed(1)} сек.
                        </strong>
                    </div>
                </div>

                <div class="upgrade-price">
                    Цена:
                    <strong>
                        ${regenCost.toLocaleString("ru-RU")} 🪙
                    </strong>
                </div>

                <button
                    type="button"
                    id="buyEnergyRegenButton"
                    class="game-upgrade-button"
                    ${regenButtonDisabled ? "disabled" : ""}
                >
                    ${
                        regenSeconds <= 0.5
                            ? "Максимальный уровень"
                            : buyingUpgrade
                                ? "Покупка..."
                                : "Улучшить"
                    }
                </button>

                <p class="upgrade-hint">
                    ${
                        regenSeconds <= 0.5
                            ? "Скорость уже максимальная."
                            : coins < regenCost
                                ? "Недостаточно монет."
                                : "Ускорение восстановления энергии."
                    }
                </p>
            </div>

        </div>
    `;

    document
        .getElementById("buyClickPowerButton")
        .addEventListener("click", buyClickPower);

    document
        .getElementById("buyMaxEnergyButton")
        .addEventListener("click", buyMaxEnergy);

    document
        .getElementById("buyEnergyRegenButton")
        .addEventListener("click", buyEnergyRegen);
}

// --------------------------------------------------
// ПОКУПКА СИЛЫ КЛИКА
// --------------------------------------------------

async function buyClickPower() {
    if (buyingUpgrade || !player) return;

    buyingUpgrade = true;
    renderUpgrades();

    try {
        const { data, error } = await supabase.rpc(
            "buy_click_power"
        );

        if (error) throw error;

        if (!data || data.success !== true) {
            showMessage(
                data?.message || "Недостаточно монет.",
                true
            );
            return;
        }

        await loadPlayer();
        await loadClickPowerUpgrade();

        renderUpgrades();

        showMessage(
            `Сила клика улучшена! Теперь +${data.click_power} монет за клик.`
        );

    } catch (error) {
        console.error("Ошибка покупки силы клика:", error);

        showMessage(
            "Не удалось купить улучшение силы клика.",
            true
        );

    } finally {
        buyingUpgrade = false;
        renderUpgrades();
    }
}

// --------------------------------------------------
// ПОКУПКА МАКСИМАЛЬНОЙ ЭНЕРГИИ
// --------------------------------------------------

async function buyMaxEnergy() {
    if (buyingUpgrade || !player) return;

    buyingUpgrade = true;
    renderUpgrades();

    try {
        const { data, error } = await supabase.rpc(
            "buy_max_energy"
        );

        if (error) throw error;

        if (!data || data.success !== true) {
            showMessage(
                data?.message || "Недостаточно монет.",
                true
            );
            return;
        }

        await loadPlayer();
        await loadMaxEnergyUpgrade();

        renderUpgrades();

        showMessage(
            `Максимальная энергия увеличена до ${data.max_energy}!`
        );

    } catch (error) {
        console.error("Ошибка покупки энергии:", error);

        showMessage(
            "Не удалось купить улучшение энергии.",
            true
        );

    } finally {
        buyingUpgrade = false;
        renderUpgrades();
    }
}

// --------------------------------------------------
// ПОКУПКА СКОРОСТИ ВОССТАНОВЛЕНИЯ
// --------------------------------------------------

async function buyEnergyRegen() {
    if (buyingUpgrade || !player) return;

    buyingUpgrade = true;
    renderUpgrades();

    try {
        const { data, error } = await supabase.rpc(
            "buy_energy_regen"
        );

        if (error) throw error;

        if (!data || data.success !== true) {
            showMessage(
                data?.message ||
                    "Не удалось купить улучшение.",
                true
            );
            return;
        }

        await loadPlayer();
        await loadEnergyRegenUpgrade();

        renderUpgrades();

        showMessage(
            `Энергия теперь восстанавливается за ${Number(
                data.energy_regen_seconds
            ).toFixed(1)} секунды!`
        );

    } catch (error) {
        console.error(
            "Ошибка покупки скорости восстановления:",
            error
        );

        showMessage(
            "Не удалось купить улучшение восстановления.",
            true
        );

    } finally {
        buyingUpgrade = false;
        renderUpgrades();
    }
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
            description:
                "Здесь появится система навыков и развития игрока."
        },

        tasks: {
            title: "Задания",
            description:
                "Здесь появятся ежедневные, еженедельные и ежемесячные задания."
        },

        shop: {
            title: "Магазин",
            description:
                "Здесь появится магазин игровых предметов."
        },

        achievements: {
            title: "Достижения",
            description:
                "Здесь появятся достижения и награды."
        },

        rating: {
            title: "Рейтинг игроков",
            description:
                "Здесь появится таблица лидеров TTFBB CLICKER."
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
            console.error(
                "Ошибка загрузки улучшений:",
                error
            );

            elements.contentBody.textContent =
                "Не удалось загрузить улучшения.";
        }

        return;
    }

    elements.contentBody.textContent =
        selected.description || "";
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
            throw new Error(
                "Пользователь не авторизован."
            );
        }

        showMessage("Загружаем игровой профиль...");

        await loadPlayer();
        await loadClickPowerUpgrade();
        await loadMaxEnergyUpgrade();
        await loadEnergyRegenUpgrade();

        startEnergyTimer();

        showMessage(
            "Игра готова! Нажимай на монету."
        );

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

elements.coinButton.addEventListener(
    "click",
    handleCoinClick
);

document.querySelectorAll(".game-menu-card").forEach(
    (button) => {
        button.addEventListener("click", () => {
            openGameSection(button.dataset.section);
        });
    }
);

elements.closeContent.addEventListener("click", () => {
    elements.content.hidden = true;
});

// --------------------------------------------------
// СТАРТ
// --------------------------------------------------

initGame();
