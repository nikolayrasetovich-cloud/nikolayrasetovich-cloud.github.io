// =============================
// УТИЛИТЫ
// =============================

// Дебаунс для оптимизации
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Форматирование времени
function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Показать уведомление
function showNotification(message, type = 'info', duration = 2000) {
    const notification = document.createElement('div');
    notification.className = `copy-notification ${type}`;
    notification.textContent = message;
    notification.style.display = 'block';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

// Проверка мобильного устройства
function isMobile() {
    return window.innerWidth <= 768;
}

// Проверка тач-устройства
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Копирование в буфер обмена
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Ссылка скопирована!', 'success');
        return true;
    } catch (err) {
        // Fallback для старых браузеров
        return copyToClipboardFallback(text);
    }
}

// Fallback для копирования
function copyToClipboardFallback(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Ссылка скопирована!', 'success');
        return true;
    } catch (err) {
        showNotification('Не удалось скопировать ссылку', 'error');
        return false;
    } finally {
        document.body.removeChild(textArea);
    }
}

// =============================
// МЕНЕДЖЕР СКРОЛЛА NAVBAR
// =============================
class NavbarScrollManager {
    constructor() {
        this.header = document.getElementById('header');
        this.lastScrollTop = 0;
        this.scrollThreshold = 10;
        this.isHidden = false;
        this.init();
    }
    
    init() {
        if (!this.header) return;
        
        this.initScrollBehavior();
        this.initMobileMenuOverlay();
    }
    
    initScrollBehavior() {
        let ticking = false;
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
    
    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Определяем направление скролла
        if (scrollTop > this.lastScrollTop && scrollTop > 100) {
            // Скролл вниз - скрываем навбар
            if (!this.isHidden) {
                this.header.classList.add('header-hidden');
                this.isHidden = true;
            }
        } else {
            // Скролл вверх или в начале страницы - показываем навбар
            if (this.isHidden) {
                this.header.classList.remove('header-hidden');
                this.isHidden = false;
            }
        }
        
        this.lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }
    
    initMobileMenuOverlay() {
        // Закрытие мобильного меню при клике на оверлей
        const overlay = document.querySelector('.mobile-menu-overlay');
        const menuToggle = document.getElementById('mobile-menu-toggle');
        
        if (overlay && menuToggle) {
            overlay.addEventListener('click', () => {
                menuToggle.checked = false;
            });
        }
    }
}

// =============================
// СЛАЙДЕР БЕЗ АВТОПЛЕЯ
// =============================
class ManualSlider {
    constructor() {
        this.currentSlide = 0;
        this.slides = [];
        this.dots = [];
        
        this.init();
    }
    
    init() {
        this.slides = Array.from(document.querySelectorAll('.slider-slide'));
        this.dots = Array.from(document.querySelectorAll('.slide-dot'));
        
        if (this.slides.length === 0) return;
        
        this.initElements();
        this.initEventListeners();
        this.showSlide(0);
    }
    
    initElements() {
        this.elements = {
            prevBtn: document.querySelector('.arrow-prev'),
            nextBtn: document.querySelector('.arrow-next'),
            container: document.querySelector('.slider-container')
        };
    }
    
    initEventListeners() {
        // Стрелки
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.prevSlide());
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.nextSlide());
        }
        
        // Точки пагинации
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.showSlide(index));
        });
        
        // Клавиши клавиатуры (опционально)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.prevSlide();
            if (e.key === 'ArrowRight') this.nextSlide();
        });
        
        // Свайпы для мобильных
        if (isTouchDevice() && this.elements.container) {
            let startX = 0;
            let endX = 0;
            
            this.elements.container.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            });
            
            this.elements.container.addEventListener('touchmove', (e) => {
                endX = e.touches[0].clientX;
            });
            
            this.elements.container.addEventListener('touchend', () => {
                const threshold = 50;
                if (startX - endX > threshold) {
                    this.nextSlide();
                } else if (endX - startX > threshold) {
                    this.prevSlide();
                }
            });
        }
    }
    
    showSlide(index) {
        // Скрываем все слайды
        this.slides.forEach(slide => {
            slide.classList.remove('active');
            slide.style.opacity = '0';
        });
        
        // Показываем выбранный слайд
        this.currentSlide = (index + this.slides.length) % this.slides.length;
        const currentSlideElement = this.slides[this.currentSlide];
        
        currentSlideElement.classList.add('active');
        setTimeout(() => {
            currentSlideElement.style.opacity = '1';
        }, 10);
        
        // Обновляем точки
        this.updateDots();
    }
    
    updateDots() {
        this.dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentSlide);
        });
    }
    
    nextSlide() {
        this.showSlide(this.currentSlide + 1);
    }
    
    prevSlide() {
        this.showSlide(this.currentSlide - 1);
    }
}

// =============================
// МЕНЕДЖЕР ВИДЕО
// =============================
class VideoManager {
    constructor() {
        this.videos = [];
        this.currentPage = 1;
        this.videosPerPage = 6;
        this.currentFilter = 'all';
        
        this.init();
    }
    
    init() {
        // Данные видео
        this.videos = [
            {
                id: "6C8aI3ujAIc",
                title: "☁️ ПАСМУРНЫЕ ВЫХОДНЫЕ 🔥 КАЙФУЕМ В ИГРУЛЬКАХ 🕹️",
                description: "🔴 Прямой эфир / 21 декабря 2025",
                type: "other"
            },
            {
                id: "fB-CkOhtxy8",
                title: "❄️ ТРЭШ УЖЕ ТУТ 😱",
                description: "🔴 Прямой эфир / 09 декабря 2025",
                type: "other"
            },
            {
                id: "Ahn5xz1vTBM",
                title: "❄️ НЕЖНАЯ ЗИМА | ТРЭШ УЖЕ ТУТ 😱",
                description: "🔴 Прямой эфир / 08 декабря 2025",
                type: "other"
            },
        ];
        
        this.displayVideos();
        this.initEventListeners();
    }
    
    displayVideos(page = 1, filter = 'all') {
        const videoContainer = document.getElementById('video-grid');
        if (!videoContainer) return;
        
        videoContainer.innerHTML = '';
        
        let filteredVideos = this.videos;
        if (filter !== 'all') {
            filteredVideos = this.videos.filter(video => video.type === filter);
        }
        
        const startIndex = (page - 1) * this.videosPerPage;
        const endIndex = startIndex + this.videosPerPage;
        const videosToShow = filteredVideos.slice(startIndex, endIndex);
        
        videosToShow.forEach(video => {
            const videoCard = this.createVideoCard(video);
            videoContainer.appendChild(videoCard);
        });
        
        this.attachVideoEventHandlers();
        
        // Обновляем пагинацию
        this.updatePagination(filteredVideos.length, page);
        
        // Сохраняем состояние
        this.currentPage = page;
        this.currentFilter = filter;
    }
    
    createVideoCard(video) {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.setAttribute('data-type', video.type);
        
        const typeTags = this.generateTypeTags(video.type);
        
        videoCard.innerHTML = `
            <div class="video-card-header">
                ${typeTags}
                <div class="video-live-badge">
                    <span class="live-dot"></span>
                    <span class="live-text">Прямой эфир</span>
                </div>
            </div>
            <div class="video-wrapper">
                <img src="https://img.youtube.com/vi/${video.id}/hqdefault.jpg" 
                     alt="${video.title}"
                     class="video-thumbnail"
                     loading="lazy">
                <div class="video-overlay">
                    <button class="video-play-btn" data-video-id="${video.id}">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="video-card-content">
                <h3>${video.title}</h3>
                <p>${video.description}</p>
                <div class="video-actions">
                    <button class="watch-btn" data-video-id="${video.id}">
                        <i class="fas fa-play"></i> <span class="btn-text">Смотреть</span>
                    </button>
                    <button class="share-btn" data-video-url="https://www.youtube.com/watch?v=${video.id}">
                        <i class="fas fa-share-alt"></i>
                        <span class="share-tooltip">Копировать ссылку</span>
                    </button>
                </div>
            </div>
        `;
        
        return videoCard;
    }
    
    generateTypeTags(type) {
        const icons = {
            'irl': '🏡',
            'minecraft': '⛏️',
            'amongus': '👨‍🚀',
            'gta': '🚗',
            'rdr2': '🐎',
            'hide&seek': '🙈',
            'other': '🧩'
        };
        
        const labels = {
            'irl': 'IRL',
            'minecraft': 'Minecraft',
            'amongus': 'Among Us',
            'gta': 'GTA',
            'rdr2': 'RDR2',
            'hide&seek': 'Прятки',
            'other': 'Прочее'
        };
        
        const isSmallMobile = window.innerWidth <= 480;
        
        if (isSmallMobile) {
            return `<div class="video-type-badge compact">${icons[type] || '🎬'}</div>`;
        } else {
            return `
                <div class="video-type-badge">
                    <span class="type-icon">${icons[type] || '🎬'}</span>
                    <span class="type-label">${labels[type] || 'Видео'}</span>
                </div>
            `;
        }
    }
    
    attachVideoEventHandlers() {
        // Кнопки просмотра
        document.querySelectorAll('.watch-btn, .video-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const videoId = btn.getAttribute('data-video-id');
                this.playVideo(videoId);
            });
        });
        
        // Кнопки поделиться
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const videoUrl = btn.getAttribute('data-video-url');
                
                const success = await copyToClipboard(videoUrl);
                if (success) {
                    btn.classList.add('copied');
                    setTimeout(() => btn.classList.remove('copied'), 2000);
                }
            });
            
            // Тулкиты для кнопки поделиться
            btn.addEventListener('mouseenter', function() {
                const tooltip = this.querySelector('.share-tooltip');
                if (tooltip) {
                    tooltip.style.opacity = '1';
                    tooltip.style.visibility = 'visible';
                }
            });
            
            btn.addEventListener('mouseleave', function() {
                const tooltip = this.querySelector('.share-tooltip');
                if (tooltip) {
                    tooltip.style.opacity = '0';
                    tooltip.style.visibility = 'hidden';
                }
            });
        });
    }
    
    playVideo(videoId) {
        // Открываем видео в новой вкладке
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }
    
    updatePagination(totalVideos, currentPage) {
        const paginationContainer = document.getElementById('pagination');
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';
        
        const totalPages = Math.ceil(totalVideos / this.videosPerPage);
        
        if (totalPages <= 1) return;
        
        // Кнопка "Назад"
        const prevButton = document.createElement('button');
        prevButton.className = `pagination-btn ${currentPage === 1 ? 'disabled' : ''}`;
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                this.displayVideos(currentPage - 1, this.currentFilter);
                window.scrollTo({
                    top: document.getElementById('videos').offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
        paginationContainer.appendChild(prevButton);
        
        // Номера страниц
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                this.displayVideos(i, this.currentFilter);
                window.scrollTo({
                    top: document.getElementById('videos').offsetTop - 100,
                    behavior: 'smooth'
                });
            });
            paginationContainer.appendChild(pageButton);
        }
        
        // Кнопка "Вперед"
        const nextButton = document.createElement('button');
        nextButton.className = `pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`;
        nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                this.displayVideos(currentPage + 1, this.currentFilter);
                window.scrollTo({
                    top: document.getElementById('videos').offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
        paginationContainer.appendChild(nextButton);
    }
    
    initEventListeners() {
        // Фильтры
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.currentPage = 1;
                this.displayVideos(1, this.currentFilter);
            });
        });
    }
}

// =============================
// МЕНЕДЖЕР ЭФФЕКТОВ
// =============================
class EffectsManager {
    constructor() {
        this.snowflakesCount = isMobile() ? 15 : 30;
        this.init();
    }
    
    init() {
        this.createSnowflakes();
        this.initScrollEffects();
        this.initHoverEffects();
    }
    
    createSnowflakes() {
        const container = document.getElementById('snowflakes');
        if (!container) return;
        
        // Очищаем контейнер
        container.innerHTML = '';
        
        for (let i = 0; i < this.snowflakesCount; i++) {
            const flake = document.createElement('div');
            flake.className = 'snowflake';
            
            // Случайные параметры
            const size = Math.random() * 4 + 2;
            const left = Math.random() * 100;
            const duration = Math.random() * 10 + 10;
            const delay = Math.random() * 5;
            const opacity = Math.random() * 0.5 + 0.3;
            
            flake.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${left}%;
                animation-duration: ${duration}s;
                animation-delay: ${delay}s;
                opacity: ${opacity};
            `;
            
            container.appendChild(flake);
        }
    }
    
    initScrollEffects() {
        // Эффект появления элементов при скролле
        if ('IntersectionObserver' in window) {
            const observerOptions = {
                root: null,
                rootMargin: '0px',
                threshold: 0.1
            };
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, observerOptions);
            
            // Наблюдаем за карточками
            document.querySelectorAll('.video-card, .news-card, .update-card').forEach(card => {
                observer.observe(card);
            });
        }
    }
    
    initHoverEffects() {
        // Оптимизированные hover-эффекты для карточек
        document.querySelectorAll('.video-card, .news-card, .update-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
            });
        });
    }
}

// =============================
// МЕНЕДЖЕР СИСТЕМНЫХ СОБЫТИЙ
// =============================
class SystemEventsManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.initSmoothScroll();
        this.initImageErrorHandling();
        this.initResizeHandlers();
        this.initClickOutsideHandlers();
    }
    
    initSmoothScroll() {
        // Плавная прокрутка для якорных ссылок
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#' || href === '#!') return;
                
                const targetElement = document.querySelector(href);
                if (targetElement) {
                    e.preventDefault();
                    
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                    
                    // Закрываем мобильное меню если открыто
                    const menuToggle = document.getElementById('mobile-menu-toggle');
                    if (menuToggle) {
                        menuToggle.checked = false;
                    }
                }
            });
        });
    }
    
    initImageErrorHandling() {
        // Обработка ошибок загрузки изображений
        document.querySelectorAll('img').forEach(img => {
            img.addEventListener('error', () => {
                console.warn('Изображение не загрузилось:', img.src);
                // Можно установить placeholder
                // img.src = '/images/placeholder.jpg';
            });
        });
    }
    
    initResizeHandlers() {
        // Дебаунс для обработки изменения размера окна
        window.addEventListener('resize', debounce(() => {
            // Пересоздаем снежинки при изменении размера
            if (window.app && window.app.effects) {
                window.app.effects.snowflakesCount = isMobile() ? 15 : 30;
                window.app.effects.createSnowflakes();
            }
            
            // Обновляем видео если есть менеджер видео
            if (window.app && window.app.video) {
                window.app.video.displayVideos(
                    window.app.video.currentPage,
                    window.app.video.currentFilter
                );
            }
        }, 250));
    }
    
    initClickOutsideHandlers() {
        // Закрытие выпадающих меню при клике вне их
        document.addEventListener('click', (e) => {
            // Закрываем выпадающие меню
            document.querySelectorAll('.dropdown-toggle-checkbox').forEach(checkbox => {
                if (!checkbox.parentElement.contains(e.target) && checkbox.checked) {
                    checkbox.checked = false;
                }
            });
        });
    }
}

// =============================
// МЕДИАПЛЕЕР (упрощенная версия без автоплея)
// =============================
class SimpleMediaPlayer {
    constructor() {
        this.currentVideo = null;
        this.isPlaying = false;
        this.volume = 0.8;
        this.init();
    }
    
    init() {
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Открытие медиаплеера по кнопке (если есть)
        const openPlayerBtn = document.getElementById('open-player-btn');
        if (openPlayerBtn) {
            openPlayerBtn.addEventListener('click', () => this.openPlayer());
        }
    }
    
    openPlayer(videoId = null) {
        // В упрощенной версии открываем YouTube в новой вкладке
        if (videoId) {
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        } else {
            // Если нет конкретного видео, открываем канал
            window.open('https://www.youtube.com/@n1kolayrasetovich', '_blank');
        }
    }
    
    playVideo(videoId) {
        this.openPlayer(videoId);
    }
}

// =============================
// ГЛАВНОЕ ПРИЛОЖЕНИЕ
// =============================
class App {
    constructor() {
        this.managers = {};
        this.init();
    }
    
    async init() {
        // Ожидаем загрузки DOM
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Инициализируем менеджеры
        this.managers.navbar = new NavbarScrollManager();
        this.managers.slider = new ManualSlider();
        this.managers.video = new VideoManager();
        this.managers.effects = new EffectsManager();
        this.managers.events = new SystemEventsManager();
        this.managers.player = new SimpleMediaPlayer();
        
        // Оптимизируем изображения
        this.optimizeImages();
        
        // Восстанавливаем состояние
        this.restoreState();
        
        console.log('🎉 Приложение успешно инициализировано');
        console.log('📱 Мобильный режим:', isMobile());
        console.log('👆 Тач-устройство:', isTouchDevice());
    }
    
    optimizeImages() {
        // Добавляем lazy loading для всех изображений
        document.querySelectorAll('img').forEach(img => {
            if (!img.loading) {
                img.loading = 'lazy';
            }
        });
        
        // Оптимизация для старых браузеров
        if (!('loading' in HTMLImageElement.prototype)) {
            // Polyfill для lazy loading
            this.initLazyLoadingPolyfill();
        }
    }
    
    initLazyLoadingPolyfill() {
        // Простой полифилл для lazy loading
        const lazyImages = document.querySelectorAll('img[loading="lazy"]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src || img.src;
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            lazyImages.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback для старых браузеров
            lazyImages.forEach(img => {
                img.src = img.dataset.src || img.src;
            });
        }
    }
    
    restoreState() {
        // Восстанавливаем последний открытый слайд из localStorage
        const lastSlide = localStorage.getItem('last-slide');
        if (lastSlide && this.managers.slider) {
            setTimeout(() => {
                this.managers.slider.showSlide(parseInt(lastSlide));
            }, 100);
        }
        
        // Сохраняем текущий слайд при изменении
        if (this.managers.slider) {
            const originalShowSlide = this.managers.slider.showSlide.bind(this.managers.slider);
            this.managers.slider.showSlide = function(index) {
                originalShowSlide(index);
                localStorage.setItem('last-slide', this.currentSlide);
            };
        }
    }
    
    // Публичные методы для использования из консоли
    updateVideos(newVideos) {
        if (this.managers.video) {
            this.managers.video.videos = newVideos;
            this.managers.video.displayVideos(1, 'all');
            console.log('📹 Видео обновлены:', newVideos.length);
        }
    }
    
    playVideo(videoId) {
        if (this.managers.player) {
            this.managers.player.playVideo(videoId);
        }
    }
    
    showSlide(slideIndex) {
        if (this.managers.slider) {
            this.managers.slider.showSlide(slideIndex);
        }
    }
    
    refreshSnowflakes() {
        if (this.managers.effects) {
            this.managers.effects.createSnowflakes();
        }
    }
}

// =============================
// ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ
// =============================

let appInstance = null;

function initApp() {
    if (!appInstance) {
        appInstance = new App();
        window.app = appInstance; // Для отладки из консоли
    }
    return appInstance;
}

// Автоматическая инициализация при загрузке
if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}

// Экспорт полезных функций для использования в консоли
window.App = App;
window.copyToClipboard = copyToClipboard;
window.showNotification = showNotification;
window.formatTime = formatTime;

// YouTube API callback (если используется)
window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube API готов к использованию');
};

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Необработанный промис:', e.reason);
});

// =============================
// ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ
// =============================

// Отключение анимаций для пользователей с настройками
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.setProperty('--transition', 'none');
    document.querySelectorAll('.snowflake, .live-dot').forEach(el => {
        el.style.animation = 'none';
    });
}

// Оптимизация для старых устройств
if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
        // Фоновые задачи
        console.log('Выполняем фоновые задачи...');
    });
}

// Service Worker регистрация (опционально)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('Service Worker регистрация не удалась:', error);
        });
    });
}

// =============================
// ГОТОВЫЕ КОМАНДЫ ДЛЯ КОНСОЛИ
// =============================

/*
Доступные команды из консоли браузера:

1. app.showSlide(2) - показать 3-й слайд
2. app.playVideo('fB-CkOhtxy8') - воспроизвести видео
3. app.refreshSnowflakes() - обновить снежинки
4. showNotification('Тест', 'success') - показать уведомление
5. copyToClipboard('текст') - скопировать в буфер
*/


// Анимация секции "Братья" при скролле
function initBrothersAnimation() {
    const section = document.querySelector('.brothers-section');
    if (!section) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                section.classList.add('in-view');
                observer.unobserve(section);
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(section);
}

// Инициализация видео фона
function initVideoBackground() {
    const video = document.querySelector('.video-bg');
    if (!video) return;
    
    // Улучшенная обработка видео
    video.addEventListener('loadedmetadata', () => {
        console.log('✅ Видеофон загружен');
    });
    
    video.addEventListener('error', () => {
        console.log('⚠️ Видео не загрузилось, используем фолбэк');
        // Можно добавить фолбэк изображение
    });
    
    // Адаптация видео для мобильных
    if (window.innerWidth <= 768) {
        video.playbackRate = 0.8; // Замедляем видео на мобильных
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    initBrothersAnimation();
    initVideoBackground();
});

// Оптимизация для ресайза
window.addEventListener('resize', () => {
    const video = document.querySelector('.video-bg');
    if (video && window.innerWidth <= 768) {
        video.playbackRate = 0.8;
    } else if (video) {
        video.playbackRate = 1;
    }
});


// Улучшение мобильного меню
function initMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    if (!menuToggle || !overlay) return;
    
    // Закрытие меню при клике на оверлей
    overlay.addEventListener('click', () => {
        menuToggle.checked = false;
    });
    
    // Закрытие меню при клике на ссылку
    document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.checked = false;
            
            // Если это выпадающее меню, не сбрасываем его чекбокс
            if (!link.classList.contains('dropdown-label')) {
                const dropdownToggle = document.getElementById('dropdown-toggle');
                if (dropdownToggle) {
                    dropdownToggle.checked = false;
                }
            }
        });
    });
    
    // Закрытие меню при нажатии Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuToggle.checked) {
            menuToggle.checked = false;
        }
    });
    
    // Предотвращение прокрутки страницы при открытом меню
    menuToggle.addEventListener('change', function() {
        if (this.checked) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });
    
    // Закрытие выпадающего меню при клике вне его
    document.addEventListener('click', (e) => {
        const dropdownToggle = document.getElementById('dropdown-toggle');
        if (dropdownToggle && !e.target.closest('.dropdown')) {
            dropdownToggle.checked = false;
        }
    });
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initMobileMenu);