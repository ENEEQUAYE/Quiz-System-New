document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('quizzes')) {
      initQuizzesModule();
    }
  });
  
  function initQuizzesModule() {
    // Configuration
    const config = {
      API_URL: window.API_URL || "http://localhost:5000/api",
      ITEMS_PER_PAGE: 10,
      DEBOUNCE_TIME: 300
    };
  
    // State
    const state = {
      token: localStorage.getItem("token"),
      currentPage: 1,
      currentSearch: '',
      activeOnly: true,
      totalPages: 1,
      isLoading: false
    };
  
    // DOM Elements
    const elements = {
      tableBody: document.getElementById('quizzes-table-body'),
      searchInput: document.getElementById('search-quizzes'),
      activeFilter: document.getElementById('active-filter'),
      prevBtn: document.getElementById('prev-page-btn'),
      nextBtn: document.getElementById('next-page-btn'),
      pageNum: document.getElementById('page-num'),
      createBtn: document.getElementById('create-quiz-btn')
    };
  
    // Initialize
    setupEventListeners();
    loadQuizzes();
  
    // Event Listeners
    function setupEventListeners() {
      // Debounced search
      elements.searchInput.addEventListener('input', 
        debounce(handleSearch, config.DEBOUNCE_TIME));
      
      // Active filter toggle
      elements.activeFilter.addEventListener('change', (e) => {
        state.activeOnly = e.target.checked;
        state.currentPage = 1;
        loadQuizzes();
      });
  
      // Pagination
      elements.prevBtn.addEventListener('click', goToPreviousPage);
      elements.nextBtn.addEventListener('click', goToNextPage);
      
      // Create quiz button
      if (elements.createBtn) {
        elements.createBtn.addEventListener('click', () => {
          window.location.href = '/quiz-create.html';
        });
      }
    }
  
    // Data Loading
    async function loadQuizzes() {
      if (state.isLoading) return;
      state.isLoading = true;
  
      showLoadingState();
      
      try {
        const query = new URLSearchParams({
          page: state.currentPage,
          search: state.currentSearch,
          activeOnly: state.activeOnly
        }).toString();
  
        const response = await fetch(
          `${config.API_URL}/quizzes?${query}`,
          {
            headers: {
              'Authorization': `Bearer ${state.token}`,
              'Content-Type': 'application/json'
            }
          }
        );
  
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch quizzes');
        }
        
        const data = await response.json();
        renderQuizzes(data.quizzes);
        updatePagination(data.pagination);
      } catch (error) {
        showErrorState(error);
      } finally {
        state.isLoading = false;
      }
    }
  
    // UI Rendering
    function renderQuizzes(quizzes) {
      if (!quizzes || quizzes.length === 0) {
        elements.tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4">
              <i class="fas fa-inbox me-2"></i>
              No quizzes found
            </td>
          </tr>`;
        return;
      }
  
      elements.tableBody.innerHTML = quizzes.map(quiz => `
        <tr class="${quiz.isActive ? '' : 'table-secondary'}">
          <td>${quiz.title}</td>
          <td>${quiz.description || '-'}</td>
          <td>${quiz.questionCount}</td>
          <td>${quiz.order}</td>
          <td>${formatDateTime(quiz.createdAt)}</td>
          <td>${quiz.createdBy}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-primary edit-quiz me-1" 
                    data-id="${quiz._id}" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-info view-quiz me-1" 
                    data-id="${quiz._id}" title="Preview">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger delete-quiz" 
                    data-id="${quiz._id}" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
  
      // Add dynamic event listeners
      addQuizActionHandlers();
    }
  
    function updatePagination(pagination) {
      state.totalPages = pagination.totalPages;
      elements.pageNum.textContent = state.currentPage;
      elements.prevBtn.disabled = state.currentPage <= 1;
      elements.nextBtn.disabled = state.currentPage >= state.totalPages;
    }
  
    // Event Handlers
    function handleSearch(e) {
      state.currentSearch = e.target.value.trim();
      state.currentPage = 1;
      loadQuizzes();
    }
  
    function goToPreviousPage() {
      if (state.currentPage > 1) {
        state.currentPage--;
        loadQuizzes();
      }
    }
  
    function goToNextPage() {
      if (state.currentPage < state.totalPages) {
        state.currentPage++;
        loadQuizzes();
      }
    }
  
    function addQuizActionHandlers() {
      // Edit Quiz
      document.querySelectorAll('.edit-quiz').forEach(btn => {
        btn.addEventListener('click', () => {
          window.location.href = `quiz-edit.html?id=${btn.dataset.id}`;
        });
      });
  
      // View Quiz
      document.querySelectorAll('.view-quiz').forEach(btn => {
        btn.addEventListener('click', () => {
          window.location.href = `quiz-view.html?id=${btn.dataset.id}`;
        });
      });
  
      // Delete Quiz
      document.querySelectorAll('.delete-quiz').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteQuiz(btn.dataset.id));
      });
    }
  
    async function handleDeleteQuiz(quizId) {
      if (!confirm('Are you sure you want to delete this quiz?\nThis action cannot be undone.')) {
        return;
      }
      
      try {
        const response = await fetch(`${config.API_URL}/quizzes/${quizId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${state.token}`
          }
        });
  
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete quiz');
        }
        
        const result = await response.json();
        showToast(result.message || 'Quiz deleted successfully', 'success');
        loadQuizzes(); // Refresh the list
      } catch (error) {
        console.error('Delete error:', error);
        showToast(error.message || 'Failed to delete quiz', 'danger');
      }
    }
  
    // UI States
    function showLoadingState() {
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2">Loading quizzes...</div>
          </td>
        </tr>`;
    }
  
    function showErrorState(error) {
      console.error('Quiz load error:', error);
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-danger py-4">
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${error.message || 'Failed to load quizzes'}
          </td>
        </tr>`;
      showToast(error.message || 'Failed to load quizzes', 'danger');
    }
  
    // Utility Functions
    function formatDateTime(dateString) {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  
    function debounce(func, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  
    function showToast(message, type = 'info') {
      // Implement using your preferred toast library
      const toast = document.createElement('div');
      toast.className = `toast show align-items-center text-white bg-${type}`;
      toast.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                  data-bs-dismiss="toast"></button>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  }