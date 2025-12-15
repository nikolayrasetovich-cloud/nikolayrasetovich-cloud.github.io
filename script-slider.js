// УПРОЩЕННЫЙ СЛАЙДЕР БЕЗ АВТОПЛЕЯ
document.addEventListener('DOMContentLoaded', function() {
    // Элементы слайдера
    const slides = document.querySelectorAll('.slider-slide');
    const dots = document.querySelectorAll('.slide-dot');
    const prevBtn = document.querySelector('.arrow-prev');
    const nextBtn = document.querySelector('.arrow-next');
    
    if (slides.length === 0) return;
    
    let currentSlide = 0;
    let isAnimating = false;
    
    // Функция показа слайда
    function showSlide(index) {
        if (isAnimating) return;
        
        isAnimating = true;
        
        // Скрыть текущий слайд
        slides[currentSlide].classList.remove('active');
        slides[currentSlide].style.opacity = '0';
        
        // Показать новый слайд
        currentSlide = (index + slides.length) % slides.length;
        
        setTimeout(() => {
            slides[currentSlide].classList.add('active');
            slides[currentSlide].style.opacity = '1';
            updateDots();
            isAnimating = false;
        }, 300);
    }
    
    // Обновление точек пагинации
    function updateDots() {
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }
    
    // Следующий слайд
    function nextSlide() {
        showSlide(currentSlide + 1);
    }
    
    // Предыдущий слайд
    function prevSlide() {
        showSlide(currentSlide - 1);
    }
    
    // Инициализация событий
    function initEvents() {
        // Кнопки вперед/назад
        if (prevBtn) {
            prevBtn.addEventListener('click', prevSlide);
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', nextSlide);
        }
        
        // Точки пагинации
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => showSlide(index));
        });
        
        // Клавиатура (опционально)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'ArrowRight') nextSlide();
        });
        
        // Свайпы для мобильных
        if ('ontouchstart' in window) {
            let startX = 0;
            const slider = document.querySelector('.slider-container');
            
            if (slider) {
                slider.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].clientX;
                });
                
                slider.addEventListener('touchend', (e) => {
                    const endX = e.changedTouches[0].clientX;
                    const diff = startX - endX;
                    
                    if (Math.abs(diff) > 50) {
                        if (diff > 0) {
                            nextSlide();
                        } else {
                            prevSlide();
                        }
                    }
                });
            }
        }
    }
    
    // Инициализация
    function init() {
        // Показать первый слайд
        slides[0].classList.add('active');
        slides[0].style.opacity = '1';
        updateDots();
        
        // Инициализировать события
        initEvents();
    }
    
    // Запуск
    init();
});