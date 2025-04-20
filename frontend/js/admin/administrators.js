// Administrators Module
document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('administrators')) {
        initAdministratorsModule();
    }
});

function initAdministratorsModule() {
    // Constants
    const token = localStorage.getItem("token");
    const API_URL = "http://localhost:5000/api";
    let currentPage = 1;
    let currentSearch = '';
    let totalPages = 1;


    // Initialize
    setupEventListeners();
    loadAdministrators();

    // Event Listeners
    function setupEventListeners() {
        // Search input
        document.getElementById('search-administrators').addEventListener('input', function(e) {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            loadAdministrators();
        });

        // Pagination buttons
        document.getElementById('prev-page-btn').addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                loadAdministrators();
            }
        });

        document.getElementById('next-page-btn').addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                loadAdministrators();
            }
        });

        // Add Administrator button (modal handled separately)
    }

    // Load Administrators Data
    function loadAdministrators() {
        const tbody = document.getElementById('administrators-table-body');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading administrators...</td></tr>';

        fetch(`${API_URL}/admin/administrators?page=${currentPage}&search=${currentSearch}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch administrators');
            return response.json();
        })
        .then(data => {
            renderAdministrators(data.administrators);
            updatePagination(data.pagination);
        })
        .catch(error => {
            console.error('Error loading administrators:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load administrators</td></tr>';
            showToast('Failed to load administrators', 'danger');
        });
    }

    // Render Administrators Table
    function renderAdministrators(administrators) {
        const tbody = document.getElementById('administrators-table-body');
        
        if (!administrators || administrators.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No administrators found</td></tr>';
            return;
        }

        tbody.innerHTML = administrators.map(admin => `
            <tr>
                <td>${admin.firstName} ${admin.lastName}</td>
                <td>${admin.email}</td>
                <td>${admin.phone || 'N/A'}</td>
                <td>${admin.position || 'N/A'}</td>
                <td class="admin-actions">
                    <button class="btn btn-sm btn-primary edit-admin" data-id="${admin._id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${admin._id !== JSON.parse(localStorage.getItem("user"))._id ? 
                    `<button class="btn btn-sm btn-danger delete-admin" data-id="${admin._id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>` : ''}
                </td>
            </tr>
        `).join('');

        // Add event listeners to action buttons
        document.querySelectorAll('.edit-admin').forEach(btn => {
            btn.addEventListener('click', handleEditAdmin);
        });

        document.querySelectorAll('.delete-admin').forEach(btn => {
            btn.addEventListener('click', handleDeleteAdmin);
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

    // Administrator Actions
    function handleEditAdmin(e) {
        const adminId = e.currentTarget.getAttribute('data-id');
        // Implementation would open edit modal
        showEditAdminModal(adminId);
    }

    function handleDeleteAdmin(e) {
        const adminId = e.currentTarget.getAttribute('data-id');
        const currentUser = JSON.parse(localStorage.getItem("user"));
        
        if (adminId === currentUser._id) {
            showToast('You cannot delete your own account', 'warning');
            return;
        }

        if (confirm('Are you sure you want to delete this administrator?')) {
            fetch(`${API_URL}/admin/administrators/${adminId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to delete administrator');
                showToast('Administrator deleted successfully', 'success');
                loadAdministrators();
            })
            .catch(error => {
                console.error('Error deleting administrator:', error);
                showToast('Failed to delete administrator', 'danger');
            });
        }
    }

    // Helper Functions
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast show align-items-center text-white bg-${type}`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function showEditAdminModal(adminId) {
        // Implementation would fetch admin details and show modal
        console.log('Edit admin:', adminId);
    }
}