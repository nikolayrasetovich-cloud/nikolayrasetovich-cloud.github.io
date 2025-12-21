document.addEventListener('DOMContentLoaded', function() {
    // Переключение вкладок
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab + '-tab';
            
            // Убираем активный класс у всех кнопок и контента
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке и контенту
            this.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // Инициализируем графики при переключении на вкладку статистики
            if (tabId === 'stats-tab') {
                initializeCharts();
            }
        });
    });
    
    // Кнопки выполнения заданий
    document.querySelectorAll('.task-card .btn-primary').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const taskCard = this.closest('.task-card');
            
            if (!taskCard.classList.contains('completed')) {
                // Показываем анимацию выполнения
                const xpElement = taskCard.querySelector('.task-xp');
                const xpValue = parseInt(xpElement.textContent.match(/\d+/)[0]);
                
                // Анимация увеличения прогресса
                const progressFill = taskCard.querySelector('.progress-fill');
                const progressText = taskCard.querySelector('.progress-text');
                const currentWidth = parseInt(progressFill.style.width) || 0;
                
                if (currentWidth < 100) {
                    const newWidth = Math.min(100, currentWidth + 25);
                    progressFill.style.width = `${newWidth}%`;
                    
                    // Обновляем текст прогресса
                    const match = progressText.textContent.match(/(\d+)\/(\d+)/);
                    if (match) {
                        const current = parseInt(match[1]);
                        const total = parseInt(match[2]);
                        const newCurrent = Math.min(total, current + 1);
                        progressText.textContent = `${newCurrent}/${total} выполнено`;
                        
                        // Если задание выполнено
                        if (newCurrent === total) {
                            taskCard.classList.add('completed');
                            const timeElement = taskCard.querySelector('.task-time');
                            timeElement.innerHTML = '<i class="fas fa-check-circle"></i> Задание выполнено';
                            timeElement.classList.add('completed');
                            this.innerHTML = '<i class="fas fa-gift"></i> Получить награду';
                            this.classList.remove('btn-primary');
                            this.classList.add('btn-success');
                        }
                    }
                    
                    // Показываем уведомление
                    showNotification(`+${xpValue} XP получено!`, 'success');
                }
            } else {
                // Если задание уже выполнено - получить награду
                this.innerHTML = '<i class="fas fa-check"></i> Награда получена';
                this.disabled = true;
                showNotification('Награда успешно получена!', 'success');
            }
        });
    });
    
    // Кнопки покупки наград
    document.querySelectorAll('.rewards-grid .btn-primary').forEach(btn => {
        btn.addEventListener('click', function() {
            const rewardCard = this.closest('.reward-card');
            const xpCost = parseInt(this.textContent);
            
            // Проверяем достаточно ли XP
            // В реальном приложении здесь будет запрос к серверу
            showNotification(`Покупка награды за ${xpCost} XP`, 'info');
            
            // В демо-версии просто меняем состояние
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-check"></i> Куплено';
                this.disabled = true;
                this.classList.remove('btn-primary');
                this.classList.add('btn-success');
                rewardCard.classList.add('obtained');
                showNotification('Награда успешно куплена!', 'success');
            }, 1000);
        });
    });
    
    // Инициализация графиков
    function initializeCharts() {
        // График активности
        const activityCtx = document.getElementById('activityChart');
        if (activityCtx) {
            const activityChart = new Chart(activityCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30'],
                    datasets: [{
                        label: 'Просмотры',
                        data: [12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45, 42, 50, 48, 55, 52, 58, 55, 60, 58, 65, 62, 68, 65, 70, 68, 75, 72, 78],
                        borderColor: '#8a4baf',
                        backgroundColor: 'rgba(138, 75, 175, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#f8fafc'
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: '#94a3b8'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: '#94a3b8'
                            }
                        }
                    }
                }
            });
        }
        
        // Круговая диаграмма распределения времени
        const timeCtx = document.getElementById('timeChart');
        if (timeCtx) {
            const timeChart = new Chart(timeCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Прямые эфиры', 'Видеоролики', 'Новости', 'Прочее'],
                    datasets: [{
                        data: [45, 30, 15, 10],
                        backgroundColor: [
                            '#8a4baf',
                            '#6d28d9',
                            '#9d6bc0',
                            '#7c3aed'
                        ],
                        borderWidth: 0,
                        hoverOffset: 15
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#f8fafc',
                                padding: 20,
                                font: {
                                    size: 12
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    
    // Инициализируем графики при загрузке страницы, если активна вкладка статистики
    if (document.getElementById('stats-tab').classList.contains('active')) {
        initializeCharts();
    }
    
    // Функция показа уведомлений
    function showNotification(message, type = 'info') {
        // Удаляем предыдущие уведомления
        const oldNotifications = document.querySelectorAll('.custom-notification');
        oldNotifications.forEach(n => n.remove());
        
        // Создаем новое уведомление
        const notification = document.createElement('div');
        notification.className = `custom-notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Стилизация уведомления
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slideIn 0.3s ease',
            background: type === 'success' ? 'var(--success)' : 'var(--accent)',
            color: 'white',
            fontWeight: '600'
        });
        
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Добавляем стили для анимаций уведомлений
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Обработчики для быстрых действий
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.querySelector('span').textContent;
            switch(action) {
                case 'Поделиться':
                    if (navigator.share) {
                        navigator.share({
                            title: 'Блог братьев',
                            text: 'Присоединяйся к сообществу братьев!',
                            url: window.location.origin
                        });
                    } else {
                        navigator.clipboard.writeText(window.location.origin);
                        showNotification('Ссылка скопирована в буфер обмена!', 'success');
                    }
                    break;
                case 'QR код':
                    // В демо-версии просто показываем сообщение
                    showNotification('QR код сгенерирован!', 'info');
                    break;
                case 'Настройки':
                    showNotification('Переход в настройки профиля', 'info');
                    break;
                case 'Подарки':
                    showNotification('Доступные подарки', 'info');
                    break;
            }
        });
    });
    
    // Имитация загрузки данных профиля
    function loadProfileData() {
        // В реальном приложении здесь будет запрос к серверу
        console.log('Загрузка данных профиля...');
    }
    
    loadProfileData();
    
    // Анимация появления элементов при скролле
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '50px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Наблюдаем за всеми карточками
    document.querySelectorAll('.task-card, .achievement-card, .stat-card-large, .reward-card').forEach(card => {
        observer.observe(card);
    });
});

