document.addEventListener("DOMContentLoaded", () => {
    // ========== AUTHENTICATION & INITIALIZATION ==========
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const API_URL = "https://quiz-system-new.onrender.com/api";

    if (!token || !user || user.role !== "student") {
        alert("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "index.html";
        return;
    }

    // ========== DOM ELEMENTS ==========
    const sidebar = document.getElementById("sidebar");
    const sidebarCollapse = document.getElementById("sidebarCollapse");
    const mainContent = document.querySelector(".main-content");
    const menuItems = document.querySelectorAll(".menu-item");
    const dashboardContents = document.querySelectorAll(".dashboard-content");

    // ========== INITIALIZATION FUNCTIONS ==========
    function init() {
        updateTime();
        setInterval(updateTime, 1000);
        setProfile();
        setupSidebar();
        setupMenuNavigation();
        setupEventListeners();
        initializeCalendar();
        loadDashboardStats();
        initializeHeaderDropdowns();
    }

    function setProfile() {
        if (user) {
            // Set the profile picture
            const profilePicUrl = user.profilePicture
                ? user.profilePicture.startsWith("http")
                    ? user.profilePicture
                    : `${API_URL}${user.profilePicture}`
                : "img/user.jpg"; // Default profile picture
    
            document.querySelectorAll(".user-image").forEach((img) => {
                img.src = profilePicUrl;
            });
    
            // Set the user name
            const fullName = `${user.firstName || "Student"} ${user.lastName || ""}`.trim();
            document.querySelectorAll(".user-name").forEach((span) => {
                span.textContent = fullName;
            });
    
            // Update the dropdown header name
            const headerUserName = document.getElementById("header-user-name");
            if (headerUserName) {
                headerUserName.textContent = fullName;
            }
        }
    }

    function updateTime() {
        const date = new Date();
        const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
        const timeOptions = { hour: "numeric", minute: "numeric", second: "numeric", hour12: true };

        document.querySelectorAll('[id$="current-date"], #current-date').forEach((el) => {
            el.textContent = date.toLocaleDateString("en-US", options);
        });

        document.querySelectorAll('[id$="current-time"], #current-time').forEach((el) => {
            el.textContent = date.toLocaleTimeString("en-US", timeOptions);
        });
    }

    // ========== SIDEBAR MANAGEMENT ==========
    function setupSidebar() {
        if (sidebarCollapse && sidebar) {
            sidebarCollapse.addEventListener("click", () => {
                sidebar.classList.toggle("collapsed");
                localStorage.setItem("sidebarState", sidebar.classList.contains("collapsed") ? "collapsed" : "expanded");
            });

            const savedState = localStorage.getItem("sidebarState");
            if (savedState === "collapsed") {
                sidebar.classList.add("collapsed");
            }
        }

        const sidebarCollapseBtn = document.getElementById("sidebar-collapse");
        if (sidebarCollapseBtn) {
            sidebarCollapseBtn.addEventListener("click", () => {
                sidebar.classList.toggle("active");
            });
        }

        window.addEventListener("resize", () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove("collapsed");
            } else {
                const savedState = localStorage.getItem("sidebarState");
                if (savedState === "collapsed") {
                    sidebar.classList.add("collapsed");
                } else {
                    sidebar.classList.remove("collapsed");
                }
            }
        });
    }

    // ========== MENU NAVIGATION ==========
    function setupMenuNavigation() {
        menuItems.forEach((item) => {
            item.addEventListener("click", () => {
                menuItems.forEach((menu) => menu.classList.remove("active"));
                item.classList.add("active");

                const target = item.getAttribute("data-target");
                dashboardContents.forEach((content) => (content.style.display = "none"));

                const targetContent = document.querySelector(target);
                if (targetContent) {
                    targetContent.style.display = "block";

                    switch (target) {
                        case "#dashboard":
                            loadDashboardStats();
                            break;
                        case "#quizzes":
                            loadQuizzes();
                            break;
                        case "#gradebook":
                            loadGradebook();
                            break;
                        case "#profile":
                            loadProfile();
                            break;
                        case "#messages":
                            loadMessages();
                            break;
                    }
                }

                if (window.innerWidth <= 768) {
                    sidebar.classList.remove("active");
                }

                localStorage.setItem("activeMenu", target);
            });
        });

        const savedActiveMenu = localStorage.getItem("activeMenu");
        if (savedActiveMenu) {
            const activeMenuItem = document.querySelector(`.menu-item[data-target="${savedActiveMenu}"]`);
            if (activeMenuItem) {
                activeMenuItem.click();
            } else {
                document.querySelector("#dashboard").style.display = "block";
                loadDashboardStats();
            }
        } else {
            document.querySelector("#dashboard").style.display = "block";
            loadDashboardStats();
        }
    }

    // ========== EVENT LISTENERS ==========
    function setupEventListeners() {
        const logoutBtn = document.querySelector('[data-target="#logout"]');
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                localStorage.removeItem("activeMenu");
                window.location.href = "index.html";
            });
        }
     // Pagination handlers
     setupPaginationHandlers()

     // Search input handlers
     setupSearchHandlers()

    }


     // ========== HEADER DROPDOWN ==========    // Load Messages Dropdown
     function loadMessagesDropdown() {
        fetch(`${API_URL}/students/messages`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                const messagesDropdownContent = document.getElementById("messages-dropdown-content");
                const messageCount = document.getElementById("message-count");
    
                messagesDropdownContent.innerHTML = ""; // Clear existing content
    
                if (data.success && data.messages.length > 0) {
                    messageCount.textContent = data.messages.length; // Update message count badge
                    data.messages.slice(0, 5).forEach((message) => {
                        const messageItem = document.createElement("div");
                        messageItem.className = "messages-item";
                        messageItem.innerHTML = `
                            <div class="message-sender">${message.senderName}</div>
                            <div class="message-preview">${message.body.substring(0, 50)}...</div>
                            <div class="message-time">${new Date(message.createdAt).toLocaleString()}</div>
                        `;
                        messagesDropdownContent.appendChild(messageItem);
                    });
                } else {
                    messageCount.textContent = "0"; // No messages
                    messagesDropdownContent.innerHTML = '<div class="text-center text-muted py-3">No new messages</div>';
                }
            })
            .catch((error) => {
                console.error("Error loading messages:", error);
            });
    }
    
    // Load Notifications Dropdown
    function loadNotificationsDropdown() {
        fetch(`${API_URL}/students/notifications`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                const notificationsDropdownContent = document.getElementById("notifications-dropdown-content");
                const notificationCount = document.getElementById("notification-count");
    
                notificationsDropdownContent.innerHTML = ""; // Clear existing content
    
                if (data.success && data.notifications.length > 0) {
                    notificationCount.textContent = data.notifications.length; // Update notification count badge
                    data.notifications.slice(0, 5).forEach((notification) => {
                        const notificationItem = document.createElement("div");
                        notificationItem.className = "notification-item";
                        notificationItem.innerHTML = `
                            <div class="notification-title">${notification.title}</div>
                            <div class="notification-preview">${notification.message.substring(0, 50)}...</div>
                            <div class="notification-time">${new Date(notification.createdAt).toLocaleString()}</div>
                        `;
                        notificationsDropdownContent.appendChild(notificationItem);
                    });
                } else {
                    notificationCount.textContent = "0"; // No notifications
                    notificationsDropdownContent.innerHTML = '<div class="text-center text-muted py-3">No new notifications</div>';
                }
            })
            .catch((error) => {
                console.error("Error loading notifications:", error);
            });
    }
    
    // Logout Functionality
    function setupLogoutButton() {
        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
                sessionStorage.removeItem("activeMenu");
                window.location.href = "index.html"; // Redirect to login page
            });
        }
    }
    
    // Initialize Header Dropdowns
    function initializeHeaderDropdowns() {
        loadMessagesDropdown();
        loadNotificationsDropdown();
        setupLogoutButton();
    
        // Optionally, refresh messages and notifications periodically
        setInterval(loadMessagesDropdown, 60000); // Refresh messages every 60 seconds
        setInterval(loadNotificationsDropdown, 60000); // Refresh notifications every 60 seconds
    }


    // ========== PAGINATION HANDLERS ==========
    function setupPaginationHandlers() {
        // Pagination buttons for quizzes
        setupPaginationForSection("quizzes", loadQuizzes)

        // Pagination buttons for gradebook
        setupPaginationForSection("gradebook", loadGradebook)
    }

    function setupPaginationForSection(section, loadFunction) {
        const prevBtn = document.getElementById(`${section}-prev-page-btn`);
        const nextBtn = document.getElementById(`${section}-next-page-btn`);
        const pageNum = document.getElementById(`${section}-page-num`);
    
        if (prevBtn && nextBtn && pageNum) {
            prevBtn.addEventListener("click", () => {
                const currentPage = parseInt(pageNum.textContent, 10);
                if (currentPage > 1) {
                    loadFunction(currentPage - 1); // Load the previous page
                }
            });
    
            nextBtn.addEventListener("click", () => {
                const currentPage = parseInt(pageNum.textContent, 10);
                const totalPages = parseInt(nextBtn.dataset.totalPages, 10); // Store total pages in a data attribute
                if (currentPage < totalPages) {
                    loadFunction(currentPage + 1); // Load the next page
                }
            });
        }
    }

    function updatePagination(section, pagination) {
        const prevBtn = document.getElementById(`${section}-prev-page-btn`);
        const nextBtn = document.getElementById(`${section}-next-page-btn`);
        const pageNum = document.getElementById(`${section}-page-num`);
    
        if (prevBtn && nextBtn && pageNum) {
            const { page: currentPage, totalPages } = pagination;
    
            // Update the page number
            pageNum.textContent = currentPage;
    
            // Enable/disable the Previous button
            prevBtn.disabled = currentPage === 1;
    
            // Enable/disable the Next button
            nextBtn.disabled = currentPage === totalPages;
    
            // Store total pages in a data attribute for the Next button
            nextBtn.dataset.totalPages = totalPages;
        }
    }

    // ========== SEARCH HANDLERS ==========
    function setupSearchHandlers() {
        const searchQuizzesInput = document.getElementById("search-quizzes")
        if (searchQuizzesInput) {
          searchQuizzesInput.addEventListener("input", (event) => {
            const searchTerm = event.target.value.trim()
            loadQuizzes(1, searchTerm)
          })
        }

    }





    // ========== DATA LOADING FUNCTIONS ==========
    function loadDashboardStats() {
        fetch(`${API_URL}/students/dashboard`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    document.getElementById("available-quizzes-count").textContent = data.availableQuizzes || 0;
                    document.getElementById("completed-quizzes-count").textContent = data.completedQuizzes || 0;
                    document.getElementById("average-score").textContent = `${data.averageScore || 0}%`;
                    document.getElementById("next-quiz").textContent = data.nextQuiz || "None";
                } else {
                    console.error("Failed to load dashboard stats:", data.error);
                }
            })
            .catch((error) => {
                console.error("Error loading dashboard stats:", error);
            });
    }

// ========== QUIZZES ==========
function loadQuizzes(page = 1, search = "") {
    const quizzesTableBody = document.getElementById("quizzes-table-body");
    if (!quizzesTableBody) return;

    // Show loading state
    quizzesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    fetch(`${API_URL}/students/quizzes?page=${page}&search=${search}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
        .then((response) => response.json())
        .then((data) => {
            quizzesTableBody.innerHTML = ""; // Clear loading state

            if (data.success) {
                if (data.quizzes.length === 0) {
                    quizzesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No quizzes available</td></tr>';
                    return;
                }

                data.quizzes.forEach((quiz, index) => {
                    const attemptsLeft = quiz.maxAttempts
                        ? `${quiz.attempts}/${quiz.maxAttempts}`
                        : "Unlimited";

                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${quiz.title}</td>
                        <td>${quiz.totalQuestions}</td>
                        <td>${quiz.duration} mins</td>
                        <td>${attemptsLeft}</td>
                        <td>
                            <button class="btn btn-primary btn-sm start-quiz-btn" data-id="${quiz._id}" ${
                                quiz.maxAttempts && quiz.attempts >= quiz.maxAttempts
                                    ? "disabled"
                                    : ""
                            }>Start</button>
                        </td>
                    `;
                    quizzesTableBody.appendChild(row);
                });

                // Update pagination
                updatePagination("quizzes", data.pagination);

                 // Add event listeners to "Start" buttons
                 document.querySelectorAll(".start-quiz-btn").forEach((button) => {
                    button.addEventListener("click", (e) => {
                        const quizId = e.target.getAttribute("data-id");
                        if (quizId) {
                            // Redirect to the take-quiz page with the quiz ID
                            window.location.href = `take-quiz.html?id=${quizId}`;
                        }
                    });
                });
                
            } else {
                quizzesTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load quizzes</td></tr>';
                console.error("Failed to load quizzes:", data.error);
            }
        })
        .catch((error) => {
            quizzesTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load quizzes</td></tr>';
            console.error("Error loading quizzes:", error);
        });
}

    function loadGradebook() {
        const gradebookTableBody = document.getElementById("gradebook-table-body");
        const cummulatedScoreElement = document.getElementById("cummulated-score");
        const gradeElement = document.getElementById("grade");
    
        if (!gradebookTableBody || !cummulatedScoreElement || !gradeElement) return;
    
        // Show loading state
        gradebookTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    
        fetch(`${API_URL}/students/gradebook`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                gradebookTableBody.innerHTML = ""; // Clear loading state
    
                if (data.success) {
                    if (data.gradebook.length === 0) {
                        gradebookTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No grades available</td></tr>';
                        cummulatedScoreElement.textContent = "0%";
                        gradeElement.textContent = "N/A";
                        return;
                    }
    
                    let totalPercentage = 0;
                    let totalEntries = data.gradebook.length;
    
                    data.gradebook.forEach((entry, index) => {
                        const row = document.createElement("tr");
                        row.innerHTML = `
                            <td>${index + 1}</td>
                            <td>${entry.quizTitle}</td>
                            <td>${entry.highestScore}/${entry.totalPossible}</td>
                            <td>${entry.percentage}%</td>
                            <td>${entry.grade}</td>
                            <td>${entry.passed ? "Passed" : "Failed"}</td>
                        `;
                        gradebookTableBody.appendChild(row);
    
                        // Accumulate percentage for cumulative score calculation
                        totalPercentage += entry.percentage;
                    });
    
                    // Calculate cumulative score
                    const cummulatedScore = (totalPercentage / totalEntries).toFixed(2);
                    cummulatedScoreElement.textContent = `${cummulatedScore}%`;
    
                    // Determine grade based on cumulative score
                    let grade = "F";
                    if (cummulatedScore >= 90) grade = "A";
                    else if (cummulatedScore >= 80) grade = "B";
                    else if (cummulatedScore >= 70) grade = "C";
    
                    gradeElement.textContent = grade;
                } else {
                    gradebookTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load gradebook</td></tr>';
                    cummulatedScoreElement.textContent = "0%";
                    gradeElement.textContent = "N/A";
                    console.error("Failed to load gradebook:", data.error);
                }
            })
            .catch((error) => {
                gradebookTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load gradebook</td></tr>';
                cummulatedScoreElement.textContent = "0%";
                gradeElement.textContent = "N/A";
                console.error("Error loading gradebook:", error);
            });
    }

    function loadProfile() {
        document.getElementById("profile-name").textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById("profile-email").textContent = `Email: ${user.email}`;
        document.getElementById("profile-phone").textContent = `Phone: ${user.phone || "N/A"}`;
    }

    function loadMessages() {
        fetch(`${API_URL}/students/messages`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    const messagesList = document.querySelector(".messages-list");
                    messagesList.innerHTML = "";

                    if (data.messages.length === 0) {
                        messagesList.innerHTML = "<p>No messages yet.</p>";
                    } else {
                        data.messages.forEach((message) => {
                            const messageItem = document.createElement("div");
                            messageItem.className = "message-item";
                            messageItem.innerHTML = `
                                <h5>${message.subject}</h5>
                                <p>${message.body}</p>
                                <small>From: ${message.senderName}</small>
                            `;
                            messagesList.appendChild(messageItem);
                        });
                    }
                } else {
                    console.error("Failed to load messages:", data.error);
                }
            })
            .catch((error) => {
                console.error("Error loading messages:", error);
            });
    }

    // ========== CALENDAR ==========
    function initializeCalendar() {
        const calendarEl = document.getElementById("calendar");
        if (calendarEl && window.FullCalendar) {
            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: "dayGridMonth",
                headerToolbar: {
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                },
                height: 300,
            });
            calendar.render();
        }
    }

    // Initialize the dashboard
    init();
});