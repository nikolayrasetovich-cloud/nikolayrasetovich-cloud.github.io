
import { requireSupabase } from "./supabase.js";

// =====================================
// SUPABASE
// =====================================

const supabase = requireSupabase();

// =====================================
// ДАННЫЕ
// =====================================

let videos = [];
let currentFilter = "all";

// =====================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);

    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
        return [
            hours,
            String(minutes).padStart(2, "0"),
            String(secs).padStart(2, "0")
        ].join(":");
    }

    return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatDate(dateValue) {
    if (!dateValue) return "Дата не указана";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Дата не указана";
    }

    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function getThumbnail(id) {
    return `https://img.youtube.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`;
}

function getFallbackThumbnail(id) {
    return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

function getCategoryIcon(type) {
    const icons = {
        irl: "fa-house",
        minecraft: "fa-cube",
        amongus: "fa-user-secret",
        other: "fa-gamepad"
    };

    return icons[type] || "fa-video";
}

function getCurrentMonthVideos() {
    const now = new Date();

    return videos.filter(video => {
        if (!video.publishedAt) return false;

        const date = new Date(video.publishedAt);

        return (
            !Number.isNaN(date.getTime()) &&
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth()
        );
    });
}

function calculateTotalHours(arr) {
    const totalSeconds = arr.reduce(
        (sum, video) => sum + video.durationSeconds,
        0
    );

    return Math.floor(totalSeconds / 3600);
}

function showMessage(
    container,
    title,
    description,
    icon = "fa-video-slash"
) {
    if (!container) return;

    container.innerHTML = `
        <div class="no-videos-message">
            <i class="fas ${escapeHTML(icon)}"></i>
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(description)}</p>
        </div>
    `;
}

// =====================================
// ЗАГРУЗКА ВИДЕО ИЗ SUPABASE
// =====================================

async function loadVideos() {
    const container = document.getElementById("videosContainer");

    showMessage(
        container,
        "Загружаем видео...",
        "Пожалуйста, подождите",
        "fa-spinner"
    );

    const { data, error } = await supabase
        .from("content_items")
        .select(`
            id,
            title,
            description,
            category,
            published_at,
            created_at,
            videos!inner (
                youtube_id,
                video_url,
                duration_seconds
            )
        `)
        .eq("type", "video")
        .eq("status", "published")
        .order("published_at", { ascending: false });

    console.log("ВИДЕО ИЗ SUPABASE:", data);
    console.log("ОШИБКА SUPABASE:", error);

    if (error) {
        console.error("Ошибка загрузки видео:", error);

        showMessage(
            container,
            "Не удалось загрузить видео",
            "Проверь подключение к Supabase и права доступа",
            "fa-triangle-exclamation"
        );

        const monthlyContainer = document.getElementById(
            "monthlyVideosContainer"
        );

        showMessage(
            monthlyContainer,
            "Не удалось загрузить видео",
            "Попробуй обновить страницу",
            "fa-triangle-exclamation"
        );

        return;
    }

    videos = (data || [])
        .map(item => {
            const videoData = Array.isArray(item.videos)
                ? item.videos[0]
                : item.videos;

            if (!videoData || !videoData.youtube_id) {
                return null;
            }

            const publishedAt = item.published_at || item.created_at;

            const durationSeconds =
                Number(videoData.duration_seconds) || 0;

            return {
                id: videoData.youtube_id,
                title: item.title || "Без названия",
                description: item.description || "",
                durationSeconds,
                duration: formatDuration(durationSeconds),
                publishedAt,
                date: formatDate(publishedAt),
                type: item.category || "other"
            };
        })
        .filter(video => video !== null);

    console.log("ПОДГОТОВЛЕННЫЕ ВИДЕО:", videos);

    renderMonthlyVideos();
    renderAllVideos(currentFilter);
}

// =====================================
// ВИДЕО ТЕКУЩЕГО МЕСЯЦА
// =====================================

function renderMonthlyVideos() {
    const container = document.getElementById(
        "monthlyVideosContainer"
    );

    if (!container) return;

    const monthVideos = getCurrentMonthVideos();

    const countElement = document.getElementById("monthVideoCount");
    const hoursElement = document.getElementById("monthHoursCount");
    const monthNameElement = document.getElementById("monthName");

    if (countElement) {
        countElement.textContent = monthVideos.length;
    }

    if (hoursElement) {
        hoursElement.textContent =
            calculateTotalHours(monthVideos) + "+";
    }

    if (monthNameElement) {
        monthNameElement.textContent =
            new Intl.DateTimeFormat("ru-RU", {
                month: "long",
                year: "numeric"
            }).format(new Date());
    }

    if (!monthVideos.length) {
        showMessage(
            container,
            "В этом месяце ещё нет видео",
            "Скоро появятся новые записи!"
        );

        return;
    }

    const toShow = monthVideos.slice(0, 4);

    container.innerHTML = toShow.map((video, index) => `
        <div
            class="monthly-video-item ${index === 0 ? "highlighted" : ""}"
            data-id="${escapeHTML(video.id)}"
        >
            <div class="video-thumbnail-container">

                <img
                    class="video-thumbnail"
                    src="${getThumbnail(video.id)}"
                    alt="${escapeHTML(video.title)}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${getFallbackThumbnail(video.id)}'"
                >

                ${
                    index === 0
                        ? '<span class="featured-badge">Новое</span>'
                        : ""
                }

                <span class="video-duration">
                    ${escapeHTML(video.duration)}
                </span>

            </div>

            <div class="video-info">

                <h3>${escapeHTML(video.title)}</h3>

                <div class="video-meta">

                    <span>
                        <i class="far fa-calendar"></i>
                        ${escapeHTML(video.date)}
                    </span>

                    <span>
                        <i class="far fa-clock"></i>
                        ${escapeHTML(video.duration)}
                    </span>

                </div>

            </div>
        </div>
    `).join("");

    container
        .querySelectorAll(".monthly-video-item")
        .forEach(element => {
            element.addEventListener("click", () => {
                const video = videos.find(
                    v => v.id === element.dataset.id
                );

                if (video) {
                    openPlayer(video);
                }
            });
        });
}

// =====================================
// ВСЕ ВИДЕО
// =====================================

function renderAllVideos(filter = "all") {
    const container = document.getElementById("videosContainer");

    if (!container) return;

    const filtered = filter === "all"
        ? videos
        : videos.filter(video => video.type === filter);

    if (!filtered.length) {
        showMessage(
            container,
            "Видео не найдены",
            "Попробуйте выбрать другую категорию",
            "fa-search"
        );

        return;
    }

    container.innerHTML = filtered.map(video => `
        <div
            class="video-item"
            data-id="${escapeHTML(video.id)}"
        >

            <div class="video-thumbnail-container">

                <img
                    class="video-thumbnail"
                    src="${getThumbnail(video.id)}"
                    alt="${escapeHTML(video.title)}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${getFallbackThumbnail(video.id)}'"
                >

                <div class="video-play-overlay">
                    <div class="play-icon">
                        <i class="fas fa-play"></i>
                    </div>
                </div>

                <span class="video-duration">
                    ${escapeHTML(video.duration)}
                </span>

                <span class="video-category">
                    <i class="fas ${getCategoryIcon(video.type)}"></i>
                </span>

            </div>

            <div class="video-info">

                <h3>${escapeHTML(video.title)}</h3>

                <div class="video-meta">

                    <span>
                        <i class="far fa-calendar"></i>
                        ${escapeHTML(video.date)}
                    </span>

                    <span>
                        <i class="far fa-clock"></i>
                        ${escapeHTML(video.duration)}
                    </span>

                </div>

                <p class="video-description">
                    ${escapeHTML(video.description)}
                </p>

            </div>

        </div>
    `).join("");

    container
        .querySelectorAll(".video-item")
        .forEach(element => {
            element.addEventListener("click", () => {
                const video = videos.find(
                    v => v.id === element.dataset.id
                );

                if (video) {
                    openPlayer(video);
                }
            });
        });
}

// =====================================
// ФИЛЬТРЫ
// =====================================

function initFilters() {
    const buttons = document.querySelectorAll(".filter-btn");

    buttons.forEach(button => {
        button.addEventListener("click", function () {

            buttons.forEach(btn => {
                btn.classList.remove("active");
            });

            this.classList.add("active");

            currentFilter = this.dataset.filter || "all";

            renderAllVideos(currentFilter);
        });
    });
}

// =====================================
// YOUTUBE-ПЛЕЕР
// =====================================

const modal = document.getElementById("youtubeModal");
const iframe = document.getElementById("youtubeIframe");
const closeBtn = document.getElementById("youtubeClose");
const titleEl = document.getElementById("youtubeTitle");

function openPlayer(video) {
    if (!modal || !iframe || !titleEl) return;

    titleEl.textContent = video.title;

    iframe.src =
        `https://www.youtube.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0&modestbranding=1`;

    modal.classList.add("active");

    document.body.style.overflow = "hidden";
}

function closePlayer() {
    if (!modal || !iframe) return;

    modal.classList.remove("active");

    iframe.src = "";

    document.body.style.overflow = "";
}

if (closeBtn) {
    closeBtn.addEventListener("click", closePlayer);
}

if (modal) {
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closePlayer();
        }
    });
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closePlayer();
    }
});

// =====================================
// МОБИЛЬНОЕ МЕНЮ
// =====================================

(function mobileMenu() {
    const btn = document.getElementById("mobileMenuBtn");
    const menu = document.querySelector(".nav-menu");

    if (!btn || !menu) return;

    function closeMenu() {
        menu.classList.remove("active");
        btn.classList.remove("active");

        document.body.style.overflow = "";
    }

    function toggleMenu() {
        menu.classList.toggle("active");
        btn.classList.toggle("active");

        document.body.style.overflow =
            menu.classList.contains("active") ? "hidden" : "";
    }

    btn.addEventListener("click", toggleMenu);

    menu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });
})();

// =====================================
// ХЕДЕР ПРИ ПРОКРУТКЕ
// =====================================

(function headerScroll() {
    const header = document.querySelector(".navbar");

    if (!header) return;

    let last = 0;

    window.addEventListener("scroll", () => {
        const y = window.pageYOffset;

        if (y > 100 && y > last) {
            header.classList.add("hide");
        } else if (y < last || y <= 100) {
            header.classList.remove("hide");
        }

        last = y;
    }, { passive: true });
})();

// =====================================
// ИНИЦИАЛИЗАЦИЯ
// =====================================

initFilters();

loadVideos().catch(error => {
    console.error(
        "Ошибка инициализации видеостраницы:",
        error
    );

    showMessage(
        document.getElementById("videosContainer"),
        "Ошибка загрузки",
        "Не удалось подключиться к базе данных",
        "fa-triangle-exclamation"
    );

    showMessage(
        document.getElementById("monthlyVideosContainer"),
        "Ошибка загрузки",
        "Не удалось подключиться к базе данных",
        "fa-triangle-exclamation"
    );
});
