// =============================
// СИСТЕМА ЗАЩИЩЕННОГО ДОСТУПА
// =============================

class AccessSystem {
    constructor() {
        this.selectedPerson = null;
        this.attempts = 0;
        this.maxAttempts = 5;
        this.lockoutTime = 60; // секунды
        this.isLocked = false;
        this.lockoutTimer = null;
        
        // Пароли для каждого человека (ЗАМЕНИТЕ НА СВОИ!)
        this.passwords = {
            nikita: "4558mail", // Пароль для Никиты
            evgeny: "kasper7681M",  // Пароль для Евгения
            olga: "123123" // Пароль для Ольги
        };
        
        // Куда переходить при успешном вводе пароля (ЗАМЕНИТЕ НА СВОИ URL!)
        this.redirectUrls = {
            nikita: "/character/users-ttfbbcharacter-00000-1.html",
            evgeny: "/character/users-ttfbbcharacter-00001-2.html", 
            olga: "/character/users-ttfbbcharacter-00002-3.html"
        };
        
        // Подсказки для паролей (появляются после 3 ошибок)
        this.hints = {
            nikita: "Подсказка: пароль связан с атмосферой",
            evgeny: "Подсказка: пароль связан с технологиями",
            olga: "Подсказка: пароль связан с творчеством",
            guest: "Подсказка: пароль связан с секретностью"
        };
        
        this.init();
    }
    
    init() {
        this.loadAttempts();
        this.initEventListeners();
        this.updateUI();
        console.log('🔐 Система доступа инициализирована');
    }
    
    // Загрузка данных о попытках из LocalStorage
    loadAttempts() {
        try {
            const savedData = localStorage.getItem('access_system_data');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.attempts = data.attempts || 0;
                this.isLocked = data.isLocked || false;
                
                // Если был локтаут, проверяем время
                if (this.isLocked && data.lockoutUntil) {
                    const lockoutUntil = new Date(data.lockoutUntil);
                    const now = new Date();
                    
                    if (now > lockoutUntil) {
                        this.isLocked = false;
                        this.attempts = 0;
                        this.saveData();
                    } else {
                        // Запускаем таймер разблокировки
                        const remainingSeconds = Math.floor((lockoutUntil - now) / 1000);
                        this.startLockoutTimer(remainingSeconds);
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.resetData();
        }
    }
    
    // Сохранение данных в LocalStorage
    saveData() {
        const data = {
            attempts: this.attempts,
            isLocked: this.isLocked,
            lockoutUntil: this.isLocked ? 
                new Date(Date.now() + (this.lockoutTime * 1000)).toISOString() : null
        };
        
        try {
            localStorage.setItem('access_system_data', JSON.stringify(data));
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
        }
    }
    
    // Сброс данных
    resetData() {
        this.attempts = 0;
        this.isLocked = false;
        this.saveData();
    }
    
    // Инициализация обработчиков событий
    initEventListeners() {
        // Кнопки доступа на карточках
        document.querySelectorAll('.btn-access').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const personId = btn.dataset.person;
                this.selectPerson(personId);
            });
        });
        
        // Клики по карточкам (альтернативный способ выбора)
        document.querySelectorAll('.person-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-access')) {
                    const personId = card.dataset.personId;
                    this.selectPerson(personId);
                }
            });
        });
        
        // Кнопка закрытия панели пароля
        document.getElementById('panel-close').addEventListener('click', () => {
            this.hidePasswordPanel();
        });
        
        // Кнопка отмены ввода пароля
        document.getElementById('cancel-password').addEventListener('click', () => {
            this.hidePasswordPanel();
        });
        
        // Кнопка отправки пароля
        document.getElementById('submit-password').addEventListener('click', () => {
            this.checkPassword();
        });
        
        // Enter для отправки пароля
        document.getElementById('password-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkPassword();
            }
        });
        
        // Кнопка показа/скрытия пароля
        document.getElementById('toggle-password').addEventListener('click', () => {
            this.togglePasswordVisibility();
        });
        
        // Кнопки в модальном окне успеха
        document.getElementById('go-now').addEventListener('click', () => {
            this.redirectNow();
        });
        
        document.getElementById('stay-here').addEventListener('click', () => {
            this.hideSuccessModal();
        });
        
        // Кнопка обновления страницы при блокировке
        document.getElementById('refresh-page').addEventListener('click', () => {
            location.reload();
        });
        
        // Ссылки в футере (демо-функционал)
        document.getElementById('view-log').addEventListener('click', (e) => {
            e.preventDefault();
            this.showNotification('Функция просмотра логов в разработке', 'info');
        });
        
        document.getElementById('reset-attempts').addEventListener('click', (e) => {
            e.preventDefault();
            this.resetAttempts();
        });
        
        document.getElementById('change-passwords').addEventListener('click', (e) => {
            e.preventDefault();
            this.showChangePasswordsModal();
        });
    }
    
    // Выбор человека
    selectPerson(personId) {
        // Проверяем блокировку
        if (this.isLocked) {
            this.showLockoutModal();
            return;
        }
        
        // Проверяем количество попыток
        if (this.attempts >= this.maxAttempts) {
            this.lockAccess();
            return;
        }
        
        this.selectedPerson = personId;
        
        // Обновляем UI выбранной карточки
        document.querySelectorAll('.person-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const selectedCard = document.querySelector(`[data-person-id="${personId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        // Показываем панель пароля
        this.showPasswordPanel(personId);
        
        // Обновляем счетчик попыток
        this.updateAttemptsCounter();
    }
    
    // Показать панель ввода пароля
    showPasswordPanel(personId) {
        const panel = document.getElementById('password-panel');
        const personInfo = document.getElementById('selected-person-info');
        
        // Наполняем информацию о человеке
        const personName = this.getPersonName(personId);
        const personRole = this.getPersonRole(personId);
        
        personInfo.innerHTML = `
            <h4>${personName}</h4>
            <p>${personRole}</p>
            <p class="person-instruction">Введите пароль для доступа к материалам</p>
        `;
        
        // Сбрасываем поле ввода и сообщения
        document.getElementById('password-input').value = '';
        document.getElementById('status-message').textContent = '';
        document.getElementById('password-hint').classList.remove('show');
        
        // Показываем панель
        panel.classList.add('active');
        
        // Фокусируемся на поле ввода
        setTimeout(() => {
            document.getElementById('password-input').focus();
        }, 300);
        
        // Прокручиваем к панели
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Скрыть панель ввода пароля
    hidePasswordPanel() {
        const panel = document.getElementById('password-panel');
        panel.classList.remove('active');
        
        // Сбрасываем выделение карточки
        document.querySelectorAll('.person-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        this.selectedPerson = null;
    }
    
    // Проверка пароля
    checkPassword() {
        if (!this.selectedPerson) return;
        
        const input = document.getElementById('password-input');
        const password = input.value.trim();
        const correctPassword = this.passwords[this.selectedPerson];
        const statusMessage = document.getElementById('status-message');
        
        // Проверяем блокировку
        if (this.isLocked) {
            this.showLockoutModal();
            return;
        }
        
        // Проверяем количество попыток
        if (this.attempts >= this.maxAttempts) {
            this.lockAccess();
            return;
        }
        
        // Проверяем пароль
        if (password === correctPassword) {
            // Пароль верный!
            this.attempts = 0; // Сбрасываем попытки
            this.saveData();
            
            // Показываем успешное сообщение
            statusMessage.textContent = '✅ Пароль верный! Доступ разрешен.';
            statusMessage.className = 'status-message success';
            
            // Запускаем перенаправление
            setTimeout(() => {
                this.showSuccessModal();
            }, 1000);
            
        } else {
            // Пароль неверный
            this.attempts++;
            this.saveData();
            
            // Показываем сообщение об ошибке
            statusMessage.textContent = `❌ Неверный пароль. Попытка ${this.attempts} из ${this.maxAttempts}`;
            statusMessage.className = 'status-message error';
            
            // Очищаем поле ввода
            input.value = '';
            input.focus();
            
            // Показываем подсказку после 3 ошибок
            if (this.attempts >= 3) {
                const hint = this.hints[this.selectedPerson];
                const hintElement = document.getElementById('password-hint');
                hintElement.querySelector('span').textContent = hint;
                hintElement.classList.add('show');
            }
            
            // Проверяем блокировку
            if (this.attempts >= this.maxAttempts) {
                setTimeout(() => {
                    this.lockAccess();
                }, 1000);
            }
            
            // Обновляем UI
            this.updateAttemptsCounter();
        }
    }
    
    // Блокировка доступа
    lockAccess() {
        this.isLocked = true;
        this.saveData();
        this.showLockoutModal();
    }
    
    // Показать модальное окно блокировки
    showLockoutModal() {
        const modal = document.getElementById('lockout-modal');
        modal.classList.add('active');
        
        // Запускаем таймер разблокировки
        this.startLockoutTimer(this.lockoutTime);
    }
    
    // Запуск таймера разблокировки
    startLockoutTimer(seconds) {
        clearInterval(this.lockoutTimer);
        
        const timerElement = document.getElementById('lockout-timer');
        timerElement.textContent = seconds;
        
        this.lockoutTimer = setInterval(() => {
            seconds--;
            timerElement.textContent = seconds;
            
            if (seconds <= 0) {
                clearInterval(this.lockoutTimer);
                this.isLocked = false;
                this.attempts = 0;
                this.saveData();
                
                const modal = document.getElementById('lockout-modal');
                modal.classList.remove('active');
                
                this.showNotification('Доступ разблокирован! Попробуйте снова.', 'success');
                this.updateUI();
            }
        }, 1000);
    }
    
    // Показать модальное окно успеха
    showSuccessModal() {
        const modal = document.getElementById('success-modal');
        const personName = this.getPersonName(this.selectedPerson);
        
        // Обновляем информацию в модалке
        document.getElementById('access-person-name').textContent = personName;
        document.getElementById('access-level').textContent = 'Полный доступ';
        
        modal.classList.add('active');
        
        // Запускаем таймер перенаправления
        let seconds = 3;
        const timerElement = document.getElementById('redirect-timer');
        timerElement.textContent = seconds;
        
        const redirectTimer = setInterval(() => {
            seconds--;
            timerElement.textContent = seconds;
            
            if (seconds <= 0) {
                clearInterval(redirectTimer);
                this.redirectNow();
            }
        }, 1000);
        
        // Сохраняем таймер для очистки
        this.redirectTimer = redirectTimer;
    }
    
    // Скрыть модальное окно успеха
    hideSuccessModal() {
        const modal = document.getElementById('success-modal');
        modal.classList.remove('active');
        
        if (this.redirectTimer) {
            clearInterval(this.redirectTimer);
        }
        
        this.hidePasswordPanel();
    }
    
    // Немедленное перенаправление
    redirectNow() {
        if (!this.selectedPerson) return;
        
        const redirectUrl = this.redirectUrls[this.selectedPerson];
        if (redirectUrl) {
            // Можно добавить дополнительную логику перед перенаправлением
            console.log(`Перенаправление на: ${redirectUrl}`);
            
            // Имитация загрузки
            this.showNotification('Перенаправление...', 'info');
            
            // Перенаправление
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 500);
        } else {
            this.showNotification('Ошибка: URL перенаправления не настроен', 'error');
        }
    }
    
    // Переключение видимости пароля
    togglePasswordVisibility() {
        const input = document.getElementById('password-input');
        const toggleBtn = document.getElementById('toggle-password');
        
        if (input.type === 'password') {
            input.type = 'text';
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            input.type = 'password';
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    }
    
    // Сброс попыток (админская функция)
    resetAttempts() {
        this.attempts = 0;
        this.isLocked = false;
        this.saveData();
        this.updateUI();
        this.showNotification('Попытки сброшены!', 'success');
    }
    
    // Модальное окно изменения паролей (демо)
    showChangePasswordsModal() {
        let passwordsText = 'Текущие пароли:\n\n';
        Object.entries(this.passwords).forEach(([person, password]) => {
            const name = this.getPersonName(person);
            passwordsText += `${name}: ${password}\n`;
        });
        
        passwordsText += '\nЧтобы изменить пароли, отредактируйте файл access.js';
        
        alert(passwordsText);
    }
    
    // Обновление UI
    updateUI() {
        // Обновляем счетчик попыток
        this.updateAttemptsCounter();
        
        // Обновляем оставшиеся попытки
        const remaining = this.maxAttempts - this.attempts;
        document.getElementById('remaining-attempts').textContent = remaining;
        
        // Обновляем общий счетчик
        document.getElementById('attempts-count').textContent = this.attempts;
        
        // Обновляем статус безопасности
        const statusElement = document.getElementById('security-status');
        if (this.isLocked) {
            statusElement.textContent = 'Заблокировано';
            statusElement.parentElement.style.background = 'rgba(239, 68, 68, 0.1)';
            statusElement.parentElement.style.color = '#fca5a5';
        } else if (this.attempts >= 3) {
            statusElement.textContent = 'Повышенная опасность';
            statusElement.parentElement.style.background = 'rgba(245, 158, 11, 0.1)';
            statusElement.parentElement.style.color = '#fbbf24';
        } else {
            statusElement.textContent = 'Защищено';
            statusElement.parentElement.style.background = 'rgba(16, 185, 129, 0.1)';
            statusElement.parentElement.style.color = '#34d399';
        }
    }
    
    // Обновление счетчика попыток
    updateAttemptsCounter() {
        const remaining = this.maxAttempts - this.attempts;
        const counter = document.getElementById('attempts-count');
        counter.textContent = this.attempts;
        
        // Меняем цвет при малом количестве попыток
        if (remaining <= 2) {
            counter.style.color = '#ef4444';
        } else if (remaining <= 3) {
            counter.style.color = '#f59e0b';
        } else {
            counter.style.color = 'white';
        }
    }
    
    // Вспомогательные методы для получения информации о человеке
    getPersonName(personId) {
        const names = {
            nikita: 'Никита',
            evgeny: 'Евгений',
            olga: 'Ольга',
            guest: 'Секретный гость'
        };
        return names[personId] || 'Неизвестный';
    }
    
    getPersonRole(personId) {
        const roles = {
            nikita: 'Идейный вдохновитель',
            evgeny: 'Технический гений',
            olga: 'Творческий директор',
            guest: 'Специальный доступ'
        };
        return roles[personId] || 'Персонаж';
    }
    
    // Показать уведомление
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = 'notification';
        
        if (type === 'error') {
            notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else {
            notification.style.background = 'var(--gradient)';
        }
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Инициализация системы при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.accessSystem = new AccessSystem();
    
    // Функции для разработчика (доступны из консоли)
    window.debugAccessSystem = {
        showPasswords: () => {
            console.log('🔓 Текущие пароли:');
            Object.entries(window.accessSystem.passwords).forEach(([person, pass]) => {
                console.log(`${person}: "${pass}"`);
            });
        },
        resetSystem: () => {
            window.accessSystem.resetData();
            location.reload();
        },
        unlockAll: () => {
            window.accessSystem.isLocked = false;
            window.accessSystem.attempts = 0;
            window.accessSystem.saveData();
            window.accessSystem.updateUI();
            console.log('✅ Система разблокирована');
        },
        setPassword: (person, newPassword) => {
            if (window.accessSystem.passwords[person]) {
                window.accessSystem.passwords[person] = newPassword;
                console.log(`✅ Пароль для ${person} изменен на: "${newPassword}"`);
            } else {
                console.log(`❌ Персонаж "${person}" не найден`);
            }
        }
    };
    
    console.log('🔧 Доступные команды отладки:');
    console.log('  - debugAccessSystem.showPasswords()');
    console.log('  - debugAccessSystem.resetSystem()');
    console.log('  - debugAccessSystem.unlockAll()');
    console.log('  - debugAccessSystem.setPassword(person, newPassword)');
});