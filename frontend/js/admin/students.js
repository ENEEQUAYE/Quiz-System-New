// Students Module
document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('students')) {
        initStudentsModule();
    }
});

function initStudentsModule() {
    // Constants
    const API_URL = "http://localhost:5000/api";
    const token = localStorage.getItem("token");
    let currentPage = 1;
    let currentSearch = '';
    let totalPages = 1;

    // Initialize
    setupEventListeners();
    loadStudents();

    // Event Listeners
    function setupEventListeners() {
        // Search input
        document.getElementById('search-students').addEventListener('input', function(e) {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            loadStudents();
        });

        // Pagination buttons
        document.getElementById('prev-page-btn').addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                loadStudents();
            }
        });

        document.getElementById('next-page-btn').addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                loadStudents();
            }
        });
    }

    // Load Students Data
       function loadStudents() {
        const tbody = document.getElementById('students-table-body');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading students...</td></tr>';
    
              fetch(`${API_URL}/admin/students?page=${currentPage}&search=${currentSearch}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    console.error("Token expired or invalid. Redirecting to login.");
                    localStorage.removeItem("token");
                    window.location.href = "index.html";
                }
                throw new Error('Failed to fetch students');
            }
            return response.json();
        })
        .then(data => {
            renderStudents(data.students);
            updatePagination(data.pagination);
        })
        .catch(error => {
            console.error('Error loading students:', error);
            showToast('Failed to load students', 'danger');
        });
    }

    // Render Students Table
    function renderStudents(students) {
        const tbody = document.getElementById('students-table-body');
        
        if (!students || students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No students found</td></tr>';
            return;
        }

        tbody.innerHTML = students.map(student => `
            <tr>
                <td>${student.firstName} ${student.lastName}</td>
                <td>${student.email}</td>
                <td>${student.phone || 'N/A'}</td>
                <td>${formatDate(student.enrollmentDate || student.createdAt)}</td>
                <td>
                    <span class="badge ${getStatusBadgeClass(student.status)}">
                        ${student.status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary edit-student" data-id="${student._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-student" data-id="${student._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Add event listeners to action buttons
        document.querySelectorAll('.edit-student').forEach(btn => {
            btn.addEventListener('click', handleEditStudent);
        });

        document.querySelectorAll('.delete-student').forEach(btn => {
            btn.addEventListener('click', handleDeleteStudent);
        });
    }

    // Update Pagination Controls
    function updatePagination(pagination) {
        totalPages = pagination.totalPages;
        currentPage = pagination.currentPage;
        
        document.getElementById('page-num').textContent = currentPage;
        document.getElementById('prev-page-btn').disabled = currentPage <= 1;
        document.getElementById('next-page-btn').disabled = currentPage >= totalPages;
    }

    // Student Actions
    function handleEditStudent(e) {
        const studentId = e.currentTarget.getAttribute('data-id');
        // Implementation would open edit modal
        showEditStudentModal(studentId);
    }

    function handleDeleteStudent(e) {
        const studentId = e.currentTarget.getAttribute('data-id');
        
        if (confirm('Are you sure you want to delete this student?')) {
            fetch(`${API_URL}/admin/students/${studentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to delete student');
                showToast('Student deleted successfully', 'success');
                loadStudents();
            })
            .catch(error => {
                console.error('Error deleting student:', error);
                showToast('Failed to delete student', 'danger');
            });
        }
    }

    // Helper Functions
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    function getStatusBadgeClass(status) {
        switch(status.toLowerCase()) {
            case 'active': return 'bg-success';
            case 'pending': return 'bg-warning';
            case 'suspended': return 'bg-secondary';
            case 'rejected': return 'bg-danger';
            default: return 'bg-info';
        }
    }

    function showToast(message, type = 'info') {
        // Toast implementation (same as dashboard)
    }

    // Modal Functions (would be in separate modal.js file)
    function showEditStudentModal(studentId) {
        // Implementation for edit modal
    }
}