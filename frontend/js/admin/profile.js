// Profile Module
document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('profile')) {
        initProfileModule();
    }
});

function initProfileModule() {
    // Constants
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const API_URL = "http://localhost:5000/api";

    // Initialize
    loadProfile();
    setupEventListeners();

    // Load Profile Data
    function loadProfile() {
        // Show loading state
        document.getElementById('profile-name').textContent = 'Loading...';
        document.getElementById('profile-email').innerHTML = '<i class="fas fa-envelope"></i> Loading...';
        document.getElementById('profile-phone').innerHTML = '<i class="fas fa-phone"></i> Loading...';
        document.getElementById('profile-position').innerHTML = '<i class="fas fa-user-tie"></i> Loading...';

        // Fetch current user data
        fetch(`${API_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch profile');
            return response.json();
        })
        .then(data => {
            updateProfileUI(data.user);
            // Update local storage with fresh data
            localStorage.setItem("user", JSON.stringify(data.user));
        })
        .catch(error => {
            console.error('Error loading profile:', error);
            updateProfileUI(user); // Fallback to cached data
            showToast('Failed to load profile data', 'danger');
        });
    }

    // Update Profile UI
    function updateProfileUI(userData) {
        if (!userData) return;

        // Profile picture
        const profileImg = document.querySelector('.profile-image');
        if (userData.profilePicture) {
            profileImg.src = userData.profilePicture.startsWith('http') ? 
                userData.profilePicture : 
                `${API_URL}/${userData.profilePicture}`;
        }

        // Profile details
        document.getElementById('profile-name').textContent = 
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Admin';
        
        document.getElementById('profile-email').innerHTML = 
            `<i class="fas fa-envelope"></i> ${userData.email || 'N/A'}`;
        
        document.getElementById('profile-phone').innerHTML = 
            `<i class="fas fa-phone"></i> ${userData.phone || 'N/A'}`;
        
        document.getElementById('profile-position').innerHTML = 
            `<i class="fas fa-user-tie"></i> ${userData.position || 'N/A'}`;
    }

    // Event Listeners
    function setupEventListeners() {
        // Change Profile Picture
        document.getElementById('change-profile-pic-btn').addEventListener('click', function() {
            document.getElementById('profile-pic-upload').click();
        });

        document.getElementById('profile-pic-upload').addEventListener('change', handleProfilePictureUpload);

        // Edit Profile button (modal handled separately)
    }

    // Profile Picture Upload
    function handleProfilePictureUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profilePicture', file);

        // Show loading state
        const submitBtn = document.getElementById('change-profile-pic-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        submitBtn.disabled = true;

        fetch(`${API_URL}/users/me/profile-picture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to upload profile picture');
            return response.json();
        })
        .then(data => {
            // Update profile picture
            document.querySelector('.profile-image').src = data.profilePicture;
            // Update user in local storage
            const user = JSON.parse(localStorage.getItem("user"));
            user.profilePicture = data.profilePicture;
            localStorage.setItem("user", JSON.stringify(user));
            
            showToast('Profile picture updated successfully', 'success');
        })
        .catch(error => {
            console.error('Error uploading profile picture:', error);
            showToast('Failed to update profile picture', 'danger');
        })
        .finally(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            e.target.value = ''; // Reset file input
        });
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
}