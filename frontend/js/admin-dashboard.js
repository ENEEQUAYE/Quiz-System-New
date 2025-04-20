document.addEventListener("DOMContentLoaded", () => {

     const API_URL = "http://localhost:5000/api";


    // Stats elements
    const studentsCountEl = document.getElementById("students-count");
    const pendingApprovalsCountEl = document.getElementById("pending-approvals-count");
    const quizzesCountEl = document.getElementById("quizzes-count");
    const quizSubmissionsCountEl = document.getElementById("quiz-submissions-count");

    // Table elements
    const studentsTableBody = document.getElementById("students-table-body");
    const approvalsTableBody = document.getElementById("approvals-table-body");
    const quizzesTableBody = document.getElementById("quizzes-table-body");
    const administratorsTableBody = document.getElementById("administrators-table-body");

    // Search elements
    const searchStudentsInput = document.getElementById("search-students");
    const searchApprovalsInput = document.getElementById("search-approvals");
    const searchQuizzesInput = document.getElementById("search-quizzes");
    const searchAdministratorsInput = document.getElementById("search-administrators");

    // Modal elements
    const createQuizModal = new bootstrap.Modal(document.getElementById('createQuizModal'));
    const createAdminModal = new bootstrap.Modal(document.getElementById('createAdminModal'));
    const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));

    // ========== INITIALIZATION FUNCTIONS ==========
    function init() {
        setupEventListeners();
        loadDashboardStats();
    }

    // ========== DASHBOARD FUNCTIONS ==========
    async function loadDashboardStats() {
        try {
            const headers = {
                "Authorization": `Bearer ${token}`
            };
            
            // Fetch all data in parallel
            const [studentsRes, approvalsRes, quizzesRes, submissionsRes] = await Promise.all([
                fetch(`${API_URL}/admin/students`, { headers }),
                fetch(`${API_URL}/admin/approvals`, { headers }),
                fetch(`${API_URL}/quizzes`, { headers }),
                fetch(`${API_URL}/quizzes/submissions`, { headers })
            ]);
            
            if (!studentsRes.ok || !approvalsRes.ok || !quizzesRes.ok || !submissionsRes.ok) {
                throw new Error("Failed to fetch dashboard stats");
            }
            
            const [students, approvals, quizzes, submissions] = await Promise.all([
                studentsRes.json(),
                approvalsRes.json(),
                quizzesRes.json(),
                submissionsRes.json()
            ]);
            
            // Update stats
            studentsCountEl.textContent = students.length;
            pendingApprovalsCountEl.textContent = approvals.length;
            quizzesCountEl.textContent = quizzes.length;
            quizSubmissionsCountEl.textContent = submissions.length;
            
        } catch (error) {
            console.error("Error loading dashboard stats:", error);
            showToast("Failed to load dashboard data", "error");
        }
    }

    // ========== STUDENT MANAGEMENT ==========
    async function loadStudents(searchTerm = "") {
        try {
            const url = searchTerm 
                ? `${API_URL}/admin/students?search=${encodeURIComponent(searchTerm)}` 
                : `${API_URL}/admin/students`;
                
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error("Failed to load students");
            
            const students = await response.json();
            renderStudentsTable(students);
            
        } catch (error) {
            console.error("Error loading students:", error);
            showToast("Failed to load students", "error");
        }
    }

    function renderStudentsTable(students) {
        studentsTableBody.innerHTML = "";
        
        if (students.length === 0) {
            studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No students found</td>
                </tr>
            `;
            return;
        }
        
        students.forEach(student => {
            const row = document.createElement("tr");
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
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll("#students-table-body [data-action]").forEach(btn => {
            btn.addEventListener("click", handleStudentAction);
        });
    }

    function handleStudentAction(e) {
        const studentId = e.currentTarget.getAttribute("data-id");
        const action = e.currentTarget.getAttribute("data-action");
        
        if (action === "edit") {
            // Implement edit student functionality
            alert(`Edit student ${studentId}`);
        } else if (action === "delete") {
            if (confirm("Are you sure you want to delete this student?")) {
                deleteStudent(studentId);
            }
        }
    }

    async function deleteStudent(studentId) {
        try {
            const response = await fetch(`${API_URL}/admin/students/${studentId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error("Failed to delete student");
            
            showToast("Student deleted successfully", "success");
            loadStudents();
        } catch (error) {
            console.error("Error deleting student:", error);
            showToast("Failed to delete student", "error");
        }
    }

    // ========== APPROVAL MANAGEMENT ==========
    async function loadApprovals(searchTerm = "") {
        try {
            const url = searchTerm 
                ? `${API_URL}/admin/approvals?search=${encodeURIComponent(searchTerm)}` 
                : `${API_URL}/admin/approvals`;
                
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error("Failed to load approvals");
            
            const approvals = await response.json();
            renderApprovalsTable(approvals);
            
        } catch (error) {
            console.error("Error loading approvals:", error);
            showToast("Failed to load approvals", "error");
        }
    }

    function renderApprovalsTable(approvals) {
        approvalsTableBody.innerHTML = "";
        
        if (approvals.length === 0) {
            approvalsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">No pending approvals</td>
                </tr>
            `;
            return;
        }
        
        approvals.forEach(student => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${student.firstName} ${student.lastName}</td>
                <td>${student.email}</td>
                <td>${student.phone || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-success me-2" data-id="${student._id}" data-action="approve">
                        Approve
                    </button>
                    <button class="btn btn-sm btn-danger" data-id="${student._id}" data-action="reject">
                        Reject
                    </button>
                </td>
            `;
            approvalsTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll("#approvals-table-body [data-action]").forEach(btn => {
            btn.addEventListener("click", handleApprovalAction);
        });
    }

    async function handleApprovalAction(e) {
        const studentId = e.currentTarget.getAttribute("data-id");
        const action = e.currentTarget.getAttribute("data-action");
        
        try {
            const response = await fetch(`${API_URL}/admin/approvals/${studentId}`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: action === "approve" ? "active" : "rejected"
                })
            });
            
            if (!response.ok) throw new Error(`Failed to ${action} student`);
            
            showToast(`Student ${action}d successfully`, "success");
            loadApprovals();
            loadDashboardStats(); // Refresh stats
            
        } catch (error) {
            console.error(`Error ${action}ing student:`, error);
            showToast(`Failed to ${action} student`, "error");
        }
    }

    // ========== QUIZ MANAGEMENT ==========
    async function loadQuizzes(searchTerm = "") {
        try {
            const url = searchTerm 
                ? `${API_URL}/quizzes?search=${encodeURIComponent(searchTerm)}` 
                : `${API_URL}/quizzes`;
                
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error("Failed to load quizzes");
            
            const quizzes = await response.json();
            renderQuizzesTable(quizzes);
            
        } catch (error) {
            console.error("Error loading quizzes:", error);
            showToast("Failed to load quizzes", "error");
        }
    }

    function renderQuizzesTable(quizzes) {
        quizzesTableBody.innerHTML = "";
        
        if (quizzes.length === 0) {
            quizzesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No quizzes found</td>
                </tr>
            `;
            return;
        }
        
        quizzes.forEach(quiz => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${quiz.title}</td>
                <td>${quiz.questions.length}</td>
                <td>${quiz.order}</td>
                <td>${new Date(quiz.createdAt).toLocaleDateString()}</td>
                <td>${quiz.submissions || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary" data-id="${quiz._id}" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger ms-2" data-id="${quiz._id}" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-info ms-2" data-id="${quiz._id}" data-action="manage">
                        <i class="fas fa-users"></i>
                    </button>
                </td>
            `;
            quizzesTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll("#quizzes-table-body [data-action]").forEach(btn => {
            btn.addEventListener("click", handleQuizAction);
        });
    }

    function handleQuizAction(e) {
        const quizId = e.currentTarget.getAttribute("data-id");
        const action = e.currentTarget.getAttribute("data-action");
        
        if (action === "edit") {
            editQuiz(quizId);
        } else if (action === "delete") {
            if (confirm("Are you sure you want to delete this quiz?")) {
                deleteQuiz(quizId);
            }
        } else if (action === "manage") {
            manageQuizAccess(quizId);
        }
    }

    async function deleteQuiz(quizId) {
        try {
            const response = await fetch(`${API_URL}/quizzes/${quizId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error("Failed to delete quiz");
            
            showToast("Quiz deleted successfully", "success");
            loadQuizzes();
            loadDashboardStats(); // Refresh stats
            
        } catch (error) {
            console.error("Error deleting quiz:", error);
            showToast("Failed to delete quiz", "error");
        }
    }

    // ========== ADMINISTRATOR MANAGEMENT ==========
    async function loadAdministrators(searchTerm = "") {
        try {
            const url = searchTerm 
                ? `${API_URL}/admin/administrators?search=${encodeURIComponent(searchTerm)}` 
                : `${API_URL}/admin/administrators`;
                
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error("Failed to load administrators");
            
            const admins = await response.json();
            renderAdministratorsTable(admins);
            
        } catch (error) {
            console.error("Error loading administrators:", error);
            showToast("Failed to load administrators", "error");
        }
    }

    function renderAdministratorsTable(admins) {
        administratorsTableBody.innerHTML = "";
        
        if (admins.length === 0) {
            administratorsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No administrators found</td>
                </tr>
            `;
            return;
        }
        
        admins.forEach(admin => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${admin.firstName} ${admin.lastName}</td>
                <td>${admin.email}</td>
                <td>${admin.phone || 'N/A'}</td>
                <td>${admin.position || 'Administrator'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" data-id="${admin._id}" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${admin._id !== user._id ? `
                    <button class="btn btn-sm btn-danger ms-2" data-id="${admin._id}" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </td>
            `;
            administratorsTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll("#administrators-table-body [data-action]").forEach(btn => {
            btn.addEventListener("click", handleAdminAction);
        });
    }

    // ========== EVENT LISTENERS AND UTILITIES ==========
    function setupEventListeners() {
        // Search functionality
        searchStudentsInput.addEventListener("input", debounce(() => {
            loadStudents(searchStudentsInput.value);
        }, 300));
        
        searchApprovalsInput.addEventListener("input", debounce(() => {
            loadApprovals(searchApprovalsInput.value);
        }, 300));
        
        searchQuizzesInput.addEventListener("input", debounce(() => {
            loadQuizzes(searchQuizzesInput.value);
        }, 300));
        
        searchAdministratorsInput.addEventListener("input", debounce(() => {
            loadAdministrators(searchAdministratorsInput.value);
        }, 300));
        
        // Create quiz button
        document.getElementById("add-quiz-btn").addEventListener("click", () => {
            createQuizModal.show();
        });
        
        // Create admin button
        document.getElementById("add-administrator-btn").addEventListener("click", () => {
            createAdminModal.show();
        });
        
        // Edit profile button
        document.getElementById("edit-profile-btn").addEventListener("click", () => {
            populateProfileForm();
            editProfileModal.show();
        });
    }

    function debounce(func, timeout = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
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
    init();
});