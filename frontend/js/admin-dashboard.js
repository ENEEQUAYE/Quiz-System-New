
    //js/admin.js
    document.addEventListener("DOMContentLoaded", () => {
    // ========== AUTHENTICATION & INITIALIZATION ==========
    const token = localStorage.getItem("token")
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const API_URL = "https://quiz-system-new.onrender.com/api"
  
    // Check if user is logged in and has admin role
    if (!token || !user || user.role !== "admin") {
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
    const header = {
        messagesDropdown: document.getElementById("messagesDropdown"),
        notificationsDropdown: document.getElementById("notificationsDropdown"),
        userDropdown: document.getElementById("userDropdown"),
        messageCount: document.getElementById("message-count"),
        notificationCount: document.getElementById("notification-count"),
        userName: document.getElementById("header-user-name"),
        userImage: document.querySelector("#userDropdown img"),
        logoutBtn: document.getElementById("logout-btn"),
    };

    
  
    // ========== INITIALIZATION FUNCTIONS ==========
    function init() {
      updateTime()
      setInterval(updateTime, 1000)
      setProfile()
      setupSidebar()
      setupMenuNavigation()
      setupEventListeners()
      initializeCalendar()
      loadNotificationCounts();
      setInterval(loadNotificationCounts, 300000); // Refresh every 5 minutes
      initializeHeaderDropdowns();
      initializeDropdowns();
      setupHeaderDropdowns()
    }
  
    function initializeDropdowns() {
        // Initialize Bootstrap dropdowns
        const dropdownElements = document.querySelectorAll('.dropdown-toggle');
        dropdownElements.forEach((dropdown) => {
            dropdown.addEventListener('click', function (e) {
                e.preventDefault();
                const dropdownMenu = this.nextElementSibling;
                dropdownMenu.classList.toggle('show');
            });
        });
    
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-menu').forEach((menu) => {
                    menu.classList.remove('show');
                });
            }
        });
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
          const fullName = `${user.firstName || "Admin"} ${user.lastName || ""}`.trim();
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
    const date = new Date()
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" }
    const timeOptions = { hour: "numeric", minute: "numeric", second: "numeric", hour12: true }

    const dateElements = document.querySelectorAll('[id$="current-date"], #current-date')
    const timeElements = document.querySelectorAll('[id$="current-time"], #current-time')

    dateElements.forEach((el) => {
        if (el) el.textContent = date.toLocaleDateString("en-US", options)
    })

    timeElements.forEach((el) => {
        if (el) el.textContent = date.toLocaleTimeString("en-US", timeOptions)
    })
    }

    function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

 


   // ========== HEADER FUNCTIONALITIES ==========
   function setupHeaderDropdowns() {
    // Messages dropdown
    if (elements.header.messagesDropdown) {
        elements.header.messagesDropdown.addEventListener("click", () => {
            loadMessagesDropdown();
        });
    }

    // Notifications dropdown
    if (elements.header.notificationsDropdown) {
        elements.header.notificationsDropdown.addEventListener("click", () => {
            loadNotificationsDropdown();
        });
    }

    // User dropdown
    setupUserDropdown();

    // Initialize dropdown counts
    updateHeaderCounts();
    setInterval(updateHeaderCounts, 300000); // Refresh every 5 minutes
}

function updateHeaderCounts() {
    fetch(`${API_URL}/notifications/counts`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (elements.header.messageCount) {
                elements.header.messageCount.textContent = data.messages || "0";
            }
            if (elements.header.notificationCount) {
                elements.header.notificationCount.textContent = data.notifications || "0";
            }
        }
    })
    .catch(error => console.error("Error loading counts:", error));
}

function loadMessagesDropdown() {
    fetch(`${API_URL}/students/messages`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        const messagesContent = document.getElementById("messages-dropdown-content");
        if (messagesContent) {
            if (data.success && data.messages?.length > 0) {
                messagesContent.innerHTML = data.messages.slice(0, 5).map(message => `
                    <div class="messages-item p-2 border-bottom">
                        <div class="message-sender fw-bold">${message.senderName}</div>
                        <div class="message-preview text-truncate">${message.body.substring(0, 50)}</div>
                        <div class="message-time small text-muted">${formatTimeAgo(message.createdAt)}</div>
                    </div>
                `).join("");
            } else {
                messagesContent.innerHTML = '<div class="text-center text-muted py-3">No new messages</div>';
            }
        }
    })
    .catch(error => console.error("Error loading messages:", error));
}

function loadNotificationsDropdown() {
    fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        const notificationsContent = document.getElementById("notifications-dropdown-content");
        if (notificationsContent) {
            if (data.success && data.notifications?.length > 0) {
                notificationsContent.innerHTML = data.notifications.slice(0, 5).map(notification => `
                    <div class="notification-item p-2 border-bottom ${notification.isRead ? "" : "unread"}">
                        <div class="notification-title fw-bold">${notification.title}</div>
                        <div class="notification-preview text-truncate">${notification.message}</div>
                        <div class="notification-time small text-muted">${formatTimeAgo(notification.createdAt)}</div>
                    </div>
                `).join("");
            } else {
                notificationsContent.innerHTML = '<div class="text-center text-muted py-3">No new notifications</div>';
            }
        }
    })
    .catch(error => console.error("Error loading notifications:", error));
}

function setupUserDropdown() {
    // Set user info
    setProfileInfo();

    // Logout functionality
    if (elements.header.logoutBtn) {
        elements.header.logoutBtn.addEventListener("click", handleLogout);
    }

    // Profile and settings links
    document.querySelectorAll('.dropdown-item[href^="#"]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('href');
            document.querySelector(`.menu-item[data-target="${target}"]`)?.click();
        });
    });
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

    // ========== SIDEBAR MANAGEMENT ==========
    function setupSidebar() {
        if (sidebarCollapse && sidebar) {
        sidebarCollapse.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed")
            localStorage.setItem("sidebarState", sidebar.classList.contains("collapsed") ? "collapsed" : "expanded")
        })

        // Restore saved state
        const savedState = localStorage.getItem("sidebarState")
        if (savedState === "collapsed") {
            sidebar.classList.add("collapsed")
        }
        }

        // Mobile sidebar toggle
        const sidebarCollapseBtn = document.getElementById("sidebar-collapse")
        if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener("click", () => {
            sidebar.classList.toggle("active")
        })
        }

        // Handle window resize
        window.addEventListener("resize", () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove("collapsed")
        } else {
            // Restore saved state on larger screens
            const savedState = localStorage.getItem("sidebarState")
            if (savedState === "collapsed") {
            sidebar.classList.add("collapsed")
            } else {
            sidebar.classList.remove("collapsed")
            }
        }
        })
    }

  // ========== MENU NAVIGATION ==========
  function setupMenuNavigation() {
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        // Update active menu item
        menuItems.forEach((menu) => menu.classList.remove("active"))
        item.classList.add("active")

        // Show the target content
        const target = item.getAttribute("data-target")
        dashboardContents.forEach((content) => (content.style.display = "none"))

        const targetContent = document.querySelector(target)
        if (targetContent) {
          targetContent.style.display = "block"

          // Load data based on selected menu
          switch (target) {
            case "#dashboard":
              loadDashboardStats()
              break
            case "#students":
              loadStudents()
              break
            case "#quizzes":
              loadQuizzes()
              break
            case "#approvals":
              loadApprovals()
              break
            case "#administrators":
              loadAdministrators()
              break
            case "#students-report":
                loadStudentsReport()
                break
            case "#profile":
              loadProfile()
              break
            case "#messages":
              loadMessages()
              break
            case "#settings":
              loadSettings()
              break
          }
        }

        // On mobile, collapse the sidebar after selection
        if (window.innerWidth <= 768) {
          sidebar.classList.remove("active")
        }

        // Save active menu
        localStorage.setItem("activeMenu", target)
      })
    })

    // Restore active menu from localStorage
    const savedActiveMenu = localStorage.getItem("activeMenu")
    if (savedActiveMenu) {
      const activeMenuItem = document.querySelector(`.menu-item[data-target="${savedActiveMenu}"]`)
      if (activeMenuItem) {
        activeMenuItem.click()
      } else {
        document.querySelector("#dashboard").style.display = "block"
        loadDashboardStats()
      }
    } else {
      document.querySelector("#dashboard").style.display = "block"
      loadDashboardStats()
    }
  }

  
  // ========== EVENT LISTENERS ==========
  function setupEventListeners() {
    // Logout functionality
    const logoutBtn = document.querySelector('[data-target="#logout"]')
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        localStorage.removeItem("activeMenu")
        window.location.href = "index.html"
      })
    }

    const createQuizBtn = document.getElementById("create-quiz-btn");
    if (createQuizBtn) {
        createQuizBtn.addEventListener("click", handleCreateQuiz);
    }

    // Add Question button
    const addQuestionBtn = document.getElementById("add-question-btn");
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener("click", addQuestion);
    }

    const uploadQuizForm = document.getElementById("upload-quiz-form");
    if (uploadQuizForm) {
        uploadQuizForm.addEventListener("submit", handleUploadAndExtractQuestions);
    }






     // Form submission handlers
     setupFormHandlers()

     // Search input handlers
     setupSearchHandlers()
 
     // Pagination handlers
     setupPaginationHandlers()

     // Profile picture upload
    const uploadPicInput = document.getElementById("upload-pic")
    if (uploadPicInput) {
      uploadPicInput.addEventListener("change", handleProfilePictureUpload)
    }
  }



  async function handleUploadAndExtractQuestions(event) {
      event.preventDefault();
  
      const fileInput = document.getElementById("quiz-file");
      const file = fileInput.files[0];
  
      if (!file) {
          showToast("Please select a file to upload.", "warning");
          return;
      }
  
      const formData = new FormData();
      formData.append("file", file);
  
      try {
          const response = await fetch(`${API_URL}/admin/quizzes/upload`, {
              method: "POST",
              headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`, // Include the token
              },
              body: formData,
          });
  
          const data = await response.json();
          console.log("API Response:", data);
  
          if (data.success && data.questions) {
              // Automatically switch to the Create Quiz menu
              activateCreateQuizMenu();
  
              // Populate the questions in the Create Quiz section
              populateQuestionsInCreateQuiz(data.questions);
  
              showToast("Questions uploaded successfully. Please select the correct answers.", "success");
  
              // Close the modal
              const modal = bootstrap.Modal.getInstance(document.getElementById("uploadQuizModal"));
              modal.hide();
          } else {
              showToast(data.error || "Failed to extract questions.", "danger");
          }
      } catch (error) {
          console.error("Error uploading file:", error);
          showToast("An error occurred while uploading the file.", "danger");
      }
  }
        
  // Function to activate the Create Quiz menu
  function activateCreateQuizMenu() {
      // Hide all dashboard content
      document.querySelectorAll(".dashboard-content").forEach((content) => {
          content.style.display = "none";
      });
  
      // Show the Create Quiz section
      const createQuizSection = document.getElementById("create-quiz");
      if (createQuizSection) {
          createQuizSection.style.display = "block";
      }
  
      // Update the active menu item in the sidebar
      document.querySelectorAll(".menu-item").forEach((item) => {
          item.classList.remove("active");
      });
      const createQuizMenuItem = document.querySelector(".menu-item[data-target='#create-quiz']");
      if (createQuizMenuItem) {
          createQuizMenuItem.classList.add("active");
      }
  }


  
  // Function to populate questions in the Create Quiz section
  function populateQuestionsInCreateQuiz(questions) {
      const questionsContainer = document.getElementById("questions-container");
      const noQuestions = document.getElementById("no-questions");
  
      if (noQuestions) {
          noQuestions.remove();
      }
  
      questions.forEach((question, index) => {
          const uniqueId = Date.now() + index;
  
          const questionItem = document.createElement("div");
          questionItem.className = "card question-item mb-3";
          questionItem.innerHTML = `
              <div class="card-header">
                  <h5 class="card-title">Question ${index + 1}</h5>
                  <div class="card-actions">
                      <button type="button" class="action-btn red remove-question-btn"><i class="fas fa-trash"></i></button>
                  </div>
              </div>
              <div class="card-body">
                  <div class="mb-3">
                      <label class="form-label">Question Text</label>
                      <textarea class="form-control question-text" rows="3" placeholder="Enter question text">${question.questionText}</textarea>
                  </div>
                  <div class="mb-3">
                      <label class="form-label">Options</label>
                      <div class="options-container">
                          ${question.options.map((option, i) => `
                              <div class="input-group mb-2">
                                  <div class="input-group-text">
                                      <input type="radio" class="form-check-input correct-option" name="correctOption${uniqueId}">
                                  </div>
                                  <input type="text" class="form-control option-input" value="${option}">
                              </div>
                          `).join("")}
                      </div>
                  </div>
              </div>
          `;
  
          questionsContainer.appendChild(questionItem);
  
          // Add event listener to remove the question
          questionItem.querySelector(".remove-question-btn").addEventListener("click", () => {
              questionItem.remove();
          });
      });
  }

  function setupFormHandlers() {

    //create administrator form
    const createAdminForm = document.getElementById("create-admin-form")
    if (createAdminForm) {
      createAdminForm.addEventListener("submit", handleCreateAdminFormSubmit)
    }

     // Add event listener for the create admin button
     const addAdminBtn = document.getElementById("add-administrator-btn")
     if (addAdminBtn) {
       addAdminBtn.addEventListener("click", () => {
         // Reset the form when opening the modal
         const createAdminForm = document.getElementById("create-admin-form")
         if (createAdminForm) {
           createAdminForm.reset()
         }
       })
     }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  function setupSearchHandlers() {
    // Search input for students
    const searchStudentsInput = document.getElementById("search-students")
    if (searchStudentsInput) {
      searchStudentsInput.addEventListener("input", (event) => {
        const searchTerm = event.target.value.trim()
        loadStudents(1, searchTerm)
      })
    }

    // Search input for quizzes
    const searchQuizzesInput = document.getElementById("search-quizzes")
    if (searchQuizzesInput) {
      searchQuizzesInput.addEventListener("input", (event) => {
        const searchTerm = event.target.value.trim()
        loadQuizzes(1, searchTerm)
      })
    }

    // Search input for approvals
    const searchApprovalsInput = document.getElementById("search-approvals")
    if (searchApprovalsInput) {
      searchApprovalsInput.addEventListener("input", (event) => {
        const searchTerm = event.target.value.trim()
        loadApprovals(1, searchTerm)
      })
    }

    // Search input for administrators
    const searchAdministratorsInput = document.getElementById("search-administrators")
    if (searchAdministratorsInput) {
      searchAdministratorsInput.addEventListener("input", (event) => {
        const searchTerm = event.target.value.trim()
        loadAdministrators(1, searchTerm)
      })
    }

    // Search input for student report
    const searchStudentReportInput = document.getElementById("search-students-report")
    if (searchStudentReportInput) {
        searchStudentReportInput.addEventListener("input", (event) => {
            const searchTerm = event.target.value.trim()
            loadStudentsReport(1, searchTerm)
        })
    }

    // Search input for messages
    const searchMessagesInput = document.getElementById("search-messages")
    if (searchMessagesInput) {
      searchMessagesInput.addEventListener("input", (event) => {
        const searchTerm = event.target.value.trim()
        loadMessages(1, searchTerm)
      })
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  function setupPaginationHandlers() {
    // Pagination buttons for students
    setupPaginationForSection("students", loadStudents)

    // Pagination buttons for quizzes
    setupPaginationForSection("quizzes", loadQuizzes)

    // Pagination buttons for approvals
    setupPaginationForSection("approvals", loadApprovals)

    // Pagination buttons for administrators
    setupPaginationForSection("administrators", loadAdministrators)

    // Pagination buttons for students report
    setupPaginationForSection("students-report", loadStudentsReport)

    // Pagination buttons for messages
    setupPaginationForSection("messages", loadMessages)
  }

  function handleCreateAdminFormSubmit(e) {
    e.preventDefault();
    console.log("Form submission handler called"); // Debugging

    const formData = {
        firstName: document.getElementById("adminFirstName").value.trim(),
        lastName: document.getElementById("adminLastName").value.trim(),
        email: document.getElementById("adminEmail").value.trim(),
        password: document.getElementById("adminPassword").value,
        phone: document.getElementById("adminPhone").value.trim() || undefined,
        position: document.getElementById("adminPosition").value.trim() || undefined
    };

    console.log("Form submitted:", formData); // Debugging

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
        showToast("Please fill in all required fields", "warning");
        return;
    }

    if (formData.password.length < 6) {
        showToast("Password must be at least 6 characters", "warning");
        return;
    }

    fetch(`${API_URL}/users/admin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById("createAdminModal"));
                modal.hide();
                showToast("Administrator created successfully", "success");
                loadAdministrators();
                document.getElementById("create-admin-form").reset();
            } else {
                throw new Error(data.error || "Failed to create administrator");
            }
        })
        .catch(error => {
            console.error(error);
            showToast(error.message || "Failed to create administrator", "danger");
        });
}

function handleCreateQuiz() {
    const title = document.getElementById("create-quiz-title").value.trim();
    const description = document.getElementById("create-quiz-description").value.trim();
    const order = parseInt(document.getElementById("create-quiz-order").value, 10);
    const timeLimit = parseInt(document.getElementById("create-quiz-duration").value, 10);
    const passingScore = parseInt(document.getElementById("create-quiz-passing-score").value, 10);
    const category = document.getElementById("create-quiz-category").value.trim();
    const difficulty = document.getElementById("create-quiz-difficulty").value;
    const maxAttempts = parseInt(document.getElementById("create-quiz-max-attempts").value, 10);
    const tags = document.getElementById("create-quiz-tags").value.split(",").map(tag => tag.trim());
    const isActive = document.getElementById("create-quiz-active").checked;

    // Get all visible question items
    const questionItems = Array.from(document.querySelectorAll(".question-item")).filter(
        (item) => item.offsetParent !== null // Exclude hidden elements
    );

    // Check if there are any questions
    if (questionItems.length === 0) {
        showToast("Please add at least one question before saving the quiz", "warning");
        return;
    }

    // Map over question items to extract question data
    const questions = questionItems.map((questionItem, index) => {
        const questionText = questionItem.querySelector(".question-text")?.value.trim();
        const questionType = questionItem.querySelector(".question-type")?.value;
        const options = Array.from(questionItem.querySelectorAll(".option-input")).map((optionInput) => optionInput.value.trim());
        const correctAnswer = Array.from(questionItem.querySelectorAll(".correct-option")).findIndex((radio) => radio.checked);

        // Validate question data
        if (!questionText) {
            throw new Error(`Question ${index + 1} must have text.`);
        }
        if (options.length === 0) {
            throw new Error(`Question ${index + 1} must have at least one option.`);
        }
        if (correctAnswer === -1) {
            throw new Error(`Question ${index + 1} must have a correct answer selected.`);
        }

        return {
            questionText,
            questionType,
            options,
            correctAnswer,
            points: 1, // Default points value
        };
    });

    // Validate quiz data
    if (!title || !order || !timeLimit || !passingScore || !category || !difficulty || !maxAttempts) {
        showToast("Please fill in all required fields", "warning");
        return;
    }

    const quizData = {
        title,
        description,
        order,
        timeLimit,
        passingScore,
        category,
        difficulty,
        maxAttempts,
        tags,
        isActive,
        questions,
        totalQuestions: questions.length,
    };

    // Determine if we're creating or updating
    const quizId = document.getElementById("edit-quiz-id")?.value;
    const isEditing = !!quizId;
    const url = isEditing ? `${API_URL}/admin/quizzes/${quizId}` : `${API_URL}/admin/quizzes`;
    const method = isEditing ? "PUT" : "POST";
    const successMessage = isEditing ? "Quiz updated successfully" : "Quiz created successfully";

    // Send the quiz data to the backend
    fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(quizData),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                showToast(successMessage, "success");

                // Reset the form
                document.getElementById("create-quiz-title").value = "";
                document.getElementById("create-quiz-description").value = "";
                document.getElementById("create-quiz-order").value = "";
                document.getElementById("create-quiz-duration").value = "";
                document.getElementById("create-quiz-passing-score").value = "";
                document.getElementById("create-quiz-category").value = "";
                document.getElementById("create-quiz-difficulty").value = "medium";
                document.getElementById("create-quiz-max-attempts").value = "";
                document.getElementById("create-quiz-tags").value = "";
                document.getElementById("create-quiz-active").checked = true;
                document.getElementById("questions-container").innerHTML = `
                    <div id="no-questions" class="text-center py-5 text-muted">
                        <i class="fas fa-question-circle fa-3x mb-3"></i>
                        <p class="mb-0">No questions added yet</p>
                    </div>
                `;

                // Reset editing state
                if (document.getElementById("edit-quiz-id")) {
                    document.getElementById("edit-quiz-id").value = "";
                }
                document.getElementById("create-quiz-btn").innerHTML = '<i class="fas fa-save"></i> Save Quiz';

                // Navigate back to quizzes list
                if (isEditing) {
                    document.querySelector('.menu-item[data-target="#quizzes"]').click();
                }
            } else {
                throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} quiz`);
            }
        })
        .catch((error) => {
            console.error(error);
            showToast(error.message || `Failed to ${isEditing ? "update" : "create"} quiz`, "danger");
        });
}

function addQuestion() {
    const questionsContainer = document.getElementById("questions-container");
    const noQuestions = document.getElementById("no-questions");

    if (noQuestions) {
        noQuestions.remove();
    }

    // Generate a unique ID for the question
    const uniqueId = Date.now();

    const questionItem = document.createElement("div");
    questionItem.className = "card question-item mb-3";
    questionItem.innerHTML = `
        <div class="card-header">
            <h5 class="card-title">Question</h5>
            <div class="card-actions">
                <button type="button" class="action-btn red remove-question-btn"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div class="card-body">
            <div class="mb-3">
                <label class="form-label">Question Type</label>
                <select class="form-select question-type">
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="true-false">True/False</option>
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label">Question Text</label>
                <textarea class="form-control question-text" rows="3" placeholder="Enter question text"></textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Options</label>
                <div class="options-container">
                    <div class="input-group mb-2">
                        <div class="input-group-text">
                            <input type="radio" class="form-check-input correct-option" name="correctOption${uniqueId}">
                        </div>
                        <input type="text" class="form-control option-input" placeholder="Option 1">
                        <button type="button" class="btn remove-option-btn"><i class="fas fa-minus-circle"></i></button>
                    </div>
                </div>
                <button type="button" class="btn btn-primary btn-sm add-option-btn"><i class="fas fa-plus-circle"></i> Add Option</button>
            </div>
        </div>
    `;

    questionsContainer.appendChild(questionItem);

    // Add event listeners for the new question
    questionItem.querySelector(".remove-question-btn").addEventListener("click", () => {
        questionItem.remove(); // Fully remove the question card
    });
    questionItem.querySelector(".add-option-btn").addEventListener("click", () => addOption(questionItem, uniqueId));
}

function addOption(questionItem, uniqueId) {
    const optionsContainer = questionItem.querySelector(".options-container");
    const optionNumber = optionsContainer.querySelectorAll(".option-input").length + 1;

    const optionItem = document.createElement("div");
    optionItem.className = "input-group mb-2";
    optionItem.innerHTML = `
        <div class="input-group-text">
            <input type="radio" class="form-check-input correct-option" name="correctOption${uniqueId}">
        </div>
        <input type="text" class="form-control option-input" placeholder="Option ${optionNumber}">
        <button type="button" class="btn remove-option-btn"><i class="fas fa-minus-circle"></i></button>
    `;

    optionsContainer.appendChild(optionItem);

    // Add event listener for the remove button
    optionItem.querySelector(".remove-option-btn").addEventListener("click", () => optionItem.remove());
}
    

  // =============================================== DATA LOADING FUNCTIONS =================================================================
  function loadDashboardStats() {
    //Fetch students count
    fetchData(`${API_URL}/admin/students/count`, (data) => {
    document.getElementById("students-count").textContent = data.data.total || 0
    })

    //Fetch pending approvals count
    fetchData(`${API_URL}/users/pending/count`, (data) => {
        document.getElementById("pending-approvals-count").textContent = data.totalPendingStudents || 0
    })

    //Fetch quizzes count
    fetchData(`${API_URL}/quizzes/count`, (data) => {
        document.getElementById("quizzes-count").textContent = data.total || 0
    })

    // //Fetch total attempts count
    // console.log('Fetching total attempts from:', `${API_URL}/quizzes/attempts`);
    // fetchData(`${API_URL}/quizzes/attempts`, (data) => {
    //   console.log('Total attempts data:', data);
    //   document.getElementById("quiz-submissions-count").textContent = data.total || 0;
    // });
 

    
    // Initialize calendar
    initializeCalendar()
    loadRecentActivities()
  }


  ////////////////////////// Load students data////////////////////////////////
 function loadStudents(page = 1, search = "") {
    const studentsTableBody = document.getElementById("students-table-body");
    if (!studentsTableBody) return;

    // Show loading state
    studentsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';

    // Fetch students from API
    fetchData(`${API_URL}/admin/students?page=${page}&search=${search}`, (data) => {
        // Clear loading state
        studentsTableBody.innerHTML = "";

        if (!data.data || data.data.length === 0) {
            studentsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No students found</td></tr>';
            return;
        }

        // Populate table with student data
        data.data.forEach((student) => {
            console.log(student);
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${student.firstName} ${student.lastName}</td>
                <td>${student.email}</td>
                <td>${student.phone || 'N/A'}</td>
                <td>${formatDate(student.createdAt)}</td>
                <td>
                    <span class="bardge ${student.status === 'active' ? 'bg-correct' : 'bg-wrong'}">
                        ${student.status || 'N/A'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" data-id="${student._id}" data-action="edit" data-bs-toggle="modal" data-bs-target="#editStudentModal">
                        <i class="fas fa-edit"></i>Edit
                    </button>
                    <button class="btn btn-sm btn-danger ms-2" data-id="${student._id}" data-action="delete">
                        <i class="fas fa-trash"></i>Delete
                    </button>
                    <button class="btn btn-sm btn-success ms-2" data-id="${student._id}"  data-action="assign-quiz" data-bs-toggle="modal" data-bs-target="#assignQuizModal">
                        <i class="fas fa-check"id="assign"></i>Assign Quiz
                    </button>
                </td>
            `;
            studentsTableBody.appendChild(row);
        });

        // Update pagination
        updatePagination("students", data.pagination);

        // Add event listeners to edit and delete buttons
        document.querySelectorAll("#students-table-body [data-action]").forEach((btn) => {
            btn.addEventListener("click", handleStudentAction);
        });
    });
}

  /////////////////////////// Load quizzes data ///////////////////////////
function loadQuizzes(page = 1, search = "") {
    const quizzesTableBody = document.getElementById("quizzes-table-body");
    if (!quizzesTableBody) return;

    // Show loading state
    quizzesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';

    // Fetch quizzes from API
    fetchData(`${API_URL}/quizzes/?page=${page}&search=${search}`, (data) => {
        // Clear loading state
        quizzesTableBody.innerHTML = "";

        if (!data.data || data.data.length === 0) {
            quizzesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No quizzes found</td></tr>';
            return;
        }

        // Populate table with quiz data
        data.data.forEach((quiz) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${quiz.title}<br><span class="welcome-subtext">${quiz.description}</span></td>
                <td>${quiz.totalQuestions}</td>
                <td>${quiz.order}</td>
                <td>${formatDate(quiz.createdAt)}</td>
                <td>${quiz.attempts}</td>
                <td>
                    <button class="btn btn-sm btn-primary" data-id="${quiz._id}" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger ms-2" data-id="${quiz._id}" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            quizzesTableBody.appendChild(row);
        });

        // Update pagination
        updatePagination("quizzes", data.pagination);

        // Add event listeners to edit and delete buttons
        document.querySelectorAll("#quizzes-table-body [data-action]").forEach((btn) => {
            btn.addEventListener("click", handleQuizAction);
        });
    });
}

    ////////////////////////// Load approvals data //////////////////////////
    function loadApprovals(page = 1, search = "") {
        const approvalsTableBody = document.getElementById("approvals-table-body")
        if (!approvalsTableBody) return

        // Show loading state
        approvalsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>'

        //Fetch approvals from API
        fetchData(`${API_URL}/admin/approvals?page=${page}&search=${search}`, (data) => {
            // Clear loading state
            approvalsTableBody.innerHTML = ""

            if (!data.data || data.data.length === 0) {
                approvalsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No pending approvals</td></tr>'
                return
            }

            // Populate table with approval data
            data.data.forEach((student) => {
                const row = document.createElement("tr")

                row.innerHTML = `
                    <td>${student.firstName} ${student.lastName}</td>
                    <td>${student.email}</td>
                    <td>${student.phone || 'N/A'}</td>
                    <td>${formatDate(student.createdAt)}</td>
                    <td><span class="bardge bg-wrong">${student.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-success approve-btn" data-id="${student._id}" data-action="approve">
                            Approve
                        </button>
                        <button class="btn btn-sm btn-danger ms-2 reject-btn" data-id="${student._id}" data-action="reject">
                            Reject
                        </button>
                    </td>
                `;
                approvalsTableBody.appendChild(row);
            })

            //// Update pagination
            updatePagination("approvals", data.pagination)

            // Add event listeners to approve and reject buttons
            document.getElementById("approvals-table-body").addEventListener("click", (e) => {
                if (e.target.classList.contains("approve-btn")) {
                    handleApprovalAction(e.target.dataset.id, "active");
                } else if (e.target.classList.contains("reject-btn")) {
                    handleApprovalAction(e.target.dataset.id, "rejected");
                }
            });
        })
    }

    //////////////////////////// Load administrators data //////////////////////////
    function loadAdministrators(page = 1, search = "") {
        const adminsTableBody = document.getElementById("administrators-table-body")
        if (!adminsTableBody) return

        // Show loading state
        adminsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>'

        //Fetch administrators from API
        fetchData(`${API_URL}/admin/administrators?page=${page}&search=${search}`, (data) => {
            // Clear loading state
            adminsTableBody.innerHTML = ""

            if (!data.data || data.data.length === 0) {
                adminsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No administrators found</td></tr>'
                return
            }

            // Populate table with administrator data
            data.data.forEach((admin) => {
                const row = document.createElement("tr")
                row.innerHTML = `
                    <td>${admin.firstName} ${admin.lastName}</td>
                    <td>${admin.email}</td>
                    <td>${admin.phone || 'N/A'}</td>
                    <td>${admin.position}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-admin" data-id="${admin._id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" data-id="${admin._id}" data-action="delete">
                            Delete
                        </button>
                    </td>
                `;
                adminsTableBody.appendChild(row);
            })

            //// Update pagination
            updatePagination("administrators", data.pagination)

            // Add event listeners to delete buttons
            document.querySelectorAll("#administrators-table-body [data-action]").forEach(btn => {
                btn.addEventListener("click", handleAdminAction);
            })
        })
    }

    ////////////////////////// Load students report data //////////////////////////
    function loadStudentsReport(page = 1, search = "") {
        const studentsReportTableBody = document.getElementById("students-report-table-body");
        if (!studentsReportTableBody) return;
    
        // Show loading state
        studentsReportTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    
        // Fetch student reports from API
        fetch(`${API_URL}/admin/students/report?page=${page}&search=${search}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || 'Failed to fetch student reports');
                });
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch student reports');
            }
    
            studentsReportTableBody.innerHTML = "";
    
            if (!data.data || data.data.length === 0) {
                studentsReportTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No students found</td></tr>';
                return;
            }
    
            // Populate table with student report data
            data.data.forEach((student, index) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${student.firstName} ${student.lastName}</td>
                    <td>${student.email}</td>
                    <td>${student.totalQuizzesTaken}</td>
                    <td>${student.totalScore}</td>
                    <td>${student.averageScore}%</td>
                    <td>${student.grade}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" data-id="${student._id}" data-action="view-report">
                            View Report
                        </button>
                    </td>
                `;
                studentsReportTableBody.appendChild(row);
            });
    
            // Update pagination
            updatePagination("students-report", data.pagination);
    
            // Add event listeners to view report buttons and redirect to report page
            document.querySelectorAll("#students-report-table-body [data-action]").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    const studentId = e.target.dataset.id;
                    if (studentId) {
                        window.open(`student-report.html?studentId=${studentId}`, '_blank');
                    }
                });
            });
        })
        .catch(error => {
            console.error("Failed to load student reports:", error);
            studentsReportTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
                        ${error.message || 'Failed to load student reports'}
                    </td>
                </tr>
            `;
            showToast(error.message || 'Failed to load student reports', 'danger');
        });
    }


    ////////////////////////// Load Profile //////////////////////////
        function loadProfile() {
        fetchData(`${API_URL}/users/me`, (data) => {
      
            // Populate profile data
            const profilePic = document.getElementById("profile-pic");
            const profileName = document.getElementById("profile-name");
            const profileEmail = document.getElementById("profile-email");
            const profilePhone = document.getElementById("profile-phone");
            const profilePosition = document.getElementById("profile-position");
            const profileRole = document.getElementById("profile-role");
    
            if (profilePic) {
                profilePic.src = user.profilePicture || "img/user.jpg";
            }
            if (profileName) {
                profileName.textContent = `${user.firstName} ${user.lastName}`;
            }
            if (profileEmail) {
                profileEmail.textContent = `Email: ${user.email}`;
            }
            if (profilePhone) {
                profilePhone.textContent = `Phone: ${user.phone || "N/A"}`;
            }
            if (profilePosition) {
                profilePosition.textContent = `Position: ${user.position}`;
            }
            if (profileRole) {
                profileRole.textContent = user.role || "N/A";
            }
        },
        (error) => {
            console.error("Error loading profile:", error);
            showToast("Failed to load profile", "danger");
        });
    }

    ////////////////////////// Load Messages //////////////////////////
    function loadMessages() {
        //// to be implemented
        console.log("Loading messages...")
    }

    ////////////////////////// Load Settings //////////////////////////
    function loadSettings() {
        //// to be implemented
        console.log("Loading settings...")
    }
           

// ========== ACTION LISTENERS ==========
function handleStudentAction(e) {
    e.preventDefault();

    const action = e.target.dataset.action;
    const studentId = e.target.dataset.id;
    if (!studentId) return;

    if (action === "delete") {
        if (confirm("Are you sure you want to delete this student?")) {
            fetch(`${API_URL}/admin/students/${studentId}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            })
                .then((response) => {
                    if (response.ok) {
                        showToast("Student deleted successfully", "success");
                        loadStudents(); // Refresh the student list
                    } else {
                        throw new Error("Failed to delete student");
                    }
                })
                .catch((error) => {
                    console.error(error);
                    showToast("Failed to delete student", "danger");
                });
        }
    } else if (action === "edit") {
      // Clear the form before fetching new data
      document.getElementById("studentFirstName").value = "";
      document.getElementById("studentLastName").value = "";
      document.getElementById("studentEmail").value = "";
      document.getElementById("studentPhone").value = "";
      document.getElementById("studentPassword").value = "";

      // Fetch student data and populate the modal
      fetch(`${API_URL}/admin/students/${studentId}`, {
          headers: {
              Authorization: `Bearer ${token}`,
          },
      })
          .then((response) => response.json())
          .then((data) => {
              if (data.student) {
                  document.getElementById("studentFirstName").value = data.student.firstName;
                  document.getElementById("studentLastName").value = data.student.lastName;
                  document.getElementById("studentEmail").value = data.student.email;
                  document.getElementById("studentPhone").value = data.student.phone || "";
                  document.getElementById("studentPassword").value = ""; // Leave blank
              } else {
                  throw new Error("Failed to fetch student data");
              }
          })
          .catch((error) => {
              console.error(error);
              showToast("Failed to load student data", "danger");
          });

      // Handle form submission
      const editStudentForm = document.getElementById("edit-student-form");
      if (!editStudentForm.dataset.listenerAdded) {
          editStudentForm.addEventListener("submit", (e) => {
              e.preventDefault();

              const updatedStudent = {
                  firstName: document.getElementById("studentFirstName").value.trim(),
                  lastName: document.getElementById("studentLastName").value.trim(),
                  email: document.getElementById("studentEmail").value.trim(),
                  phone: document.getElementById("studentPhone").value.trim(),
                  password: document.getElementById("studentPassword").value.trim(),
              };

              // Remove empty password field
              if (!updatedStudent.password) {
                  delete updatedStudent.password;
              }

              // Send updated data to the backend
              fetch(`${API_URL}/admin/students/${studentId}`, {
                  method: "PUT",
                  headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(updatedStudent),
              })
                  .then((response) => response.json())
                  .then((data) => {
                      if (data.message === "Student updated successfully") {
                          const modal = bootstrap.Modal.getInstance(document.getElementById("editStudentModal"));
                          modal.hide(); // Close the modal
                          showToast("Student updated successfully", "success");
                          loadStudents(); // Refresh the student list
                      } else {
                          throw new Error(data.message || "Failed to update student");
                      }
                  })
                  .catch((error) => {
                      console.error(error);
                      showToast("Failed to update student", "danger");
                  });
          });

          // Mark the listener as added
          editStudentForm.dataset.listenerAdded = true;
      }
  }
      else if (action === "assign-quiz") {
         // Fetch all quizzes and populate the modal
         const quizListContainer = document.getElementById("quiz-list");
         const selectAllCheckbox = document.getElementById("select-all-quizzes");
 
         // Clear previous content
         quizListContainer.innerHTML = '<p class="text-muted">Loading quizzes...</p>';
 
         fetch(`${API_URL}/quizzes?limit=1000`, {
             headers: {
                 Authorization: `Bearer ${token}`,
             },
         })
             .then((response) => response.json())
             .then((data) => {
                 if (data.success && data.data.length > 0) {
                     quizListContainer.innerHTML = data.data
                         .map(
                             (quiz) => `
                             <div class="form-check">
                                 <input class="form-check-input quiz-checkbox" type="checkbox" id="quiz-${quiz._id}" value="${quiz._id}">
                                 <label class="form-check-label" for="quiz-${quiz._id}">
                                     ${quiz.title}
                                 </label>
                             </div>
                         `
                         )
                         .join("");
                 } else {
                     quizListContainer.innerHTML = '<p class="text-muted">No quizzes available</p>';
                 }
             })
             .catch((error) => {
                 console.error("Failed to load quizzes:", error);
                 showToast("Failed to load quizzes", "danger");
             });

              // Handle "Select All" functionality
        selectAllCheckbox.addEventListener("change", (e) => {
          const checkboxes = document.querySelectorAll(".quiz-checkbox");
          checkboxes.forEach((checkbox) => {
              checkbox.checked = e.target.checked;
          });
      });

      // Handle form submission
      document.getElementById("assign-quiz-form").addEventListener("submit", (e) => {
          e.preventDefault();

          const selectedQuizzes = Array.from(document.querySelectorAll(".quiz-checkbox:checked")).map(
              (checkbox) => checkbox.value
          );

          if (selectedQuizzes.length === 0) {
              showToast("Please select at least one quiz", "warning");
              return;
          }

          // Assign selected quizzes to the student
          fetch(`${API_URL}/admin/students/${studentId}/quizzes`, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ quizzes: selectedQuizzes }),
          })
              .then((response) => response.json())
              .then((data) => {
                  if (data.success) {
                    const modal = bootstrap.Modal.getInstance(document.getElementById("assignQuizModal"));
                    modal.hide();
                    showToast("Quizzes assigned successfully", "success");
                    // Close the modal
                     // Refresh window
                      window.location.reload();
                  } else {
                      throw new Error(data.error || "Failed to assign quizzes");
                  }
              })
              .catch((error) => {
                  console.error(error);
                  showToast("Failed to assign quizzes", "danger");
              });
            });
    }
  }

  function handleQuizAction(e) {
    e.preventDefault()

    const action = e.target.closest("[data-action]").dataset.action
    const quizId = e.target.closest("[data-id]").dataset.id

    if (!quizId) return

    if (action === "delete") {
      if (confirm("Are you sure you want to delete this quiz?")) {
        fetch(`${API_URL}/admin/quizzes/${quizId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              showToast("Quiz deleted successfully", "success")
              loadQuizzes() // Refresh the quiz list
            } else {
              throw new Error(data.error || "Failed to delete quiz")
            }
          })
          .catch((error) => {
            console.error(error)
            showToast("Failed to delete quiz", "danger")
          })
      }
    } else if (action === "edit") {
      // Navigate to create quiz section
      document.querySelector('.menu-item[data-target="#create-quiz"]').click()

      // Show loading state
      document.getElementById("create-quiz-title").value = "Loading..."
      document.getElementById("create-quiz-description").value = "Loading..."
      document.getElementById("create-quiz-order").value = ""
      document.getElementById("create-quiz-duration").value = ""

      // Clear existing questions
      const questionsContainer = document.getElementById("questions-container")
      questionsContainer.innerHTML =
        '<div class="text-center py-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>'

      // Add a hidden field to track the quiz being edited
      if (!document.getElementById("edit-quiz-id")) {
        const hiddenField = document.createElement("input")
        hiddenField.type = "hidden"
        hiddenField.id = "edit-quiz-id"
        document.getElementById("create-quiz").appendChild(hiddenField)
      }
      document.getElementById("edit-quiz-id").value = quizId

      // Change button text to indicate editing
      document.getElementById("create-quiz-btn").innerHTML = '<i class="fas fa-save"></i> Update Quiz'

      // Fetch quiz details
      fetch(`${API_URL}/quizzes/${quizId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            const quiz = data.data

            // Populate form fields
            document.getElementById("create-quiz-title").value = quiz.title
            document.getElementById("create-quiz-description").value = quiz.description || ""
            document.getElementById("create-quiz-order").value = quiz.order
            document.getElementById("create-quiz-duration").value = quiz.timeLimit
            document.getElementById("create-quiz-active").checked = quiz.isActive

            // Clear questions container
            questionsContainer.innerHTML = ""

            // Add each question
            if (quiz.questions && quiz.questions.length > 0) {
              quiz.questions.forEach((question) => {
                addQuestionForEdit(question)
              })
            } else {
              questionsContainer.innerHTML = `
              <div id="no-questions" class="text-center py-5 text-muted">
                <i class="fas fa-question-circle fa-3x mb-3"></i>
                <p class="mb-0">No questions added yet</p>
              </div>
            `
            }
          } else {
            throw new Error(data.error || "Failed to fetch quiz details")
          }
        })
        .catch((error) => {
          console.error(error)
          showToast("Failed to load quiz details", "danger")
          questionsContainer.innerHTML = `
          <div id="no-questions" class="text-center py-5 text-muted">
            <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
            <p class="mb-0">Failed to load questions</p>
          </div>
        `
        })
    }
  }

  function addQuestionForEdit(questionData) {
    const questionsContainer = document.getElementById("questions-container")
    const noQuestions = document.getElementById("no-questions")

    if (noQuestions) {
      noQuestions.remove()
    }

    // Generate a unique ID for the question
    const uniqueId = Date.now() + Math.floor(Math.random() * 1000)

    const questionItem = document.createElement("div")
    questionItem.className = "card question-item mb-3"
    questionItem.innerHTML = `
    <div class="card-header">
      <h5 class="card-title">Question</h5>
      <div class="card-actions">
        <button type="button" class="action-btn red remove-question-btn"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    <div class="card-body">
      <div class="mb-3">
        <label class="form-label">Question Type</label>
        <select class="form-select question-type">
          <option value="multiple-choice" ${questionData.options.length > 2 ? "selected" : ""}>Multiple Choice</option>
          <option value="true-false" ${questionData.options.length === 2 ? "selected" : ""}>True/False</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Question Text</label>
        <textarea class="form-control question-text" rows="3" placeholder="Enter question text">${questionData.questionText}</textarea>
      </div>
      <div class="mb-3">
        <label class="form-label">Options</label>
        <div class="options-container">
          ${questionData.options
            .map(
              (option, index) => `
            <div class="input-group mb-2">
              <div class="input-group-text">
                <input type="radio" class="form-check-input correct-option" name="correctOption${uniqueId}" ${index === questionData.correctAnswer ? "checked" : ""}>
              </div>
              <input type="text" class="form-control option-input" placeholder="Option ${index + 1}" value="${option}">
              <button type="button" class="btn remove-option-btn"><i class="fas fa-minus-circle"></i></button>
            </div>
          `,
            )
            .join("")}
        </div>
        <button type="button" class="btn btn-primary btn-sm add-option-btn"><i class="fas fa-plus-circle"></i> Add Option</button>
      </div>
    </div>
  `

    questionsContainer.appendChild(questionItem)

    // Add event listeners for the new question
    questionItem.querySelector(".remove-question-btn").addEventListener("click", () => {
      questionItem.remove() // Fully remove the question card
    })
    questionItem.querySelector(".add-option-btn").addEventListener("click", () => addOption(questionItem, uniqueId))

    // Add event listeners for the remove option buttons
    questionItem.querySelectorAll(".remove-option-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.closest(".options-container").querySelectorAll(".input-group").length > 2) {
          btn.closest(".input-group").remove()
        } else {
          showToast("A question must have at least two options", "warning")
        }
      })
    })
  }


function handleApprovalAction(studentId, status) {
    const confirmationMessage =
        status === "active"
            ? "Are you sure you want to approve this student?"
            : "Are you sure you want to reject this student?";

            // Show a toast message for the action
            showToast(confirmationMessage, "info");

    if (confirm(confirmationMessage)) {
        fetch(`${API_URL}/admin/approvals/${studentId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status }),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    showToast(`Student ${status === "active" ? "approved" : "rejected"} successfully`, "success");
                    loadApprovals(); // Refresh the approvals list
                } else {
                    throw new Error(data.error || "Failed to update student status");
                }
            })
            .catch((error) => {
                console.error(error);
                showToast("Failed to update student status", "danger");
            });
    }
}

function handleAdminAction(e) {
    e.preventDefault();

    const action = e.target.dataset.action;
    const adminId = e.target.dataset.id;

    if (action === "delete") {
        if (confirm("Are you sure you want to delete this administrator?")) {
            fetch(`${API_URL}/admin/administrators/${adminId}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            })
                .then((response) => {
                    if (response.ok) {
                        showToast("Administrator deleted successfully", "success");
                        loadAdministrators(); // Refresh the administrators list
                    } else {
                        throw new Error("Failed to delete administrator");
                    }
                })
                .catch((error) => {
                    console.error(error);
                    showToast("Failed to delete administrator", "danger");
                });
        }
    }
}

function handleStudentReportAction(e) {
    e.preventDefault();

    const action = e.target.dataset.action;
    const studentId = e.target.dataset.id;

    if (!studentId || action !== "view-report") return;

    // Fetch student report data
    fetch(`${API_URL}/admin/students/${studentId}/report`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Display the report in a modal or redirect to a detailed report page
                const modalBody = document.getElementById("student-report-modal-body");
                modalBody.innerHTML = `
                    <h5>${data.student.firstName} ${data.student.lastName}</h5>
                    <p>Email: ${data.student.email}</p>
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Quiz Title</th>
                                <th>Score</th>
                                <th>Total Possible</th>
                                <th>Percentage</th>
                                <th>Passed</th>
                                <th>Attempt</th>
                                <th>Time Completed</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.report.map(report => `
                                <tr>
                                    <td>${report.quizTitle}</td>
                                    <td>${report.score}</td>
                                    <td>${report.totalPossible}</td>
                                    <td>${report.percentage}%</td>
                                    <td>${report.passed ? "Yes" : "No"}</td>
                                    <td>${report.attemptNumber}</td>
                                    <td>${new Date(report.timeCompleted).toLocaleString()}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                `;
                // Show the modal
                const modal = new bootstrap.Modal(document.getElementById("student-report-modal"));
                modal.show();
            } else {
                throw new Error(data.error || "Failed to fetch student report");
            }
        })
        .catch(error => {
            console.error("Failed to fetch student report:", error);
            showToast("Failed to fetch student report", "danger");
        });
}

  // ========== HELPER FUNCTIONS ==========
  function fetchData(url, successCallback, errorCallback) {
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok")
        }
        return response.json()
      })
      .then((data) => {
        if (data.success) {
          successCallback(data)
        } else {
          throw new Error(data.error || "Failed to fetch data")
        }
      })
      .catch((error) => {
        console.error("Fetch error:", error)
        if (errorCallback) {
          errorCallback(error)
        } else {
          showToast(`Error: ${error.message}`, "danger")
        }
      })
  }

function setupPaginationForSection(section, loadFunction) {
      const prevBtn = document.getElementById(`${section}-prev-page-btn`);
      const nextBtn = document.getElementById(`${section}-next-page-btn`);
  
      if (prevBtn && nextBtn) {
          prevBtn.addEventListener("click", () => {
              const currentPage = parseInt(document.getElementById(`${section}-page-num`).textContent, 10);
              if (currentPage > 1) {
                  loadFunction(currentPage - 1); // Load the previous page
              }
          });
  
          nextBtn.addEventListener("click", () => {
              const currentPage = parseInt(document.getElementById(`${section}-page-num`).textContent, 10);
              const totalPages = parseInt(nextBtn.dataset.totalPages, 10);
              if (currentPage < totalPages) {
                  loadFunction(currentPage + 1); // Load the next page
              }
          });
      }
  }


  // Update Pagination Controls
    function updatePagination(section, pagination) {
        const { page: currentPage, pages: totalPages } = pagination;
        const prevBtn = document.getElementById(`${section}-prev-page-btn`);
        const nextBtn = document.getElementById(`${section}-next-page-btn`);
        const pageNum = document.getElementById(`${section}-page-num`);
    
        if (prevBtn && nextBtn && pageNum) {
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

   function loadSectionData(section, page = 1, search = "") {
      switch (section) {
          case "students":
              loadStudents(page, search);
              break;
          case "quizzes":
              loadQuizzes(page, search);
              break;
          case "approvals":
              loadApprovals(page, search);
              break;
          case "administrators":
              loadAdministrators(page, search);
              break;
          case "students-report":
              loadStudentsReport(page, search);
              break;
          default:
              console.error(`Unknown section: ${section}`);
      }
  }
    function loadRecentActivities(page = 1) {
      const container = document.getElementById('activities-list');
      if (!container) return;
  
      // Show loading state
      container.innerHTML = '<div class="activity-item">Loading...</div>';
  
      fetchData(`${API_URL}/admin/activities?page=${page}&limit=5`, (data) => {
          if (!data.data || data.data.length === 0) {
              container.innerHTML = '<div class="activity-item">No recent activities</div>';
              return;
          }
  
          // Populate activities
          container.innerHTML = data.data.map(activity => `
              <div class="activity-item">
                  <div class="activity-indicator ${getActivityColor(activity.type)}"></div>
                  <div class="activity-details">
                      <div class="activity-time">${formatTimeAgo(activity.timestamp)}</div>
                      <div class="activity-text">${activity.message}</div>
                  </div>
              </div>
          `).join('');
      }, (error) => {
          console.error("Failed to load recent activities:", error);
          container.innerHTML = '<div class="activity-item error">Failed to load activities</div>';
      });
  }

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


function showMessages() {
    document.querySelector('.menu-item[data-target="#messages"]').click();
}

function showAlerts() {
    // Implementation would show alerts dropdown
    console.log('Show alerts dropdown');
}

function showUserMenu() {
    // Implementation would show user menu dropdown
    console.log('Show user menu');
}

  function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toast-container") || document.body;
    const toastElement = document.createElement("div");
    toastElement.className = `toast show align-items-center text-white bg-${type}`;
    toastElement.setAttribute("role", "alert");
    toastElement.setAttribute("aria-live", "assertive");
    toastElement.setAttribute("aria-atomic", "true");
    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toastElement);
    setTimeout(() => {
        toastElement.classList.remove("show");
        setTimeout(() => toastElement.remove(), 300);
    }, 3000);
}

function handleProfilePictureUpload(event) {
    const file = event.target.files[0]
    if (!file) {
      showToast("No file selected.", "warning")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const profilePic = document.getElementById("profile-pic")
      if (profilePic) {
        profilePic.src = e.target.result // Set the preview in the profile
      }

      // Upload the image to the server
      const formData = new FormData()
      formData.append("profilePicture", file)

      fetch(`${API_URL}/users/profile-picture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            showToast("Profile picture updated successfully!", "success")
            // Update the user object in localStorage with the new profile picture URL
            const user = JSON.parse(localStorage.getItem("user") || "{}")
            user.profilePicture = data.profilePictureUrl
            localStorage.setItem("user", JSON.stringify(user))
          } else {
            showToast(data.error || "Failed to upload profile picture.", "danger")
          }
        })
        .catch((error) => {
          console.error("Error uploading profile picture:", error)
          showToast("Failed to upload profile picture.", "danger")
        })
    }
    reader.readAsDataURL(file)
  }

    // Initialize the dashboard
    init()
})


