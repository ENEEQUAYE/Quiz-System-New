//frontend/js/admin/dashboard.js
const API_URL = "http://localhost:5000/api";
const REFRESH_INTERVAL = 300000; // 5 minutes

// Dashboard Module
document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('dashboard')) {
        initDashboard();
    }
});

function initDashboard() {
    // Check authentication and role
    if (!checkAdminAuth()) {
        window.location.href = "index.html";
        return;
    }

    // Initialize components with error handling
    try {
        initDateTimeUpdater();
        loadDashboardStats();
        initCalendar();
        loadRecentActivities();
        setupQuickActions();
        setupAutoRefresh();
        
        // Add event listeners for manual refresh
        document.getElementById('refresh-stats').addEventListener('click', loadDashboardStats);
        document.getElementById('refresh-activities').addEventListener('click', loadRecentActivities);
    } catch (error) {
        console.error("Dashboard initialization failed:", error);
        showToast("Failed to initialize dashboard", "danger");
    }
}

// 1. Authentication Check
function checkAdminAuth() {
    try {
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        return !!(token && user && user.role === "admin");
    } catch (error) {
        console.error("Auth check failed:", error);
        return false;
    }
}

// 2. Date and Time Updater (with timezone support)
function initDateTimeUpdater() {
    function updateDateTime() {
        try {
            const now = new Date();
            const options = {
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true,
                timeZoneName: 'short'
            };
            
            document.getElementById('current-date').textContent = 
                now.toLocaleDateString('en-US', options);
        } catch (error) {
            console.error("DateTime update failed:", error);
        }
    }

    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// 3. Dashboard Statistics Loader (with caching)
let statsCache = null;
let lastStatsFetch = 0;

function loadDashboardStats() {
    // Show loading state
    toggleLoadingState('.stat-card', true);
    
    // Use cache if recent
    if (statsCache && Date.now() - lastStatsFetch < 60000) {
        updateStatsUI(statsCache);
        return;
    }

    Promise.all([
        fetchWithTimeout(`${API_URL}/admin/stats/students`, {}, 5000),
        fetchWithTimeout(`${API_URL}/users/pending`, {}, 5000),
        fetchWithTimeout(`${API_URL}/admin/stats/quizzes`, {}, 5000),
        fetchWithTimeout(`${API_URL}/admin/stats/submissions`, {}, 5000)
    ])
    .then(([students, approvals, quizzes, submissions]) => {
        const stats = { students, approvals, quizzes, submissions };
        statsCache = stats;
        lastStatsFetch = Date.now();
        updateStatsUI(stats);
    })
    .catch(error => {
        console.error("Stats load error:", error);
        showToast("Failed to load statistics. Using cached data if available.", "warning");
        if (statsCache) updateStatsUI(statsCache);
    })
    .finally(() => {
        toggleLoadingState('.stat-card', false);
    });
}

function updateStatsUI(stats) {
    try {
        document.getElementById('students-count').textContent = stats.students.count.toLocaleString();
        document.getElementById('pending-approvals-count').textContent = stats.approvals.count.toLocaleString();
        document.getElementById('quizzes-count').textContent = stats.quizzes.count.toLocaleString();
        document.getElementById('quiz-submissions-count').textContent = stats.submissions.count.toLocaleString();
        
        // Update trends if available
        if (stats.students.trend) {
            updateTrendIndicator('students-trend', stats.students.trend);
        }
        // Repeat for other stats...
    } catch (error) {
        console.error("UI update failed:", error);
    }
}

// 4. Enhanced Calendar with Error Handling
function initCalendar() {
    try {
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
            events: {
                url: `${API_URL}/calendar/events`,
                failure: () => {
                    showToast("Failed to load calendar events", "warning");
                }
            },
            eventClick: showEventModal
        });

        calendar.render();
        setupCalendarControls(calendar);
    } catch (error) {
        console.error("Calendar init failed:", error);
        showToast("Calendar initialization failed", "danger");
    }
}

// 5. Recent Activities with Pagination
let currentActivityPage = 1;
const ACTIVITIES_PER_PAGE = 5;

function loadRecentActivities(page = 1) {
    const container = document.getElementById('activities-list');
    toggleLoadingState('#activities-container', true);
    
    fetchData(`/admin/activities?page=${page}&limit=${ACTIVITIES_PER_PAGE}`)
        .then(data => {
            currentActivityPage = page;
            renderActivities(data.activities);
            updateActivityPagination(data.total);
        })
        .catch(error => {
            console.error("Activities load failed:", error);
            container.innerHTML = '<div class="activity-item error">Failed to load activities</div>';
        })
        .finally(() => {
            toggleLoadingState('#activities-container', false);
        });
}

function renderActivities(activities) {
    const container = document.getElementById('activities-list');
    
    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="activity-item">No recent activities</div>';
        return;
    }

    container.innerHTML = activities.map(activity => `
        <div class="activity-item" data-id="${activity.id}">
            <div class="activity-icon ${getActivityIcon(activity.type)}">
                <i class="fas ${getActivityFaIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-message">${activity.message}</div>
                <div class="activity-meta">
                    <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
                    ${activity.user ? `<span class="activity-user">by ${activity.user.name}</span>` : ''}
                </div>
            </div>
            ${activity.actions ? `<div class="activity-actions">${renderActivityActions(activity.actions)}</div>` : ''}
        </div>
    `).join('');

    // Add event listeners for action buttons
    document.querySelectorAll('.activity-action-btn').forEach(btn => {
        btn.addEventListener('click', handleActivityAction);
    });
}

// 6. Quick Actions with Confirmation
function setupQuickActions() {
    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', function(e) {
            e.preventDefault();
            const requiresConfirm = this.dataset.confirm === "true";
            
            if (requiresConfirm && !confirm(this.dataset.confirmText || "Are you sure?")) {
                return;
            }

            const actionUrl = this.dataset.action;
            executeQuickAction(actionUrl, this);
        });
    });
}

async function executeQuickAction(url, element) {
    const originalText = element.innerHTML;
    try {
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const result = await fetchData(url, { method: 'POST' });
        showToast(result.message || "Action completed successfully", "success");
        loadDashboardStats(); // Refresh stats
    } catch (error) {
        showToast(error.message || "Action failed", "danger");
    } finally {
        element.innerHTML = originalText;
    }
}

// Enhanced Helper Functions
async function fetchData(endpoint, options = {}) {
    try {
        const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("token")}`,
                'Content-Type': 'application/json'
            },
            ...options
        }, 10000);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || response.statusText);
        }

        return await response.json();
    } catch (error) {
        console.error(`API request failed for ${endpoint}:`, error);
        throw error;
    }
}

function fetchWithTimeout(url, options = {}, timeout = 5000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ]);
}

function toggleLoadingState(selector, isLoading) {
    document.querySelectorAll(selector).forEach(el => {
        el.classList.toggle('loading', isLoading);
    });
}

function setupAutoRefresh() {
    setInterval(() => {
        loadDashboardStats();
        loadRecentActivities(currentActivityPage);
    }, REFRESH_INTERVAL);
}

// Additional UI Helpers
function updateTrendIndicator(elementId, trend) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.className = 'trend-indicator';
    if (trend > 0) {
        element.classList.add('up');
        element.innerHTML = `<i class="fas fa-arrow-up"></i> ${Math.abs(trend)}%`;
    } else if (trend < 0) {
        element.classList.add('down');
        element.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(trend)}%`;
    } else {
        element.classList.add('neutral');
        element.innerHTML = `<i class="fas fa-equals"></i> 0%`;
    }
}

function getActivityFaIcon(type) {
    const icons = {
        'approval': 'fa-user-check',
        'quiz': 'fa-question-circle',
        'submission': 'fa-file-upload',
        'system': 'fa-cog',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-times-circle'
    };
    return icons[type] || 'fa-info-circle';
}

// Initialize on load
initDashboard();