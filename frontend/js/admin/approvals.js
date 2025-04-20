// Approvals Module - Updated to Match Backend
document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('approvals')) {
        initApprovalsModule();
    }
});

function initApprovalsModule() {
    // Constants
    const API_URL = "http://localhost:5000/api";
    const token = localStorage.getItem("token");
    let currentPage = 1;
    let currentSearch = '';
    let totalPages = 1;

    // Initialize
    setupEventListeners();
    loadPendingApprovals();

    // Event Listeners
    function setupEventListeners() {
        // Search input
        document.getElementById('search-approvals').addEventListener('input', debounce(function(e) {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            loadPendingApprovals();
        }, 300));

        // Pagination buttons
        document.getElementById('prev-page-btn').addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                loadPendingApprovals();
            }
        });

        document.getElementById('next-page-btn').addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                loadPendingApprovals();
            }
        });
    }

    // Load Pending Approvals Data
    function loadPendingApprovals() {
        const tbody = document.getElementById('approvals-table-body');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading approvals...</td></tr>';

        fetch(`${API_URL}/users/pending?page=${currentPage}&search=${currentSearch}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(response.statusText);
            return response.json();
        })
        .then(data => {
            renderApprovals(data.approvals);
            updatePagination(data.pagination);
        })
        .catch(error => {
            console.error('Error loading approvals:', error);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load approvals</td></tr>';
            showToast('Failed to load pending approvals', 'danger');
        });
    }

    // Render Approvals Table
    function renderApprovals(approvals) {
        const tbody = document.getElementById('approvals-table-body');
        
        if (!approvals || approvals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No pending approvals found</td></tr>';
            return;
        }

        tbody.innerHTML = approvals.map(student => `
            <tr>
                <td>${student.firstName} ${student.lastName}</td>
                <td>${student.email}</td>
                <td>${student.phone || 'N/A'}</td>
                <td class="approval-actions">
                    <button class="btn btn-sm btn-success approve-btn" data-id="${student._id}">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-sm btn-danger reject-btn" data-id="${student._id}">
                        <i class="fas fa-times"></i> Reject
                    </button>
                    <button class="btn btn-sm btn-info view-btn" data-id="${student._id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `).join('');

        // Add event listeners to action buttons
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', () => handleStatusUpdate(btn.dataset.id, 'active'));
        });

        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', () => handleStatusUpdate(btn.dataset.id, 'inactive'));
        });

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', handleView);
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

    // Handle Approval/Rejection
    function handleStatusUpdate(studentId, status) {
        const action = status === 'active' ? 'approve' : 'reject';
        
        fetch(`${API_URL}/users/${studentId}/status`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        })
        .then(response => {
          if (!response.ok) throw new Error(response.statusText);
          return response.json();
        })
        .then(data => {
          showToast(`Student ${action}d successfully`, 'success');
          loadPendingApprovals(); // Refresh the list
        })
        .catch(error => {
          showToast(`Error: ${error.message}`, 'danger');
        });
      }

    // View Student Details
    function handleView(e) {
        const studentId = e.currentTarget.getAttribute('data-id');
        fetch(`${API_URL}/users/${studentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            // Implement modal display here
            console.log('Student details:', data);
            showStudentDetailsModal(data);
        })
        .catch(error => {
            console.error('Error fetching student details:', error);
            showToast('Failed to load student details', 'danger');
        });
    }

    // Helper Functions
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container') || createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast show align-items-center text-white bg-${type}`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1100';
        document.body.appendChild(container);
        return container;
    }

    function debounce(func, timeout = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }

    function showStudentDetailsModal(student) {
        // Implement your modal logic here
        console.log('Showing details for:', student);
        /* Example:
        const modal = new bootstrap.Modal(document.getElementById('studentModal'));
        document.getElementById('modal-name').textContent = `${student.firstName} ${student.lastName}`;
        // ... populate other fields
        modal.show();
        */
    }
}