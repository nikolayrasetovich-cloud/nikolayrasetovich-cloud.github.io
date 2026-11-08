
import { requireSupabase } from "./supabase.js";
import { showMessage } from "./utils.js";

const supabase = requireSupabase();

let currentUser = null;
let currentProfile = null;
let isOwnProfile = false;

let selectedAvatarFile = null;
let selectedCoverFile = null;

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value ?? "";
}

function setImage(selector, url) {
    const element = $(selector);
    if (!element) return;

    element.src = url || "/images/brothers-gallery/Никита.jpg";

    element.onerror = () => {
        element.onerror = null;
        element.src = "/images/brothers-gallery/Никита.jpg";
    };
}

function setCover(url) {
    const cover = $("#profileCover");
    if (!cover) return;

    if (url) {
        cover.src = url;
        cover.hidden = false;

        cover.onerror = () => {
            cover.onerror = null;
            cover.hidden = true;
        };
    } else {
        cover.removeAttribute("src");
        cover.hidden = true;
    }
}

function displayProfile(profile) {
    currentProfile = profile;

    const displayName =
        profile.display_name || profile.username || "Пользователь";

    const username = profile.username
        ? `@${profile.username}`
        : "";

    const description =
        profile.description ||
        "Пользователь пока ничего не рассказал о себе.";

    setText("#profilePageTitle", displayName);
    setText("#profileDisplayName", displayName);
    setText("#profileUsername", username);
    setText("#profileBio", description);
    setText("#profileDescription", description);

    setImage("#profileAvatar", profile.avatar_url);
    setCover(profile.cover_url);

    const editButton = $("#editProfileBtn");

    if (editButton) {
        editButton.hidden = !isOwnProfile;
    }

    const editArea = $("#profileEditArea");

    if (editArea) {
        editArea.hidden = !isOwnProfile;
    }
}

async function loadProfile() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error) throw error;

    currentUser = user;

    if (!currentUser) {
        setText("#profileDisplayName", "Вы не вошли в аккаунт");
        setText("#profileBio", "Войдите в аккаунт, чтобы увидеть профиль.");

        if ($("#editProfileBtn")) {
            $("#editProfileBtn").hidden = true;
        }

        return;
    }

    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("id") || currentUser.id;

    const { data, error: profileError } = await supabase.rpc(
        "get_friend_profile",
        {
            profile_user_id: targetId
        }
    );

    if (profileError) throw profileError;

    const profile = data?.[0];

    if (!profile) {
        throw new Error("Профиль не найден или нет доступа.");
    }

    isOwnProfile = profile.id === currentUser.id;

    displayProfile(profile);

    const editButton = $("#editProfileBtn");

    if (editButton && isOwnProfile) {
        editButton.onclick = openEditForm;
    }
}

function openEditForm() {
    if (!isOwnProfile || !currentProfile) return;

    $("#profileEditModal")?.remove();

    selectedAvatarFile = null;
    selectedCoverFile = null;

    const modal = document.createElement("div");

    modal.id = "profileEditModal";
    modal.className = "profile-edit-modal";

    modal.innerHTML = `
        <div class="profile-edit-content">

            <button
                type="button"
                class="profile-edit-close"
                id="closeProfileEdit"
                aria-label="Закрыть"
            >×</button>

            <div class="profile-edit-heading">
                <span>TTFBB ACCOUNT</span>
                <h2>Редактировать профиль</h2>
                <p>Настрой внешний вид своего профиля</p>
            </div>

            <form id="profileEditForm">

                <div class="profile-edit-avatar">
                    <img
                        id="avatarPreview"
                        src="${escapeHTML(currentProfile.avatar_url || "/images/brothers-gallery/Никита.jpg")}"
                        alt="Аватар"
                    >

                    <label for="editAvatar" class="avatar-upload-label">
                        Изменить фотографию
                    </label>

                    <input
                        id="editAvatar"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                    >
                </div>

                <div class="profile-edit-cover">
                    <label for="editCover" class="profile-cover-upload-label">
                        Обложка профиля
                    </label>

                    <img
                        id="coverPreview"
                        src="${escapeHTML(currentProfile.cover_url || "")}"
                        alt="Предпросмотр обложки"
                        ${currentProfile.cover_url ? "" : "hidden"}
                    >

                    <input
                        id="editCover"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                    >

                    <label for="editCover" class="avatar-upload-label">
                        ${currentProfile.cover_url ? "Изменить обложку" : "Загрузить обложку"}
                    </label>
                </div>

                <label for="editDisplayName">
                    Отображаемое имя
                </label>

                <input
                    id="editDisplayName"
                    type="text"
                    maxlength="50"
                    value="${escapeHTML(currentProfile.display_name || "")}"
                    required
                >

                <label for="editDescription">
                    О себе
                </label>

                <textarea
                    id="editDescription"
                    maxlength="500"
                    rows="4"
                    placeholder="Расскажи немного о себе..."
                >${escapeHTML(currentProfile.description || "")}</textarea>

                <button
                    type="submit"
                    id="saveProfileBtn"
                    class="profile-save-button"
                >
                    Сохранить изменения
                </button>

            </form>
        </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
        modal.classList.add("is-open");
    });

    $("#closeProfileEdit").addEventListener("click", closeEditForm);

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeEditForm();
        }
    });

    $("#editAvatar").addEventListener("change", handleAvatarPreview);
    $("#editCover").addEventListener("change", handleCoverPreview);

    $("#profileEditForm").addEventListener("submit", saveProfile);
}

function closeEditForm() {
    const modal = $("#profileEditModal");

    if (!modal) return;

    modal.classList.remove("is-open");

    setTimeout(() => modal.remove(), 200);

    selectedAvatarFile = null;
    selectedCoverFile = null;
}

function validateImage(file) {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error("Выбери изображение JPG, PNG или WEBP.");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Максимальный размер изображения — 5 МБ.");
    }
}

function showPreview(file, selector) {
    const reader = new FileReader();

    reader.onload = () => {
        const preview = $(selector);

        if (preview) {
            preview.src = reader.result;
            preview.hidden = false;
        }
    };

    reader.readAsDataURL(file);
}

function handleAvatarPreview(event) {
    const file = event.target.files?.[0];

    selectedAvatarFile = null;

    if (!file) return;

    try {
        validateImage(file);
        selectedAvatarFile = file;
        showPreview(file, "#avatarPreview");
    } catch (error) {
        showMessage(error.message, "error");
        event.target.value = "";
    }
}

function handleCoverPreview(event) {
    const file = event.target.files?.[0];

    selectedCoverFile = null;

    if (!file) return;

    try {
        validateImage(file);
        selectedCoverFile = file;
        showPreview(file, "#coverPreview");

        const label = document.querySelector(
            ".profile-cover-upload-label + img + input + label"
        );

        if (label) {
            label.textContent = "Изменить обложку";
        }
    } catch (error) {
        showMessage(error.message, "error");
        event.target.value = "";
    }
}

async function uploadImage(file, folder) {
    if (!file || !currentUser) {
        return null;
    }

    const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    };

    const extension = extensions[file.type];

    if (!extension) {
        throw new Error("Неподдерживаемый формат изображения.");
    }

    const filePath =
        `${currentUser.id}/${folder}-${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

    return data.publicUrl;
}

async function uploadAvatar(file) {
    if (!file) return currentProfile.avatar_url;

    return await uploadImage(file, "avatar");
}

async function uploadCover(file) {
    if (!file) return currentProfile.cover_url || null;

    return await uploadImage(file, "cover");
}

async function saveProfile(event) {
    event.preventDefault();

    if (!isOwnProfile || !currentUser) {
        showMessage("Нельзя редактировать чужой профиль.", "error");
        return;
    }

    const saveButton = $("#saveProfileBtn");

    saveButton.disabled = true;
    saveButton.textContent = "Сохранение...";

    try {
        const displayName = $("#editDisplayName").value.trim();
        const description = $("#editDescription").value.trim();

        if (!displayName) {
            throw new Error("Имя не может быть пустым.");
        }

        let avatarUrl = currentProfile.avatar_url;
        let coverUrl = currentProfile.cover_url || null;

        if (selectedAvatarFile) {
            avatarUrl = await uploadAvatar(selectedAvatarFile);
        }

        if (selectedCoverFile) {
            coverUrl = await uploadCover(selectedCoverFile);
        }

        const { data, error } = await supabase
            .from("profiles")
            .update({
                display_name: displayName,
                description,
                avatar_url: avatarUrl,
                cover_url: coverUrl,
                updated_at: new Date().toISOString()
            })
            .eq("id", currentUser.id)
            .select("id, username, display_name, avatar_url, description, cover_url")
            .single();

        if (error) throw error;

        displayProfile(data);

        closeEditForm();

        showMessage("Профиль успешно обновлён!", "success");

    } catch (error) {
        console.error("Ошибка сохранения профиля:", error);

        showMessage(
            error.message || "Не удалось сохранить профиль.",
            "error"
        );

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Сохранить изменения";
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadProfile();
    } catch (error) {
        console.error("Ошибка загрузки профиля:", error);

        setText("#profileDisplayName", "Не удалось открыть профиль");
        setText("#profileBio", error.message);

        if ($("#editProfileBtn")) {
            $("#editProfileBtn").hidden = true;
        }
    }
});
