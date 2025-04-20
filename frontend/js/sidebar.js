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
     
      setupSidebar()
      setupMenuNavigation()
      setupEventListeners()
      initializeCalendar()
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
    // Initialize the dashboard
    init()
})
