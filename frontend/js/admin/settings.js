// Settings Module
document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('settings')) {
        initSettingsModule();
    }
});

function initSettingsModule() {
    // Constants
    const API_URL = "http://localhost:5000/api";
    const token = localStorage.getItem("token");
    
    // Initialize
    loadSettings();
    setupEventListeners();

    // Load Settings
    function loadSettings() {
        fetch(`${API_URL}/settings`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch settings');
            return response.json();
        })
        .then(data => {
            renderSettings(data);
        })
        .catch(error => {
            console.error('Error loading settings:', error);
            showToast('Failed to load settings', 'danger');
        });
    }

    // Render Settings Form
    function renderSettings(settings) {
        const container = document.getElementById('settings-container');
        container.innerHTML = `
            <div class="settings-tabs">
                <button class="tab-btn active" data-tab="notifications">Notifications</button>
                <button class="tab-btn" data-tab="display">Display</button>
                <button class="tab-btn" data-tab="security">Security</button>
            </div>
            
            <div class="tab-content active" id="notifications-tab">
                <h4>Notification Settings</h4>
                <form id="notification-settings-form">
                    <div class="mb-3 form-check">
                        <input type="checkbox" class="form-check-input" id="email-notifications" 
                            ${settings.notificationSettings.email ? 'checked' : ''}>
                        <label class="form-check-label" for="email-notifications">Email Notifications</label>
                    </div>
                    <div class="mb-3 form-check">
                        <input type="checkbox" class="form-check-input" id="push-notifications" 
                            ${settings.notificationSettings.push ? 'checked' : ''}>
                        <label class="form-check-label" for="push-notifications">Push Notifications</label>
                    </div>
                    <button type="submit" class="submit-btn">Save Notification Settings</button>
                </form>
            </div>
            
            <div class="tab-content" id="display-tab">
                <h4>Display Settings</h4>
                <form id="display-settings-form">
                    <div class="mb-3">
                        <label for="theme-select" class="form-label">Theme</label>
                        <select class="form-select" id="theme-select">
                            <option value="light" ${settings.displaySettings.theme === 'light' ? 'selected' : ''}>Light</option>
                            <option value="dark" ${settings.displaySettings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                            <option value="system" ${settings.displaySettings.theme === 'system' ? 'selected' : ''}>System Default</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="font-size" class="form-label">Font Size</label>
                        <input type="range" class="form-range" id="font-size" min="12" max="18" 
                            value="${settings.displaySettings.fontSize || 14}">
                    </div>
                    <button type="submit" class="submit-btn">Save Display Settings</button>
                </form>
            </div>
            
            <div class="tab-content" id="security-tab">
                <h4>Security Settings</h4>
                <form id="security-settings-form">
                    <div class="mb-3">
                        <label for="current-password" class="form-label">Current Password</label>
                        <input type="password" class="form-control" id="current-password" required>
                    </div>
                    <div class="mb-3">
                        <label for="new-password" class="form-label">New Password</label>
                        <input type="password" class="form-control" id="new-password" required minlength="8">
                    </div>
                    <div class="mb-3">
                        <label for="confirm-password" class="form-label">Confirm New Password</label>
                        <input type="password" class="form-control" id="confirm-password" required minlength="8">
                    </div>
                    <button type="submit" class="submit-btn">Change Password</button>
                </form>
            </div>
        `;

        // Initialize tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                this.classList.add('active');
                document.getElementById(`${this.dataset.tab}-tab`).classList.add('active');
            });
        });
    }

    // Event Listeners
    function setupEventListeners() {
        // Notification settings form
        document.getElementById('notification-settings-form')?.addEventListener('submit', function(e) {
            e.preventDefault();
            updateSettings({
                notificationSettings: {
                    email: document.getElementById('email-notifications').checked,
                    push: document.getElementById('push-notifications').checked
                }
            });
        });

        // Display settings form
        document.getElementById('display-settings-form')?.addEventListener('submit', function(e) {
            e.preventDefault();
            updateSettings({
                displaySettings: {
                    theme: document.getElementById('theme-select').value,
                    fontSize: document.getElementById('font-size').value
                }
            });
        });

        // Security settings form
        document.getElementById('security-settings-form')?.addEventListener('submit', function(e) {
            e.preventDefault();
            changePassword();
        });
    }

    // Update Settings
    function updateSettings(settings) {
        fetch(`${API_URL}/settings`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to update settings');
            showToast('Settings updated successfully', 'success');
        })
        .catch(error => {
            console.error('Error updating settings:', error);
            showToast(error.message || 'Failed to update settings', 'danger');
        });
    }

    // Change Password
    function changePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'warning');
            return;
        }

        fetch(`${API_URL}/settings/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentPassword, newPassword })
        })
        .then(response => {
            if (!response.ok) throw new Error(response.statusText);
            return response.json();
        })
        .then(data => {
            showToast(data.message || 'Password changed successfully', 'success');
            document.getElementById('security-settings-form').reset();
        })
        .catch(error => {
            console.error('Error changing password:', error);
            showToast(error.message || 'Failed to change password', 'danger');
        });
    }

    // Helper Functions
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast show align-items-center text-white bg-${type}`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}