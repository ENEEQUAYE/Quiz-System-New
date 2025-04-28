document.addEventListener("DOMContentLoaded", () => {
    // ========== AUTHENTICATION & INITIALIZATION ==========
    const token = localStorage.getItem("token")
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    console.log("Token:", token);
    console.log("User:", user);
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
  }

  function setupSearchHandlers() {
  }

  function setupPaginationHandlers() {}

  // ========== FORM HANDLERS ==========
  function handleQuizFormSubmit(event) {
    event.preventDefault()

  }
    

  // ========== DATA LOADING FUNCTIONS ==========
  function loadDashboardStats() {
    //Fetch students count
    fetchData(`${API_URL}/admin/students`, (data) => {
    document.getElementById("students-count").textContent = data.count;   
    })

    //Fetch pending-approvals-count
    fetchData(`${API_URL}/admin/approvals`, (data) => {
      document.getElementById("pending-approvals-count").textContent = data.count;
    })

    //Fetch quizzes count
    fetchData(`${API_URL}/quizzes`, (data) => {
      document.getElementById("quizzes-count").textContent = data.count;
    })

    //Fetch quiz-submissions count
    fetchData(`${API_URL}/quizzes/submissions`, (data) => {
      document.getElementById("quiz-submissions-count").textContent = data.count;
    })
    

    // Initialize calendar
    // initializeCalendar()
  }

  function loadStudents(page = 1, search = "") {
    const studentsTableBody = document.getElementById("students-table-body")
    if (!studentsTableBody) return

    // Show loading state
    studentsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>'

    //Fetch students from API
    fetchData(`${API_URL}/admin/students?page=${page}&search=${search}`, (data) => {
      // Clear loading state
      studentsTableBody.innerHTML = ""

      if (!data.data || data.data.length === 0) {
        studentsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No students found</td></tr>'
        return
      }

      // Populate table with student data
      data.data.forEach((student) => {
        const row = document.createElement("tr")
        row.innerHTML = `
          <td>${student.firstName} ${student.lastName}</td>
          <td>${student.email}</td>
          <td>${student.phone || 'N/A'}</td>
          <td>${new Date(student.createdAt).toLocaleDateString()}</td>
          <td>
              <span class="badge ${student.status === 'active' ? 'bg-success' : 'bg-warning'}">
                  ${student.status}
              </span>
          </td>
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
      })

      //// Update pagination
      updatePagination("students", data.pagination)

      // Add event listeners to edit and delete buttons
      document.querySelectorAll("#students-table-body [data-action]").forEach(btn => {
        btn.addEventListener("click", handleStudentAction);
    })
  })
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
