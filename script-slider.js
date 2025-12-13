// ==================== IMPROVED NAVIGATION ====================
 document.addEventListener('DOMContentLoaded', function() {
    const header = document.getElementById('header');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mainNav = document.getElementById('main-nav');
    const openPlayerBtn = document.getElementById('open-player-btn');
    const searchToggle = document.querySelector('.search-toggle');
    const searchPanel = document.getElementById('search-panel');
    const searchClose = document.getElementById('search-close');
    const searchInput = document.querySelector('.search-input');
    const dropdowns = document.querySelectorAll('.dropdown');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let lastScrollTop = 0;
    const scrollThreshold = 100;
    const hideThreshold = 200;

    // Функция для скрытия/показа хедера при скролле
    function handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDelta = scrollTop - lastScrollTop;
        
        // Показываем хедер вверху страницы
        if (scrollTop < 50) {
            header.classList.remove('header-hidden', 'header-scrolled');
            return;
        }
        
        // Добавляем класс скролла для стилизации
        if (scrollTop > scrollThreshold) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
        
        // Скрываем при скролле вниз, показываем при скролле вверх
        if (Math.abs(scrollDelta) > 10) {
            if (scrollDelta > 0 && scrollTop > hideThreshold) {
                // Скролл вниз - скрываем
                header.classList.add('header-hidden');
            } else if (scrollDelta < 0) {
                // Скролл вверх - показываем
                header.classList.remove('header-hidden');
            }
        }
        
        lastScrollTop = scrollTop;
    }

    // Мобильное меню
    function toggleMobileMenu() {
        mobileMenuBtn.classList.toggle('active');
        mainNav.classList.toggle('active');
        
        // Создаем оверлей для мобильного меню
        let overlay = document.querySelector('.menu-overlay');
        if (!overlay && mainNav.classList.contains('active')) {
            overlay = document.createElement('div');
            overlay.className = 'menu-overlay';
            document.body.appendChild(overlay);
            
            overlay.addEventListener('click', () => {
                mobileMenuBtn.classList.remove('active');
                mainNav.classList.remove('active');
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 300);
            });
            
            setTimeout(() => overlay.classList.add('active'), 10);
        } else if (overlay && !mainNav.classList.contains('active')) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
        
        // Блокируем скролл при открытом меню
        document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : '';
    }

    // Открытие медиаплеера
    function openMediaPlayer() {
        const mediaPlayer = window.getMediaPlayer();
        if (mediaPlayer) {
            mediaPlayer.openPlayer();
        }
    }

    // Поиск
    function toggleSearch() {
        searchPanel.classList.toggle('active');
        if (searchPanel.classList.contains('active')) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }

    // Закрытие поиска
    function closeSearch() {
        searchPanel.classList.remove('active');
        searchInput.value = '';
    }

    // Обработка выпадающих меню на мобильных
    function handleDropdowns() {
        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            const menu = dropdown.querySelector('.dropdown-menu');
            
            if (toggle && menu) {
                toggle.addEventListener('click', (e) => {
                    if (window.innerWidth <= 768) {
                        e.preventDefault();
                        dropdown.classList.toggle('active');
                    }
                });
            }
        });
    }

    // Активная ссылка навигации
    function setActiveNavLink() {
        const currentPath = window.location.pathname;
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            } else if (currentPath === '/index.html' && link.getAttribute('href') === '/') {
                link.classList.add('active');
            } else if (currentPath.includes('newswire') && link.getAttribute('href') === '/newswire.html') {
                link.classList.add('active');
            } else if (currentPath.includes('videos') && link.getAttribute('href') === '/videos.html') {
                link.classList.add('active');
            }
        });
    }

    // Закрытие меню при клике на ссылку (на мобильных)
    function closeMenuOnClick() {
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768 && mainNav.classList.contains('active')) {
                    mobileMenuBtn.classList.remove('active');
                    mainNav.classList.remove('active');
                    document.body.style.overflow = '';
                    
                    const overlay = document.querySelector('.menu-overlay');
                    if (overlay) {
                        overlay.remove();
                    }
                }
            });
        });
    }

    // Поисковый функционал
    function initSearch() {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearch();
            }
        });
        
        // Пример обработки поиска
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                // Здесь можно добавить поиск
                console.log('Search query:', query);
            }
        });
    }

    // Инициализация
    function initNavigation() {
        // Инициализируем обработчики
        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        if (openPlayerBtn) openPlayerBtn.addEventListener('click', openMediaPlayer);
        if (searchToggle) searchToggle.addEventListener('click', toggleSearch);
        if (searchClose) searchClose.addEventListener('click', closeSearch);
        
        // Закрытие поиска по клику вне поля
        document.addEventListener('click', (e) => {
            if (!searchPanel.contains(e.target) && 
                !searchToggle.contains(e.target) && 
                searchPanel.classList.contains('active')) {
                closeSearch();
            }
        });
        
        // Обработчики скролла
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Дополнительные инициализации
        handleDropdowns();
        setActiveNavLink();
        closeMenuOnClick();
        initSearch();
        
        // Устанавливаем начальное состояние
        handleScroll();
    }

    // Запускаем навигацию
    initNavigation();
});

// // // // // // // // / // / / // / / /  / /  //  / /   /   /  / / / /  /    /

// =============================
// SLIDER FUNCTIONALITY - СО СТРЕЛКАМИ ПО БОКАМ
// =============================

class HeroSlider {
    constructor() {
        this.sliderWrapper = document.querySelector('.slider-wrapper');
        this.slides = document.querySelectorAll('.slider-slide');
        this.dots = document.querySelectorAll('.slide-dot');
        this.prevArrow = document.querySelector('.arrow-prev');
        this.nextArrow = document.querySelector('.arrow-next');
        
        this.currentIndex = 0;
        this.totalSlides = this.slides.length;
        this.isAnimating = false;
        this.animationSpeed = 500;
        
        this.init();
    }
    
    init() {
        this.showSlide(0);
        this.addEventListeners();
        this.updateArrowStates();
    }
    
    addEventListeners() {
        // Обработчики для точек
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                if (!this.isAnimating && index !== this.currentIndex) {
                    this.goToSlide(index);
                }
            });
        });
        
        // Обработчики для стрелок
        if (this.prevArrow) {
            this.prevArrow.addEventListener('click', () => {
                if (!this.isAnimating) {
                    this.prevSlide();
                }
            });
        }
        
        if (this.nextArrow) {
            this.nextArrow.addEventListener('click', () => {
                if (!this.isAnimating) {
                    this.nextSlide();
                }
            });
        }
        
        // Свайпы для мобильных (опционально)
        if (this.sliderWrapper) {
            let touchStartX = 0;
            let touchEndX = 0;
            
            this.sliderWrapper.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            });
            
            this.sliderWrapper.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe(touchStartX, touchEndX);
            });
        }
        
        // Управление с клавиатуры (опционально)
        document.addEventListener('keydown', (e) => {
            if (!this.sliderWrapper) return;
            
            const rect = this.sliderWrapper.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (isVisible && !this.isAnimating) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.prevSlide();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.nextSlide();
                }
            }
        });
    }
    
    handleSwipe(startX, endX) {
        const minSwipeDistance = 50;
        const distance = startX - endX;
        
        if (Math.abs(distance) > minSwipeDistance) {
            if (distance > 0) {
                // Свайп влево - следующий слайд
                this.nextSlide();
            } else {
                // Свайп вправо - предыдущий слайд
                this.prevSlide();
            }
        }
    }
    
    showSlide(index) {
        this.currentIndex = index;
        
        // Анимация перехода слайдов
        this.slides.forEach((slide, i) => {
            if (i === index) {
                slide.classList.add('active');
                this.animateSlideIn(slide);
            } else {
                slide.classList.remove('active');
                slide.style.opacity = '0';
                slide.style.transform = 'translateX(20px)';
            }
        });
        
        // Обновление точек
        this.dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
        
        // Обновление состояния стрелок
        this.updateArrowStates();
    }
    
    animateSlideIn(slide) {
        this.isAnimating = true;
        
        slide.style.transition = 'none';
        slide.style.opacity = '0';
        slide.style.transform = 'translateX(-20px)';
        
        requestAnimationFrame(() => {
            slide.style.transition = `all ${this.animationSpeed}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            slide.style.opacity = '1';
            slide.style.transform = 'translateX(0)';
            
            setTimeout(() => {
                this.isAnimating = false;
            }, this.animationSpeed);
        });
    }
    
    goToSlide(index) {
        if (this.isAnimating || index < 0 || index >= this.totalSlides) return;
        
        this.showSlide(index);
    }
    
    nextSlide() {
        const nextIndex = (this.currentIndex + 1) % this.totalSlides;
        this.goToSlide(nextIndex);
    }
    
    prevSlide() {
        const prevIndex = (this.currentIndex - 1 + this.totalSlides) % this.totalSlides;
        this.goToSlide(prevIndex);
    }
    
    updateArrowStates() {
        // Можно добавить логику для отключения стрелок на первом/последнем слайде
        // если нужно, но для циклического слайдера обычно не требуется
        
        // Пример: если нужно отключить стрелки на крайних слайдах
        // if (this.prevArrow) {
        //     this.prevArrow.disabled = this.currentIndex === 0;
        // }
        // 
        // if (this.nextArrow) {
        //     this.nextArrow.disabled = this.currentIndex === this.totalSlides - 1;
        // }
    }
}

// Инициализация слайдера
document.addEventListener('DOMContentLoaded', () => {
    window.heroSlider = new HeroSlider();
});