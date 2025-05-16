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
        loadRecentActivities();
            // Initialize messaging
        setupMessageEventListeners();
        setupComposeModal();
        
        // Load messages if on messages page
        if (document.getElementById("messages").style.display !== "none") {
            loadMessages();
        }
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
        fetch(`${API_URL}/students/header-messages`, {
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

    function loadNotificationCount() {
        fetch(`${API_URL}/students/notifications/count`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(data => {
            const notificationCount = document.getElementById("notification-count");
            if (notificationCount) {
                notificationCount.textContent = data.success ? (data.count || "0") : "0";
            }
        })
        .catch(() => {
            const notificationCount = document.getElementById("notification-count");
            if (notificationCount) notificationCount.textContent = "0";
        });
    }
    
    // Load Notifications Dropdown
    function loadNotificationsDropdown() {
        fetch(`${API_URL}/students/notifications`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then((response) => response.json())
        .then((data) => {
            const notificationsDropdownContent = document.getElementById("notifications-dropdown-content");
            const notificationCount = document.getElementById("notification-count");
    
            notificationsDropdownContent.innerHTML = ""; // Clear existing content
    
            if (data.success && data.notifications.length > 0) {
                // Update the dropdown content
                let unreadCount = 0;
                data.notifications.slice(0, 5).forEach((notification) => {
                    if (!notification.isRead) unreadCount++;
                    const notificationItem = document.createElement("div");
                    notificationItem.className = "notification-item" + (!notification.isRead ? " unread" : "");
                    notificationItem.innerHTML = `
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-preview">${notification.message.substring(0, 50)}...</div>
                        <div class="notification-time">${new Date(notification.createdAt).toLocaleString()}</div>
                    `;
                    notificationsDropdownContent.appendChild(notificationItem);
                });
    
                // Update the notification count badge
                if (notificationCount) {
                    notificationCount.textContent = unreadCount > 0 ? unreadCount : "0";
                }
    
                // If all loaded notifications are read, show a message
                if (unreadCount === 0) {
                    notificationsDropdownContent.innerHTML += '<div class="text-center text-muted py-3">No unread notifications</div>';
                }
            } else {
                // No notifications at all
                notificationsDropdownContent.innerHTML = '<div class="text-center text-muted py-3">No notifications</div>';
                if (notificationCount) notificationCount.textContent = "0";
            }
        })
        .catch((error) => {
            const notificationsDropdownContent = document.getElementById("notifications-dropdown-content");
            notificationsDropdownContent.innerHTML = '<div class="text-center text-muted py-3">Failed to load notifications</div>';
            console.error("Error loading notifications:", error);
        });
    }


    function markNotificationsAsRead() {
        fetch(`${API_URL}/students/notifications`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.notifications.length > 0) {
                const unreadIds = data.notifications
                    .filter(n => !n.isRead)
                    .map(n => n._id);
                if (unreadIds.length > 0) {
                    fetch(`${API_URL}/students/notifications/mark-read`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ notificationIds: unreadIds })
                    })
                    .then(() => {
                        loadNotificationCount();
                        loadNotificationsDropdown();
                    });
                }
            }
        });
    }
    
    // Attach to the global `window` object
    window.markNotificationsAsRead = markNotificationsAsRead;

    // Logout Functionality
    function setupLogoutButton() {
        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                localStorage.removeItem("activeMenu");
                window.location.href = "index.html"; // Redirect to login page
            });
        }
    }
    
    // Initialize Header Dropdowns
    function initializeHeaderDropdowns() {
        loadMessagesDropdown();
        loadNotificationsDropdown();
        loadNotificationCount();
        setupLogoutButton();
    
        // Optionally, refresh messages and notifications periodically
        setInterval(loadMessagesDropdown, 60000); // Refresh messages every 60 seconds
        setInterval(loadNotificationsDropdown, 60000); // Refresh notifications every 60 seconds
        setInterval(loadNotificationCount, 60000); // Refresh notification count every 60 seconds
    
       // Add event listener to mark notifications as read when the dropdown is clicked
        const notificationsDropdown = document.getElementById("notificationsDropdown");
        if (notificationsDropdown) {
            notificationsDropdown.addEventListener("click", () => {
                markNotificationsAsRead();
            });
        }
    }


function setupComposeModal() {
    const composeForm = document.getElementById("compose-message-form");
    if (!composeForm) return;

    composeForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const recipients = document.getElementById("message-recipients").value;
        const subject = document.getElementById("message-subject").value.trim();
        const body = document.getElementById("message-body").value.trim();

        if (!recipients || !subject || !body) {
            showToast("Please fill in all required fields", "warning");
            return;
        }

        const formData = {
            recipients: recipients.split(',').map(r => r.trim()),
            subject,
            body
        };

        fetch(`${API_URL}/students/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(formData),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    showToast("Message sent successfully", "success");
                    const modal = bootstrap.Modal.getInstance(document.getElementById("composeMessageModal"));
                    modal.hide();
                    composeForm.reset();
                    loadMessages(); // Refresh the messages list
                } else {
                    throw new Error(data.error || "Failed to send message");
                }
            })
            .catch((error) => {
                console.error(error);
                showToast("Failed to send message", "danger");
            });
    });

    // For students, we'll pre-populate the recipient options with admins
    const recipientSelect = document.getElementById("message-recipients");
    if (recipientSelect) {
        fetch(`${API_URL}/students/recipients`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    // Populate recipients select with admin options
                    data.recipients.forEach(recipient => {
                        const option = document.createElement("option");
                        option.value = recipient._id;
                        option.textContent = `${recipient.name} (${recipient.role})`;
                        recipientSelect.appendChild(option);
                    });

                    // Initialize Select2 for multiple selection
                    $(recipientSelect).select2({
                        placeholder: "Select recipients",
                        allowClear: true,
                        width: '100%'
                    });
                }
            })
            .catch(console.error);
    }
}

// ========== MESSAGING FUNCTIONS ==========
function loadMessages(page = 1, search = "", folder = "inbox") {
    const messagesList = document.getElementById("messages-list");
    if (!messagesList) return;

    // Show loading state
    messagesList.innerHTML = '<div class="text-center py-5"><div class="spinner-border" role="status"></div></div>';

    fetch(`${API_URL}/${user.role === 'admin' ? 'admin' : 'students'}/messages?page=${page}&search=${search}&folder=${folder}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
        .then((response) => response.json())
        .then((data) => {
            messagesList.innerHTML = "";

            if (data.success && data.messages.length > 0) {
                data.messages.forEach((message) => {
                    const messageItem = document.createElement("div");
                    messageItem.className = `message-item ${message.isRead ? '' : 'unread'}`;
                    messageItem.dataset.id = message._id;
                    messageItem.innerHTML = `
                        <div class="form-check message-item-checkbox">
                            <input class="form-check-input message-checkbox" type="checkbox" data-id="${message._id}">
                        </div>
                        <div class="message-item-sender">${message.senderName}</div>
                        <div class="message-item-subject">${message.subject}</div>
                        <div class="message-item-preview">${message.body.substring(0, 50)}...</div>
                        <div class="message-item-time">${formatTimeAgo(message.createdAt)}</div>
                    `;
                    messagesList.appendChild(messageItem);

                    // Add click event to view message
                    messageItem.addEventListener("click", (e) => {
                        if (!e.target.classList.contains('form-check-input')) {
                            viewMessage(message._id);
                        }
                    });
                });

                // Update pagination
                updatePagination("messages", data.pagination);
            } else {
                messagesList.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="fas fa-envelope fa-3x mb-3"></i>
                        <p>No messages found</p>
                    </div>
                `;
            }
        })
        .catch((error) => {
            console.error("Error loading messages:", error);
            messagesList.innerHTML = `
                <div class="text-center py-5 text-danger">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <p>Failed to load messages</p>
                </div>
            `;
        });
}

function viewMessage(messageId) {
    const messagesListContainer = document.getElementById("messages-list-container");
    const messageViewContainer = document.getElementById("message-view-container");
    const messageViewContent = document.getElementById("message-view-content");

    // Show loading state
    messageViewContent.innerHTML = '<div class="text-center py-5"><div class="spinner-border" role="status"></div></div>';

    // Switch to message view
    messagesListContainer.style.display = "none";
    messageViewContainer.style.display = "block";

    // Fetch message details
    fetch(`${API_URL}/${user.role === 'admin' ? 'admin' : 'students'}/messages/${messageId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                const message = data.message;
                messageViewContent.innerHTML = `
                    <div class="message-header">
                        <h4 class="message-subject">${message.subject}</h4>
                        <div class="d-flex justify-content-between">
                            <div>
                                <span class="message-sender">From: ${message.senderName}</span>
                                <span class="message-recipients">To: ${message.recipients.map(r => r.name).join(', ')}</span>
                            </div>
                            <div class="message-date">${new Date(message.createdAt).toLocaleString()}</div>
                        </div>
                    </div>
                    <div class="message-body">${message.body}</div>
                `;

                // Mark as read if not already read
                if (!message.isRead) {
                    fetch(`${API_URL}/${user.role === 'admin' ? 'admin' : 'students'}/messages/${messageId}/read`, {
                        method: "PATCH",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    })
                        .then(() => {
                            // Update the message count in the header
                            updateHeaderCounts();
                        })
                        .catch(console.error);
                }
            } else {
                messageViewContent.innerHTML = `
                    <div class="text-center py-5 text-danger">
                        <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                        <p>Failed to load message</p>
                    </div>
                `;
            }
        })
        .catch((error) => {
            console.error("Error loading message:", error);
            messageViewContent.innerHTML = `
                <div class="text-center py-5 text-danger">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <p>Failed to load message</p>
                </div>
            `;
        });
}

function setupMessageEventListeners() {
    // Back to list button
    document.getElementById("back-to-list")?.addEventListener("click", () => {
        document.getElementById("messages-list-container").style.display = "block";
        document.getElementById("message-view-container").style.display = "none";
    });

    // Reply button
    document.getElementById("reply-message")?.addEventListener("click", () => {
        const messageId = document.querySelector(".message-item.selected")?.dataset.id;
        if (messageId) {
            // Fetch message details to pre-fill the reply form
            fetch(`${API_URL}/${user.role === 'admin' ? 'admin' : 'students'}/messages/${messageId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
                .then((response) => response.json())
                .then((data) => {
                    if (data.success) {
                        const message = data.message;
                        const composeModal = new bootstrap.Modal(document.getElementById("composeMessageModal"));
                        
                        // Set up reply form
                        document.getElementById("message-subject").value = `Re: ${message.subject}`;
                        document.getElementById("message-recipients").value = message.senderId;
                        document.getElementById("message-body").value = `\n\n--- Original Message ---\nFrom: ${message.senderName}\nDate: ${new Date(message.createdAt).toLocaleString()}\n\n${message.body}`;
                        
                        composeModal.show();
                    }
                });
        }
    });

    // Folder navigation
    document.querySelectorAll(".messages-folders .folder").forEach((folder) => {
        folder.addEventListener("click", () => {
            document.querySelector(".messages-folders .folder.active").classList.remove("active");
            folder.classList.add("active");
            loadMessages(1, "", folder.dataset.folder);
        });
    });

    // Search messages
    const searchInput = document.getElementById("search-messages");
    if (searchInput) {
        searchInput.addEventListener("input", debounce(() => {
            const searchTerm = searchInput.value.trim();
            const activeFolder = document.querySelector(".messages-folders .folder.active").dataset.folder;
            loadMessages(1, searchTerm, activeFolder);
        }, 300));
    }

    // Refresh messages
    document.getElementById("refresh-messages")?.addEventListener("click", () => {
        const searchTerm = document.getElementById("search-messages").value.trim();
        const activeFolder = document.querySelector(".messages-folders .folder.active").dataset.folder;
        loadMessages(1, searchTerm, activeFolder);
    });

    // Select all messages
    document.getElementById("select-all-messages")?.addEventListener("change", (e) => {
        document.querySelectorAll(".message-checkbox").forEach((checkbox) => {
            checkbox.checked = e.target.checked;
        });
    });

    // Delete selected messages
    document.getElementById("delete-messages")?.addEventListener("click", () => {
        const selectedMessages = Array.from(document.querySelectorAll(".message-checkbox:checked")).map(
            (checkbox) => checkbox.dataset.id
        );

        if (selectedMessages.length === 0) {
            showToast("Please select at least one message to delete", "warning");
            return;
        }

        if (confirm(`Are you sure you want to delete ${selectedMessages.length} message(s)?`)) {
            fetch(`${API_URL}/${user.role === 'admin' ? 'admin' : 'students'}/messages`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ messageIds: selectedMessages }),
            })
                .then((response) => response.json())
                .then((data) => {
                    if (data.success) {
                        showToast("Messages deleted successfully", "success");
                        const searchTerm = document.getElementById("search-messages").value.trim();
                        const activeFolder = document.querySelector(".messages-folders .folder.active").dataset.folder;
                        loadMessages(1, searchTerm, activeFolder);
                    } else {
                        throw new Error(data.error || "Failed to delete messages");
                    }
                })
                .catch((error) => {
                    console.error(error);
                    showToast("Failed to delete messages", "danger");
                });
        }
    });
}

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
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

        // Load the calendar

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
                        <td>${quiz.title}<br><span class="welcome-subtext">${quiz.description}</span></td>
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


    // ========== RECENT ACTIVITIES ==========
    function loadRecentActivities() {
        const container = document.getElementById('activities-list');
        if (!container) return;
    
        container.innerHTML = '<div class="activity-item">Loading...</div>';
    
        fetch(`${API_URL}/students/activities`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (!data.success || !data.data.length) {
                container.innerHTML = '<div class="activity-item">No recent activities</div>';
                return;
            }
            container.innerHTML = data.data.map(activity => `
                <div class="activity-item">
                    <div class="activity-indicator ${getActivityColor(activity.type)}"></div>
                    <div class="activity-details">
                        <div class="activity-time">${formatTimeAgo(activity.timestamp)}</div>
                        <div class="activity-text">${activity.message}</div>
                    </div>
                </div>
            `).join('');
        })
        .catch(() => {
            container.innerHTML = '<div class="activity-item error">Failed to load activities</div>';
        });
    }
    
    // Helper for time ago formatting
    function formatTimeAgo(date) {
        const now = new Date();
        const diff = Math.floor((now - new Date(date)) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

        function getActivityColor(type) {
        switch (type) {
            case "quiz_attempted":
                return "activity-success";   // Green
            case "quiz_assigned":
                return "activity-info";      // Blue
            case "quiz_created":
            case "quiz_updated":
                return "activity-primary";   // Dark blue
            case "quiz_deleted":
                return "activity-danger";    // Red
            case "profile_updated":
                return "activity-warning";   // Yellow/Orange
            case "submission_graded":
                return "activity-secondary"; // Gray
            case "notification_sent":
                return "activity-info";
            default:
                return "activity-default";   // Default/neutral
        }
    }
    
    // ========== CALENDAR ==========
    function initializeCalendar() {
        const calendarEl = document.getElementById("calendar")
        if (calendarEl && window.FullCalendar) {
          const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: "dayGridMonth",
            headerToolbar: {
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            },
            height: 300,
          })
          calendar.render()
        }
      }


    // Initialize the dashboard
    init();
});