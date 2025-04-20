// Messages Module
document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('messages')) {
        initMessagesModule();
    }
});

function initMessagesModule() {
    // Constants
    const API_URL = "http://localhost:5000/api";
    const token = localStorage.getItem("token");
    let currentPage = 1;
    let totalPages = 1;

    // Initialize
    loadMessages();
    setupEventListeners();

    // Load Messages
    function loadMessages() {
        const container = document.getElementById('messages-list-container');
        if (!container) return;

        container.innerHTML = `
            <div class="message-list-loading">
                <i class="fas fa-spinner fa-spin"></i> Loading messages...
            </div>
        `;

        fetch(`${API_URL}/messages?page=${currentPage}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch messages');
            return response.json();
        })
        .then(data => {
            renderMessages(data.messages);
            updatePagination(data.pagination);
        })
        .catch(error => {
            console.error('Error loading messages:', error);
            container.innerHTML = `
                <div class="message-list-error">
                    <i class="fas fa-exclamation-circle"></i> Failed to load messages
                </div>
            `;
            showToast('Failed to load messages', 'danger');
        });
    }

    // Render Messages
    function renderMessages(messages) {
        const container = document.getElementById('messages-list-container');
        if (!container) return;

        if (!messages || messages.length === 0) {
            container.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-envelope-open"></i>
                    <p>No messages found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="message-list-header">
                <div class="message-list-actions">
                    <button class="btn btn-sm btn-outline-secondary" id="refresh-messages-btn">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            <div class="message-list" id="message-list"></div>
        `;

        const messageList = document.getElementById('message-list');
        messageList.innerHTML = messages.map(message => `
            <div class="message-item ${message.isRead ? '' : 'unread'}" data-id="${message._id}">
                <div class="message-sender">
                    ${message.sender.firstName} ${message.sender.lastName}
                </div>
                <div class="message-subject">
                    ${message.subject}
                    ${!message.isRead ? '<span class="badge bg-primary">New</span>' : ''}
                </div>
                <div class="message-preview">
                    ${message.body.substring(0, 100)}${message.body.length > 100 ? '...' : ''}
                </div>
                <div class="message-date">
                    ${formatDate(message.createdAt)}
                </div>
                <div class="message-actions">
                    <button class="btn btn-sm btn-outline-primary view-message" data-id="${message._id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-outline-secondary archive-message" data-id="${message._id}">
                        <i class="fas fa-archive"></i> Archive
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        document.querySelectorAll('.view-message').forEach(btn => {
            btn.addEventListener('click', handleViewMessage);
        });

        document.querySelectorAll('.archive-message').forEach(btn => {
            btn.addEventListener('click', handleArchiveMessage);
        });

        document.querySelectorAll('.message-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (!e.target.closest('.message-actions')) {
                    const messageId = this.getAttribute('data-id');
                    viewMessageDetails(messageId);
                }
            });
        });

        document.getElementById('refresh-messages-btn').addEventListener('click', loadMessages);
    }

    // Message Actions
    function handleViewMessage(e) {
        const messageId = e.currentTarget.getAttribute('data-id');
        viewMessageDetails(messageId);
    }

    function handleArchiveMessage(e) {
        const messageId = e.currentTarget.getAttribute('data-id');
        
        if (confirm('Are you sure you want to archive this message?')) {
            fetch(`${API_URL}/messages/${messageId}/archive`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to archive message');
                showToast('Message archived', 'success');
                loadMessages();
            })
            .catch(error => {
                console.error('Error archiving message:', error);
                showToast('Failed to archive message', 'danger');
            });
        }
    }

    function viewMessageDetails(messageId) {
        fetch(`${API_URL}/messages/${messageId}/read`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(() => {
            // Open message view modal
            showMessageModal(messageId);
        })
        .catch(error => {
            console.error('Error marking message as read:', error);
        });
    }

    // Pagination
    function updatePagination(pagination) {
        totalPages = pagination.totalPages;
        currentPage = pagination.currentPage;
        
        document.getElementById('page-num').textContent = currentPage;
        document.getElementById('prev-page-btn').disabled = currentPage <= 1;
        document.getElementById('next-page-btn').disabled = currentPage >= totalPages;
    }

    // Event Listeners
    function setupEventListeners() {
        // Pagination
        document.getElementById('prev-page-btn').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadMessages();
            }
        });

        document.getElementById('next-page-btn').addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadMessages();
            }
        });

        // Compose Message button
        document.getElementById('compose-message-btn')?.addEventListener('click', () => {
            showComposeModal();
        });
    }

    // Helper Functions
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    function showToast(message, type = 'info') {
        // Toast implementation
    }

    function showMessageModal(messageId) {
        // Message detail modal implementation
    }

    function showComposeModal() {
        // Compose message modal implementation
    }
}