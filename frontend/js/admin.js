
    //js/admin.js
    document.addEventListener("DOMContentLoaded", () => {
    // ========== AUTHENTICATION & INITIALIZATION ==========
    const token = localStorage.getItem("token")
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    console.log("Token:", token);
    console.log("User:", user);
    const API_URL = "http://localhost:5000/api"
  
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

    
  
    // ========== INITIALIZATION FUNCTIONS ==========
    function init() {
      updateTime()
      setInterval(updateTime, 1000)
      setProfile()
      setupSidebar()
      setupMenuNavigation()
      setupEventListeners()
      initializeCalendar()
    }
  
    function setProfile() {
      if (user) {
        // Ensure absolute URL for profile picture
        const profilePicUrl = user.profilePicture
          ? user.profilePicture.startsWith("http")
            ? user.profilePicture
            : `http://localhost:5000${user.profilePicture}`
          : "img/user.jpg"
  
        // Update profile picture in header
        const userImageElements = document.querySelectorAll(".user-image")
        userImageElements.forEach((img) => {
          img.src = profilePicUrl
        })
  
        // Update user name in header
        const userNameElements = document.querySelectorAll(".user-name")
        userNameElements.forEach((span) => {
            span.textContent = user.firstName || "Admin";
        })
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

  function setupFormHandlers() {
    //create quiz form
    const createQuizForm = document.getElementById("create-quiz-form")
    if (createQuizForm) {
      createQuizForm.addEventListener("submit", handleQuizFormSubmit)
    }

    //edit profile form
    const editProfileForm = document.getElementById("edit-profile-form")
    if (editProfileForm) {
      editProfileForm.addEventListener("submit", handleEditProfileFormSubmit)
    }

    //compose message form
    const composeMessageForm = document.getElementById("compose-message-form")
    if (composeMessageForm) {
      composeMessageForm.addEventListener("submit", handleComposeMessageFormSubmit)
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

    // Pagination buttons for messages
    setupPaginationForSection("messages", loadMessages)
  }

  // ========== FORM HANDLERS ==========

  function handleQuizFormSubmit(event) {
    event.preventDefault()

    const formData = {
        title: document.getElementById("quiz-title").value,
        description: document.getElementById("quiz-description").value,
        questions: JSON.parse(document.getElementById("quiz-questions").value),
        order: parseInt(document.getElementById("quiz-order").value, 10),
        createdBy: user._id,
    }

    fetch(`${API_URL}/quizzes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
    })
    .then((response) => {
        if (response.ok) {
            return response.json()
        } else {
            throw new Error("Failed to create quiz")
        }
    })
    .then((data) => {
        //close modal
        const modalElement = document.getElementById("create-quiz-modal")
        const modal = bootstrap.Modal.getInstance(modalElement)
        if (modal) {
            modal.hide()
        }
        //reset form
        document.getElementById("create-quiz-form").reset()

        //show success message
        showToast("Quiz created successfully", "success")
        loadQuizzes()
    })
    .catch((error) => {
        console.error(error)
        showToast("Failed to create quiz", "danger")
    })
  }
    

  // ========== DATA LOADING FUNCTIONS ==========
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
        document.getElementById("quizzes-count").textContent = data.data.total || 0
    })

    //Fetch quiz-submissions count
    fetchData(`${API_URL}/quizzes/submissions`, (data) => {
        document.getElementById("submissions-count").textContent = data.data.total || 0
    })
    

    // Initialize calendar
    initializeCalendar()
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
                <td>${new Date(student.createdAt).toLocaleDateString()}</td>
                <td>${student.status}</td>
                <td>
                    <button class="btn btn-sm btn-primary" data-id="${student._id}" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger ms-2" data-id="${student._id}" data-action="delete">
                        <i class="fas fa-trash"></i>
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
    const quizzesTableBody = document.getElementById("quizzes-table-body")
    if (!quizzesTableBody) return

    // Show loading state
    quizzesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>'

    //Fetch quizzes from API
    fetchData(`${API_URL}/admin/quizzes?page=${page}&search=${search}`, (data) => {
      // Clear loading state
      quizzesTableBody.innerHTML = ""

      if (!data.data || data.data.length === 0) {
        quizzesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No quizzes found</td></tr>'
        return
      }

      // Populate table with quiz data
      data.data.forEach((quiz) => {
        const row = document.createElement("tr")
        row.innerHTML = `
          <td>${quiz.title}</td>
          <td>${quiz.description || 'N/A'}</td>
          <td>${quiz.questions.length}</td>
          <td>${new Date(quiz.createdAt).toLocaleDateString()}</td>
          <td>${quiz.isActive ? 'Active' : 'Inactive'}</td>
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
      })

      //// Update pagination
      updatePagination("quizzes", data.pagination)

      // Add event listeners to edit and delete buttons
      document.querySelectorAll("#quizzes-table-body [data-action]").forEach(btn => {
        btn.addEventListener("click", handleQuizAction);
    })
  })
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
                    <td>${new Date(student.createdAt).toLocaleDateString()}</td>
                    <td>${student.status}</td>
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
                    handleApprovalAction(e.target.dataset.id, "inactive");
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

    ////////////////////////// Load Profile //////////////////////////
    function loadProfile() {
        fetchData(`${API_URL}/users/me`, (data) => {

            // Populate profile data
            const profilePic = document.getElementById("profile-pic")
            const profileName = document.getElementById("profile-name")
            const profileEmail = document.getElementById("profile-email")
            const profilePhone = document.getElementById("profile-phone")
            const profilePosition = document.getElementById("profile-position")

            if (profilePic) {
                profilePic.src = user.profilePicture || "img/user.jpg"
            }
            if (profileName) {
                profileName.textContent = `${user.firstName} ${user.lastName}`
            }
            if (profileEmail) {
                profileEmail.textContent = user.email
            }
            if (profilePhone) {
                profilePhone.textContent = user.phone || "N/A"
            }
            if (profilePosition) {
                profilePosition.textContent = user.position || "N/A"
            }
        },
        (error) => {
            console.error("Error loading profile:", error)
            showToast("Failed to load profile", "danger")
        },
    )
}
           

// ========== ACTION LISTENERS ==========
function handleStudentAction(e) {
    const studentId = e.currentTarget.getAttribute("data-id");
        const action = e.currentTarget.getAttribute("data-action");
        
        if (action === "edit") {
            // Implement edit student functionality
            alert(`Edit student ${studentId}`);
        } else if (action === "delete") {
            // Implement delete student functionality
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
                        showToast("Student deleted successfully", "success")
                        loadStudents()
                    } else {
                        throw new Error("Failed to delete student")
                    }
                })
                .catch((error) => {
                    console.error(error)
                    showToast("Failed to delete student", "danger")
                })
            }
        }
}

function handleQuizAction(e) {}

function handleApprovalAction(studentId, status) {
    console.log(`Handling approval for student ID: ${studentId}, status: ${status}`);
    const action = status === "active" ? "approve" : "reject";
    const confirmationMessage = status === "active" 
        ? "Are you sure you want to approve this student?" 
        : "Are you sure you want to reject this student?";
    
    if (confirm(confirmationMessage)) {
        fetch(`${API_URL}/users/${studentId}/status`, {
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
                showToast(`Student ${action}d successfully`, "success");
                loadApprovals(); // Refresh the list
            } else {
                throw new Error(data.error || "Failed to update student status");
            }
        })
        .catch((error) => {
            console.error(error);
            showToast(`Error: ${error.message}`, "danger");
        });
    }
}



    



  // ========== HELPER FUNCTIONS ==========
  function fetchData(url, callback) {
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
          } else {
            throw new Error(response.statusText);
          }
        })
        .then((data) => {
          callback(data);
        })
        .catch((error) => {
          console.error(error);
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

  function showToast(message, type = "info") {
    const toastContainer = document.createElement("div");
    toastContainer.className = `toast show align-items-center text-white bg-${type}`;
    toastContainer.setAttribute("role", "alert");
    toastContainer.setAttribute("aria-live", "assertive");
    toastContainer.setAttribute("aria-atomic", "true");
    toastContainer.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    document.body.appendChild(toastContainer);
    setTimeout(() => {
        toastContainer.classList.remove("show");
        setTimeout(() => toastContainer.remove(), 300);
    }, 3000);
}

    // Initialize the dashboard
    init()
})


