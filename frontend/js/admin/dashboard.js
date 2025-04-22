// Dashboard Module
document.addEventListener("DOMContentLoaded", function() {
    // Initialize dashboard when DOM is loaded
    if (document.getElementById('dashboard')) {
        initDashboard();
    }
});

function initDashboard() {
    // Constants
    const API_URL = "http://localhost:5000/api";
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    // Check authentication
    if (!token || !user || user.role !== "admin") {
        window.location.href = "index.html";
        return;
    }

    // Initialize components
    initDateTimeUpdater();
    loadDashboardStats();
    initCalendar();
    loadRecentActivities();
    setupQuickActions();

    // Set up auto-refresh every 5 minutes
    setInterval(loadDashboardStats, 300000);
}

// 1. Date and Time Updater
function initDateTimeUpdater() {
    function updateDateTime() {
        const now = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', dateOptions);
        document.getElementById('current-time').textContent = now.toLocaleTimeString('en-US', timeOptions);
    }

    // Update immediately and every second
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// 2. Dashboard Statistics Loader
function loadDashboardStats() {
    // Show loading state
    document.querySelectorAll('.stat-value').forEach(el => el.textContent = '...');

    // Fetch all stats in parallel
    Promise.all([
        fetchData('/admin/stats/students'),
        fetchData('/admin/stats/approvals'),
        fetchData('/admin/stats/quizzes'),
        fetchData('/admin/stats/submissions')
    ])
    .then(([students, approvals, quizzes, submissions]) => {
        document.getElementById('students-count').textContent = students.count;
        document.getElementById('pending-approvals-count').textContent = approvals.count;
        document.getElementById('quizzes-count').textContent = quizzes.count;
        document.getElementById('quiz-submissions-count').textContent = submissions.count;
    })
    .catch(error => {
        console.error("Failed to load dashboard stats:", error);
        showToast("Failed to load dashboard statistics", "danger");
    });
}

// 3. Calendar Initialization
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || !window.FullCalendar) return;

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        height: 300,
        events: `${API_URL}/calendar/events`,
        eventClick: function(info) {
            showEventModal(info.event);
        }
    });

    calendar.render();

    // Add event handlers for calendar buttons
    document.querySelector('.calendar-card .action-btn.green').addEventListener('click', () => {
        showAddEventModal(calendar);
    });

    document.querySelector('.calendar-card .action-btn.red').addEventListener('click', () => {
        calendarEl.style.display = calendarEl.style.display === 'none' ? 'block' : 'none';
    });
}

// 4. Recent Activities Loader
function loadRecentActivities() {
    const container = document.getElementById('activities-list');
    container.innerHTML = '<div class="activity-item">Loading activities...</div>';

    fetchData('/admin/activities')
        .then(activities => {
            if (!activities || activities.length === 0) {
                container.innerHTML = '<div class="activity-item">No recent activities</div>';
                return;
            }

            container.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-indicator ${getActivityColor(activity.type)}"></div>
                    <div class="activity-details">
                        <div class="activity-time">${formatTimeAgo(activity.timestamp)}</div>
                        <div class="activity-text">${activity.message}</div>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error("Failed to load activities:", error);
            container.innerHTML = '<div class="activity-item">Failed to load activities</div>';
        });
}

// 5. Quick Actions Setup
function setupQuickActions() {
    document.querySelectorAll('.quick-actions-card .stat-card[data-target]').forEach(card => {
        card.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            document.querySelector(`.menu-item[data-target="${target}"]`).click();
        });
    });
}

// Helper Functions
function fetchData(endpoint) {
    return fetch(`${API_URL}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem("token")}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error(response.statusText);
        return response.json();
    });
}

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

function formatTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }

    return 'Just now';
}

function getActivityColor(type) {
    const colors = {
        'approval': 'green',
        'quiz': 'blue',
        'submission': 'purple',
        'system': 'cyan',
        'warning': 'orange',
        'error': 'red'
    };
    return colors[type] || 'purple';
}

// Calendar Modals (would be in separate modal.js file)
function showEventModal(event) {
    // Implementation for showing event details
}

function showAddEventModal(calendar) {
    // Implementation for adding new events
}