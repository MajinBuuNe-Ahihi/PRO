// Chat functionality
let isStreaming = false;
let currentSessionId = null;
let sessions = [];
let searchToolEnabled = false;

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const sessionList = document.getElementById('sessionList');
const currentSessionName = document.getElementById('currentSessionName');
const sessionPanel = document.getElementById('sessionPanel');
const searchResults = document.getElementById('searchResults');
const searchResultsList = document.getElementById('searchResultsList');
const searchToggleBtn = document.getElementById('searchToggleBtn');

// Auto-resize textarea
messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Send message on Enter (Shift+Enter for new line)
messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Send message function
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isStreaming) return;

    // Add user message to chat
    addMessage(message, 'user');

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Show typing indicator
    showTypingIndicator();

    // Disable input during streaming
    isStreaming = true;
    sendButton.disabled = true;
    messageInput.disabled = true;
    if (searchToggleBtn) searchToggleBtn.disabled = true;

    try {
        // Call API with streaming
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: getSessionId(),
                use_search: !!searchToolEnabled
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Remove typing indicator
        removeTypingIndicator();

        // Create assistant message container
        const assistantMessage = createAssistantMessage();

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantResponse = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value);
            assistantResponse += chunk;

            // Update assistant message content
            assistantMessage.querySelector('.message-content').innerHTML = formatMessage(assistantResponse);

            // Scroll to bottom
            scrollToBottom();
        }

        // --- LOGIC MỚI ĐƯỢC THÊM VÀO ĐÂY ---
        // Kiểm tra toàn bộ nội dung phản hồi để tạo nút PPT
        if (assistantResponse.includes("Vui lòng nhấn vào nút 'Tạo PPT' để tải xuống!")) {
            // Tạo nút mới
            const pptButton = document.createElement('button');
            pptButton.textContent = 'Tải PPT';
            // Sử dụng Tailwind CSS (thêm lớp mt-2 để tạo khoảng trống)
            pptButton.className = 'ppt-button';

            // Gắn sự kiện click để tải file
            pptButton.onclick = async () => {
                pptButton.textContent = 'Đang tạo...';
                pptButton.disabled = true;
                try {
                    const pptResponse = await fetch('/generate-ppt', {
                        method: 'POST'
                    });
                    if (pptResponse.ok) {
                        const blob = await pptResponse.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = 'bao_cao_doanh_thu.pptx';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        a.remove();
                    } else {
                        console.error('Lỗi khi tải file PPT');
                    }
                } catch (error) {
                    console.error('Lỗi mạng khi tải PPT:', error);
                } finally {
                    pptButton.textContent = 'Tải PPT';
                    pptButton.disabled = false;
                }
            };

            const messageContentDiv = assistantMessage.querySelector('.message-content');
            // Xóa phần text "Vui lòng nhấn..." và thêm nút
            const textToDisplay = assistantResponse.replace("Vui lòng nhấn vào nút 'Tạo PPT' để tải xuống!", '').trim();
            messageContentDiv.innerHTML = formatMessage(textToDisplay);
            messageContentDiv.appendChild(pptButton);

        } else if (assistantResponse.trim() && currentSessionId) {
            // Logic cũ để lưu tin nhắn vào phiên nếu không phải là yêu cầu PPT
            const session = sessions.find(s => s.id === currentSessionId);
            if (session) {
                session.messages.push({
                    content: assistantResponse,
                    type: 'assistant',
                    timestamp: new Date().toISOString()
                });
                saveSessions();
            }
        }
        // --- KẾT THÚC LOGIC MỚI ---

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessage('Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.', 'assistant');
    } finally {
        // Re-enable input
        isStreaming = false;
        sendButton.disabled = false;
        messageInput.disabled = false;
        if (searchToggleBtn) searchToggleBtn.disabled = false;
        messageInput.focus();
    }
}

// Add message to chat
function addMessage(content, type, saveToSession = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'user' ? 'B' : 'AI';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = formatMessage(content);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();

    // Save message to current session
    if (saveToSession && currentSessionId) {
        const session = sessions.find(s => s.id === currentSessionId);
        if (session) {
            session.messages.push({
                content: content,
                type: type,
                timestamp: new Date().toISOString()
            });

            // Update session preview with user message
            if (type === 'user') {
                updateSessionPreview(content);
            }

            saveSessions();
        }
    }
}

// Create assistant message (for streaming)
function createAssistantMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'AI';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = '';

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
}

// Show typing indicator
function showTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.id = 'typingIndicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'AI';

    const typingDiv = document.createElement('div');
    typingDiv.className = 'message-content typing-indicator';
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(typingDiv);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Format message content (convert URLs to links, preserve line breaks)
function formatMessage(content) {
    return content
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

// Scroll to bottom of chat
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Session Management Functions
function createNewSession() {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const session = {
        id: sessionId,
        name: 'Phiên mới',
        preview: 'Bắt đầu cuộc trò chuyện mới',
        createdAt: new Date().toISOString(),
        messages: [{
            content: `Xin chào! Tôi là trợ lý AI cho nhà hàng. Tôi có thể giúp bạn:
                <ul>
                    <li>Quản lý menu và đơn hàng</li>
                    <li>Phân tích doanh thu</li>
                    <li>Tư vấn về quản lý nhà hàng</li>
                    <li>Trả lời các câu hỏi khác</li>
                </ul>
                Bạn cần tôi giúp gì hôm nay?`,
            type: 'assistant',
            timestamp: new Date().toISOString()
        }]
    };

    sessions.unshift(session);
    currentSessionId = sessionId;

    // Show welcome message
    chatMessages.innerHTML = `
        <div class="message assistant">
            <div class="message-avatar">AI</div>
            <div class="message-content">
                Xin chào! Tôi là trợ lý AI cho nhà hàng. Tôi có thể giúp bạn:
                <ul>
                    <li>Quản lý menu và đơn hàng</li>
                    <li>Phân tích doanh thu</li>
                    <li>Tư vấn về quản lý nhà hàng</li>
                    <li>Trả lời các câu hỏi khác</li>
                </ul>
                Bạn cần tôi giúp gì hôm nay?
            </div>
        </div>
    `;

    updateSessionList();
    updateCurrentSessionName();
    saveSessions();
}

function loadSession(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    currentSessionId = sessionId;

    // Load messages for this session
    chatMessages.innerHTML = '';

    if (session.messages.length === 0) {
        // Show welcome message for empty sessions
        chatMessages.innerHTML = `
            <div class="message assistant">
                <div class="message-avatar">AI</div>
                <div class="message-content">
                    Xin chào! Tôi là trợ lý AI cho nhà hàng. Tôi có thể giúp bạn:
                    <ul>
                        <li>Quản lý menu và đơn hàng</li>
                        <li>Phân tích doanh thu</li>
                        <li>Tư vấn về quản lý nhà hàng</li>
                        <li>Trả lời các câu hỏi khác</li>
                    </ul>
                    Bạn cần tôi giúp gì hôm nay?
                </div>
            </div>
        `;
    } else {
        // Load existing messages
        session.messages.forEach(msg => {
            addMessage(msg.content, msg.type, false);
        });
    }

    updateSessionList();
    updateCurrentSessionName();
}

function deleteSession(sessionId) {
    sessions = sessions.filter(s => s.id !== sessionId);

    if (currentSessionId === sessionId) {
        if (sessions.length > 0) {
            loadSession(sessions[0].id);
        } else {
            createNewSession();
        }
    }

    updateSessionList();
    saveSessions();
}

function clearAllSessions() {
    if (confirm('Bạn có chắc muốn xóa tất cả phiên làm việc?')) {
        sessions = [];
        createNewSession();
        updateSessionList();
        saveSessions();
    }
}

function updateSessionList() {
    sessionList.innerHTML = '';

    sessions.forEach(session => {
        const sessionItem = document.createElement('div');
        sessionItem.className = `session-item ${session.id === currentSessionId ? 'active' : ''}`;
        sessionItem.onclick = () => loadSession(session.id);

        sessionItem.innerHTML = `
            <div class="session-item-content">
                <div class="session-item-title">${session.name}</div>
                <div class="session-item-preview">${session.preview}</div>
            </div>
            <div class="session-item-actions">
                <button class="session-action-btn" onclick="event.stopPropagation(); deleteSession('${session.id}')" title="Xóa phiên">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H8H16H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        `;

        sessionList.appendChild(sessionItem);
    });
}

function updateCurrentSessionName() {
    const session = sessions.find(s => s.id === currentSessionId);
    currentSessionName.textContent = session ? session.name : 'Phiên mới';
}

function updateSessionPreview(content) {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
        session.preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
        updateSessionList();
        saveSessions();
    }
}

function saveSessions() {
    localStorage.setItem('chatSessions', JSON.stringify(sessions));
    localStorage.setItem('currentSessionId', currentSessionId);
}

function loadSessions() {
    const savedSessions = localStorage.getItem('chatSessions');
    const savedCurrentSessionId = localStorage.getItem('currentSessionId');

    if (savedSessions) {
        sessions = JSON.parse(savedSessions);

        // Fix old sessions that don't have welcome message
        sessions.forEach(session => {
            if (session.messages.length === 0) {
                session.messages = [{
                    content: `Xin chào! Tôi là trợ lý AI cho nhà hàng. Tôi có thể giúp bạn:
                        <ul>
                            <li>Quản lý menu và đơn hàng</li>
                            <li>Phân tích doanh thu</li>
                            <li>Tư vấn về quản lý nhà hàng</li>
                            <li>Trả lời các câu hỏi khác</li>
                        </ul>
                        Bạn cần tôi giúp gì hôm nay?`,
                    type: 'assistant',
                    timestamp: session.createdAt || new Date().toISOString()
                }];
            }
        });
    }

    if (sessions.length === 0) {
        createNewSession();
    } else {
        currentSessionId = savedCurrentSessionId || sessions[0].id;
        loadSession(currentSessionId);
    }
}

function toggleSessionPanel() {
    sessionPanel.classList.toggle('open');
}

// Get current session ID
function getSessionId() {
    return currentSessionId;
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    loadSessions();
    messageInput.focus();
});

// =============
// Search client
// =============
async function performSearch() {
    const input = document.getElementById('searchInput');
    const q = (input && input.value ? input.value.trim() : '');
    if (!q) return;

    // show placeholder
    if (searchResults) {
        searchResults.style.display = 'block';
        searchResultsList.innerHTML = 'Đang tìm kiếm...';
    }

    try {
        const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, max_results: 8 })
        });
        if (!res.ok) {
            throw new Error('search_failed');
        }
        const data = await res.json();
        renderSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
        renderSearchResults([]);
    }
}

// Search using current prompt content
async function performSearchFromPrompt() {
    const q = messageInput && messageInput.value ? messageInput.value.trim() : '';
    if (!q) return;
    const si = document.getElementById('searchInput');
    if (si) si.value = q;
    await performSearch();
}

function renderSearchResults(items) {
    if (!searchResults) return;
    searchResults.style.display = 'block';
    if (!items || items.length === 0) {
        searchResultsList.textContent = 'Không có kết quả';
        return;
    }
    const html = items.map((it) => {
        const title = it.title || it.body || 'Kết quả';
        const href = it.href || it.url || '#';
        const snippet = it.body || it.description || '';
        return `
            <div class="search-item">
                <div class="search-title"><a href="${href}" target="_blank" rel="noopener">${escapeHtml(title)}</a></div>
                <div class="search-link">${escapeHtml(href)}</div>
                <div class="search-snippet">${escapeHtml(snippet)}</div>
            </div>
        `;
    }).join('');
    searchResultsList.innerHTML = html;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Toggle search tool button
function toggleSearchTool() {
    searchToolEnabled = !searchToolEnabled;
    const btn = document.getElementById('searchToggleBtn');
    if (btn) {
        btn.classList.toggle('active', searchToolEnabled);
    }
}
