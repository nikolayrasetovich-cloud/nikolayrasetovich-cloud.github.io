// РАБОЧИЙ СЛАЙДЕР С 3 СЛАЙДАМИ БЕЗ АВТОПЛЕЯ
document.addEventListener('DOMContentLoaded', function() {
    // Элементы слайдера
    const slides = document.querySelectorAll('.slider-slide');
    const dots = document.querySelectorAll('.slide-dot');
    const prevBtn = document.querySelector('.arrow-prev');
    const nextBtn = document.querySelector('.arrow-next');
    
    if (slides.length === 0) return;
    
    let currentSlide = 0;
    let isAnimating = false;
    const slideCount = slides.length;
    
    console.log(`🎠 Найдено слайдов: ${slideCount}`);
    
    // Функция показа слайда (упрощенная версия)
    function showSlide(index) {
        if (isAnimating) return;
        if (index < 0) index = slideCount - 1;
        if (index >= slideCount) index = 0;
        
        console.log(`Переключаем слайд с ${currentSlide} на ${index}`);
        
        isAnimating = true;
        
        // Скрываем текущий слайд
        const currentActiveSlide = slides[currentSlide];
        currentActiveSlide.classList.remove('active');
        currentActiveSlide.style.opacity = '0';
        currentActiveSlide.style.visibility = 'hidden';
        
        // Показываем новый слайд
        currentSlide = index;
        const newActiveSlide = slides[currentSlide];
        
        // Даем время для скрытия текущего слайда
        setTimeout(() => {
            newActiveSlide.style.display = 'block';
            
            // Небольшая задержка перед анимацией появления
            setTimeout(() => {
                newActiveSlide.classList.add('active');
                newActiveSlide.style.opacity = '1';
                newActiveSlide.style.visibility = 'visible';
                
                // Анимация элементов внутри слайда
                animateSlideElements(newActiveSlide);
                
                updateDots();
                isAnimating = false;
                
                console.log(`✅ Слайд ${currentSlide + 1} показан`);
            }, 50);
        }, 300);
    }
    
    // Анимация элементов внутри слайда
    function animateSlideElements(slide) {
        const elements = slide.querySelectorAll('.slide-title, .slide-description, .slide-features li, .slide-actions');
        
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 100 + (index * 100));
        });
    }
    
    // Обновление точек пагинации
    function updateDots() {
        dots.forEach((dot, index) => {
            if (index === currentSlide) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
    
    // Следующий слайд
    function nextSlide() {
        console.log('▶️ Следующий слайд');
        showSlide(currentSlide + 1);
    }
    
    // Предыдущий слайд
    function prevSlide() {
        console.log('◀️ Предыдущий слайд');
        showSlide(currentSlide - 1);
    }
    
    // Инициализация событий
    function initEvents() {
        // Кнопки вперед/назад
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                prevSlide();
            });
            
            // Анимация при наведении
            prevBtn.addEventListener('mouseenter', () => {
                prevBtn.style.transform = 'translateX(-5px)';
            });
            
            prevBtn.addEventListener('mouseleave', () => {
                prevBtn.style.transform = 'translateX(0)';
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                nextSlide();
            });
            
            // Анимация при наведении
            nextBtn.addEventListener('mouseenter', () => {
                nextBtn.style.transform = 'translateX(5px)';
            });
            
            nextBtn.addEventListener('mouseleave', () => {
                nextBtn.style.transform = 'translateX(0)';
            });
        }
        
        // Точки пагинации
        dots.forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🔘 Нажата точка ${index}`);
                showSlide(index);
            });
            
            // Анимация при наведении
            dot.addEventListener('mouseenter', () => {
                if (!dot.classList.contains('active')) {
                    dot.style.transform = 'scale(1.2)';
                }
            });
            
            dot.addEventListener('mouseleave', () => {
                if (!dot.classList.contains('active')) {
                    dot.style.transform = 'scale(1)';
                }
            });
        });
        
        // Клавиатура (только когда слайдер в фокусе)
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevSlide();
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextSlide();
            }
        });
        
        // Свайпы для мобильных
        if ('ontouchstart' in window) {
            const sliderContainer = document.querySelector('.slider-container');
            if (!sliderContainer) return;
            
            let touchStartX = 0;
            let touchEndX = 0;
            
            sliderContainer.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
            }, { passive: true });
            
            sliderContainer.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].clientX;
                handleSwipe();
            }, { passive: true });
            
            function handleSwipe() {
                const swipeThreshold = 50;
                const diff = touchStartX - touchEndX;
                
                if (Math.abs(diff) > swipeThreshold) {
                    if (diff > 0) {
                        nextSlide(); // Свайп влево
                    } else {
                        prevSlide(); // Свайп вправо
                    }
                }
            }
        }
    }
    
    // Инициализация всех слайдов
    function initSlides() {
        slides.forEach((slide, index) => {
            if (index === 0) {
                // Первый слайд активен
                slide.classList.add('active');
                slide.style.opacity = '1';
                slide.style.visibility = 'visible';
                slide.style.display = 'block';
            } else {
                // Остальные скрыты
                slide.classList.remove('active');
                slide.style.opacity = '0';
                slide.style.visibility = 'hidden';
                slide.style.display = 'none';
            }
        });
    }
    
    // Инициализация
    function init() {
        console.log('🚀 Инициализация слайдера...');
        
        // Инициализируем слайды
        initSlides();
        
        // Обновляем точки
        updateDots();
        
        // Инициализируем события
        initEvents();
        
        // Анимируем первый слайд
        setTimeout(() => {
            animateSlideElements(slides[0]);
        }, 500);
        
        console.log('✅ Слайдер инициализирован');
    }
    
    // Запуск
    init();
    
    // API для использования из консоли
    window.slider = {
        next: nextSlide,
        prev: prevSlide,
        goTo: (index) => {
            if (index >= 0 && index < slideCount) {
                showSlide(index);
            }
        },
        current: () => currentSlide,
        count: () => slideCount
    };
});