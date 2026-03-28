// ============================================
// ГЛОБАЛЬНЫЙ ЧАТ С ЛИЧНЫМИ СООБЩЕНИЯМИ
// ============================================

let currentUser = null;
let activeChat = 'global'; // 'global' или имя пользователя
let messages = {
    global: []
};
let onlineUsers = new Set();
let typingTimeout = null;

// DOM элементы
const usernameInput = document.getElementById('username');
const setUsernameBtn = document.getElementById('setUsername');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messages');
const chatTitle = document.getElementById('chatTitle');
const chatStatus = document.getElementById('chatStatus');
const onlineUsersDiv = document.getElementById('onlineUsers');
const onlineCountSpan = document.getElementById('onlineCount');
const chatsListDiv = document.getElementById('chatsList');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status span:last-child');
const typingIndicator = document.getElementById('typingIndicator');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPanel = document.getElementById('emojiPanel');
const clearChatBtn = document.getElementById('clearChat');

// ============================================
// ЗАГРУЗКА И СОХРАНЕНИЕ ДАННЫХ
// ============================================

function loadData() {
    // Загрузка пользователя
    const savedUser = localStorage.getItem('chat_user');
    if (savedUser) {
        currentUser = savedUser;
        usernameInput.value = currentUser;
        usernameInput.disabled = true;
        setUsernameBtn.disabled = true;
        setUsernameBtn.textContent = '✓ В чате';
        updateStatus(true);
        enableMessaging(true);
    }
    
    // Загрузка сообщений
    const savedMessages = localStorage.getItem('chat_messages');
    if (savedMessages) {
        messages = JSON.parse(savedMessages);
        if (!messages.global) messages.global = [];
    }
    
    // Загрузка чатов
    loadChatsList();
}

function saveMessages() {
    localStorage.setItem('chat_messages', JSON.stringify(messages));
}

function saveUser() {
    if (currentUser) {
        localStorage.setItem('chat_user', currentUser);
    }
}

// ============================================
// УПРАВЛЕНИЕ ЧАТАМИ
// ============================================

function switchChat(chatId) {
    activeChat = chatId;
    
    // Обновляем заголовок
    if (chatId === 'global') {
        chatTitle.textContent = '🌍 Общий чат';
        chatStatus.textContent = 'Все видят сообщения';
        clearChatBtn.style.display = 'none';
    } else {
        chatTitle.textContent = `💬 Личный чат с ${chatId}`;
        chatStatus.textContent = 'Только вы видите эти сообщения';
        clearChatBtn.style.display = 'block';
    }
    
    // Создаем чат если его нет
    if (!messages[chatId]) {
        messages[chatId] = [];
        saveMessages();
    }
    
    // Отображаем сообщения
    displayMessages();
    
    // Обновляем активный чат в списке
    updateChatsList();
}

function displayMessages() {
    messagesContainer.innerHTML = '';
    
    const chatMessages = messages[activeChat] || [];
    
    if (chatMessages.length === 0) {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        if (activeChat === 'global') {
            welcomeDiv.innerHTML = '<p>🌍 Общий чат</p><p>Напишите первое сообщение!</p>';
        } else {
            welcomeDiv.innerHTML = `<p>💬 Личный чат с ${activeChat}</p><p>Напишите первое сообщение!</p>`;
        }
        messagesContainer.appendChild(welcomeDiv);
        return;
    }
    
    chatMessages.forEach(msg => {
        displayMessage(msg);
    });
    
    scrollToBottom();
}

function displayMessage(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    
    if (msg.sender === currentUser) {
        wrapper.classList.add('my-message');
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    wrapper.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <span class="username">${escapeHtml(msg.sender)}</span>
                <span class="timestamp">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(msg.text)}</div>
        </div>
    `;
    
    messageDiv.appendChild(wrapper);
    messagesContainer.appendChild(messageDiv);
}

function addMessage(text, isPrivate = false, recipient = null) {
    if (!currentUser) {
        alert('Сначала войдите в чат!');
        return false;
    }
    
    const message = {
        sender: currentUser,
        text: text,
        timestamp: Date.now(),
        isPrivate: isPrivate
    };
    
    if (isPrivate && recipient) {
        // Личное сообщение
        const chatId = recipient;
        if (!messages[chatId]) {
            messages[chatId] = [];
        }
        messages[chatId].push(message);
        
        // Добавляем в чат отправителя тоже
        const senderChatId = currentUser;
        if (!messages[senderChatId]) {
            messages[senderChatId] = [];
        }
        messages[senderChatId].push({...message, isPrivate: true});
        
        // Добавляем системное сообщение о личном чате
        addSystemMessage(`💌 Личное сообщение для ${recipient}`, false);
    } else {
        // Общее сообщение
        messages.global.push(message);
    }
    
    saveMessages();
    
    if (activeChat === (isPrivate ? recipient : 'global')) {
        displayMessages();
    }
    
    // Обновляем список чатов
    updateChatsList();
    
    return true;
}

function addSystemMessage(text, save = true) {
    const systemDiv = document.createElement('div');
    systemDiv.className = 'system-message';
    systemDiv.textContent = text;
    messagesContainer.appendChild(systemDiv);
    scrollToBottom();
    
    if (save) {
        const systemMsg = {
            sender: 'system',
            text: text,
            timestamp: Date.now(),
            isSystem: true
        };
        
        if (!messages[activeChat]) {
            messages[activeChat] = [];
        }
        messages[activeChat].push(systemMsg);
        saveMessages();
    }
}

function clearCurrentChat() {
    if (confirm(`Очистить все сообщения в чате "${activeChat === 'global' ? 'Общий чат' : activeChat}"?`)) {
        messages[activeChat] = [];
        saveMessages();
        displayMessages();
        addSystemMessage('🗑️ Чат очищен', false);
    }
}

// ============================================
// ОНЛАЙН ПОЛЬЗОВАТЕЛИ
// ============================================

function updateOnlineUsers() {
    // Получаем активных пользователей из localStorage
    const active = JSON.parse(localStorage.getItem('active_users') || '[]');
    const now = Date.now();
    
    // Обновляем текущего пользователя
    if (currentUser) {
        const userIndex = active.findIndex(u => u.name === currentUser);
        if (userIndex !== -1) {
            active[userIndex].lastSeen = now;
        } else {
            active.push({ name: currentUser, lastSeen: now });
        }
    }
    
    // Фильтруем тех кто был активен в последние 30 секунд
    const online = active.filter(u => now - u.lastSeen < 30000);
    localStorage.setItem('active_users', JSON.stringify(online));
    
    onlineUsers.clear();
    online.forEach(u => onlineUsers.add(u.name));
    
    // Обновляем отображение
    onlineCountSpan.textContent = onlineUsers.size;
    
    if (onlineUsersDiv) {
        onlineUsersDiv.innerHTML = '';
        const otherUsers = Array.from(onlineUsers).filter(u => u !== currentUser);
        
        if (otherUsers.length === 0) {
            onlineUsersDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 10px;">Никого нет</div>';
        } else {
            otherUsers.forEach(user => {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-item online';
                userDiv.innerHTML = `
                    <div class="user-avatar">${getAvatar(user)}</div>
                    <div class="user-name">${escapeHtml(user)}</div>
                    <div class="user-status">🟢 Онлайн</div>
                `;
                userDiv.onclick = () => {
                    switchChat(user);
                    if (window.innerWidth <= 768) {
                        document.getElementById('sidebar').classList.remove('open');
                    }
                };
                onlineUsersDiv.appendChild(userDiv);
            });
        }
    }
    
    setTimeout(updateOnlineUsers, 5000);
}

function getAvatar(name) {
    const firstChar = name.charAt(0).toUpperCase();
    return firstChar;
}

// ============================================
// СПИСОК ЧАТОВ
// ============================================

function loadChatsList() {
    const chatKeys = Object.keys(messages).filter(key => key !== 'global');
    const privateChats = chatKeys.filter(key => key !== currentUser);
    
    if (chatsListDiv) {
        chatsListDiv.innerHTML = '';
        
        // Общий чат
        const globalChat = document.createElement('div');
        globalChat.className = `chat-item ${activeChat === 'global' ? 'active' : ''}`;
        globalChat.innerHTML = `
            <div class="user-avatar">🌍</div>
            <div class="user-name">Общий чат</div>
            <div class="user-status">${messages.global?.length || 0} сообщений</div>
        `;
        globalChat.onclick = () => switchChat('global');
        chatsListDiv.appendChild(globalChat);
        
        // Личные чаты
        privateChats.forEach(chat => {
            const chatDiv = document.createElement('div');
            chatDiv.className = `chat-item ${activeChat === chat ? 'active' : ''}`;
            const lastMsg = messages[chat]?.[messages[chat].length - 1];
            chatDiv.innerHTML = `
                <div class="user-avatar">${getAvatar(chat)}</div>
                <div class="user-name">${escapeHtml(chat)}</div>
                <div class="user-status">${onlineUsers.has(chat) ? '🟢' : '⚫'} ${messages[chat]?.length || 0}</div>
            `;
            chatDiv.onclick = () => switchChat(chat);
            chatsListDiv.appendChild(chatDiv);
        });
    }
}

function updateChatsList() {
    loadChatsList();
}

// ============================================
// ОТПРАВКА СООБЩЕНИЙ
// ============================================

function sendMessage() {
    if (!currentUser) {
        alert('Сначала войдите в чат!');
        return;
    }
    
    const text = messageInput.value.trim();
    if (text === '') return;
    
    const isPrivate = activeChat !== 'global';
    const recipient = isPrivate ? activeChat : null;
    
    addMessage(text, isPrivate, recipient);
    messageInput.value = '';
    messageInput.focus();
    typingIndicator.textContent = '';
}

function onTyping() {
    if (!currentUser) return;
    
    typingIndicator.textContent = `${currentUser} печатает...`;
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        typingIndicator.textContent = '';
    }, 1000);
}

// ============================================
// ВХОД В ЧАТ
// ============================================

function setUsername() {
    const newUsername = usernameInput.value.trim();
    
    if (newUsername === '') {
        alert('Введите имя пользователя!');
        return;
    }
    
    if (newUsername.length < 2) {
        alert('Имя должно быть минимум 2 символа');
        return;
    }
    
    currentUser = newUsername;
    usernameInput.disabled = true;
    setUsernameBtn.disabled = true;
    setUsernameBtn.textContent = '✓ В чате';
    
    updateStatus(true);
    enableMessaging(true);
    saveUser();
    
    addSystemMessage(`👋 ${currentUser} присоединился к чату!`, false);
    
    // Создаем личный чат для себя
    if (!messages[currentUser]) {
        messages[currentUser] = [];
    }
    
    updateChatsList();
    switchChat('global');
}

function updateStatus(online) {
    if (online) {
        statusDot.classList.add('online');
        statusText.textContent = 'В сети';
    } else {
        statusDot.classList.remove('online');
        statusText.textContent = 'Офлайн';
    }
}

function enableMessaging(enabled) {
    if (enabled && currentUser) {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.placeholder = 'Введите сообщение...';
    } else {
        messageInput.disabled = true;
        sendBtn.disabled = true;
        messageInput.placeholder = 'Сначала войдите...';
    }
}

function scrollToBottom() {
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// ЭМОДЗИ
// ============================================

emojiBtn.addEventListener('click', () => {
    emojiPanel.classList.toggle('active');
});

document.querySelectorAll('.emoji-grid span, .emoji-grid').forEach(el => {
    if (el.classList && el.classList.contains('emoji-grid')) {
        el.addEventListener('click', (e) => {
            if (e.target.tagName === 'SPAN') {
                messageInput.value += e.target.textContent;
                messageInput.focus();
                emojiPanel.classList.remove('active');
            }
        });
    }
});

// Простая обработка эмодзи
const emojiGrid = document.querySelector('.emoji-grid');
if (emojiGrid) {
    const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '😍', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '😝', '🎉', '👍', '❤️', '🔥', '💪', '🌍', '📱', '💬'];
    emojiGrid.innerHTML = emojis.map(e => `<span>${e}</span>`).join('');
    
    emojiGrid.querySelectorAll('span').forEach(emoji => {
        emoji.addEventListener('click', () => {
            messageInput.value += emoji.textContent;
            messageInput.focus();
            emojiPanel.classList.remove('active');
        });
    });
}

document.addEventListener('click', (e) => {
    if (!emojiBtn.contains(e.target) && !emojiPanel.contains(e.target)) {
        emojiPanel.classList.remove('active');
    }
});

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================

setUsernameBtn.addEventListener('click', setUsername);
sendBtn.addEventListener('click', sendMessage);
clearChatBtn.addEventListener('click', clearCurrentChat);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        sendMessage();
    }
    onTyping();
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') setUsername();
});

// Синхронизация между вкладками
window.addEventListener('storage', (e) => {
    if (e.key === 'chat_messages') {
        const saved = localStorage.getItem('chat_messages');
        if (saved) {
            messages = JSON.parse(saved);
            if (activeChat && messages[activeChat]) {
                displayMessages();
            }
            updateChatsList();
        }
    }
    
    if (e.key === 'active_users') {
        updateOnlineUsers();
    }
});

// ============================================
// ЗАПУСК
// ============================================

loadData();
updateOnlineUsers();

console.log('🚀 Global Chat с личными сообщениями запущен!');
console.log('💬 Пишите в общий чат или выбирайте пользователя для личного сообщения');
