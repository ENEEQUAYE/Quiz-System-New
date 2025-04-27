document.addEventListener("DOMContentLoaded", () => {
    // ========== AUTHENTICATION & INITIALIZATION ==========
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const API_URL = "http://localhost:5000/api";

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
    }

    function setProfile() {
        if (user) {
            const profilePicUrl = user.profilePicture
                ? user.profilePicture.startsWith("http")
                    ? user.profilePicture
                    : `http://localhost:5000${user.profilePicture}`
                : "img/user.jpg";

            document.querySelectorAll(".user-image").forEach((img) => {
                img.src = profilePicUrl;
            });

            document.querySelectorAll(".user-name").forEach((span) => {
                span.textContent = user.firstName || "Student";
            });
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
  
                  // Update pagination if applicable
                  if (data.pagination) {
                      updatePagination("quizzes", data.pagination);
                  }
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
        if (!gradebookTableBody) return;
    
        // Show loading state
        gradebookTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
    
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
                        gradebookTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No grades available</td></tr>';
                        return;
                    }
    
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
                    });
                } else {
                    gradebookTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load gradebook</td></tr>';
                    console.error("Failed to load gradebook:", data.error);
                }
            })
            .catch((error) => {
                gradebookTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load gradebook</td></tr>';
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

        function updatePagination(section, pagination) {
        const paginationContainer = document.getElementById(`${section}-pagination`);
        if (!paginationContainer) return;
    
        paginationContainer.innerHTML = ""; // Clear existing pagination
    
        const { currentPage, totalPages } = pagination;
    
        // Create previous button
        const prevButton = document.createElement("button");
        prevButton.textContent = "Previous";
        prevButton.className = "btn btn-sm btn-secondary";
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener("click", () => {
            if (currentPage > 1) {
                loadQuizzes(currentPage - 1); // Adjust this function call for the section
            }
        });
        paginationContainer.appendChild(prevButton);
    
        // Create page buttons
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement("button");
            pageButton.textContent = i;
            pageButton.className = `btn btn-sm ${i === currentPage ? "btn-primary" : "btn-secondary"}`;
            pageButton.addEventListener("click", () => {
                loadQuizzes(i); // Adjust this function call for the section
            });
            paginationContainer.appendChild(pageButton);
        }
    
        // Create next button
        const nextButton = document.createElement("button");
        nextButton.textContent = "Next";
        nextButton.className = "btn btn-sm btn-secondary";
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener("click", () => {
            if (currentPage < totalPages) {
                loadQuizzes(currentPage + 1); // Adjust this function call for the section
            }
        });
        paginationContainer.appendChild(nextButton);
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