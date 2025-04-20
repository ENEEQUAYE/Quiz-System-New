document.addEventListener("DOMContentLoaded", function() {
    // Constants
    const API_URL = window.API_URL || "http://localhost:5000/api";
    const token = localStorage.getItem("token");
    
    // DOM Elements
    const elements = {
        saveBtn: document.getElementById('save-quiz'),
        questionsContainer: document.getElementById('questions-container'),
        addQuestionBtn: document.getElementById('add-question'),
        noQuestionsMsg: document.getElementById('no-questions'),
        questionTemplate: document.getElementById('question-template')
    };

    // State
    let questions = [];
    let isEditMode = false;
    let currentQuizId = null;

    // Initialize
    checkEditMode();
    setupEventListeners();
    initSortable();

    function checkEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('id')) {
            isEditMode = true;
            currentQuizId = urlParams.get('id');
            document.getElementById('page-title').textContent = 'Edit Quiz';
            loadQuizData(currentQuizId);
        }
    }

    function loadQuizData(quizId) {
        // Implement quiz loading logic
    }

    function setupEventListeners() {
        // Save quiz
        elements.saveBtn.addEventListener('click', saveQuiz);
        
        // Add question
        elements.addQuestionBtn.addEventListener('click', addNewQuestion);
    }

    function initSortable() {
        new Sortable(elements.questionsContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            handle: '.move-question',
            onEnd: updateQuestionNumbers
        });
    }

    function addNewQuestion() {
        const newQuestion = elements.questionTemplate.cloneNode(true);
        newQuestion.classList.remove('d-none');
        
        // Add to DOM
        elements.questionsContainer.insertBefore(newQuestion, elements.noQuestionsMsg);
        elements.noQuestionsMsg.classList.add('d-none');
        
        // Add event listeners
        addQuestionEventListeners(newQuestion);
        
        // Add first option's event listeners
        const firstOption = newQuestion.querySelector('.option-item');
        firstOption.querySelector('.remove-option').addEventListener('click', function() {
            showToast('Each question must have at least one option', 'warning');
        });
        firstOption.querySelector('.correct-option').addEventListener('change', function() {
            if (this.checked) {
                this.closest('.option-item').classList.add('option-correct');
            }
        });
        
        // Auto-select first option as correct
        firstOption.querySelector('.correct-option').checked = true;
        firstOption.querySelector('.correct-option').dispatchEvent(new Event('change'));
        
        // Focus question text input
        newQuestion.querySelector('.question-text').focus();
        
        updateQuestionNumbers();
    }
    function addQuestionEventListeners(questionElement) {
        // Delete question button
        questionElement.querySelector('.delete-question').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this question?')) {
                questionElement.remove();
                updateQuestionNumbers();
                
                // Show "no questions" message if empty
                if (document.querySelectorAll('.question-card:not(.d-none)').length === 0) {
                    elements.noQuestionsMsg.classList.remove('d-none');
                }
            }
        });
    
        // Add option button
        questionElement.querySelector('.add-option').addEventListener('click', () => {
            addNewOption(questionElement);
        });
    
        // Remove option buttons (for existing options)
        questionElement.querySelectorAll('.remove-option').forEach(btn => {
            btn.addEventListener('click', function() {
                if (this.closest('.options-container').children.length > 1) {
                    this.closest('.option-item').remove();
                    validateQuestionOptions(questionElement);
                } else {
                    showToast('Each question must have at least one option', 'warning');
                }
            });
        });
    
        // Correct answer selection
        questionElement.querySelectorAll('.correct-option').forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    // Update visual indication
                    this.closest('.option-item').classList.add('option-correct');
                    
                    // Remove highlight from other options
                    this.closest('.options-container').querySelectorAll('.option-item').forEach(item => {
                        if (item !== this.closest('.option-item')) {
                            item.classList.remove('option-correct');
                        }
                    });
                }
            });
        });
    }
    
    function addNewOption(questionElement) {
        const optionsContainer = questionElement.querySelector('.options-container');
        const optionTemplate = optionsContainer.querySelector('.option-item').cloneNode(true);
        
        // Clear input values
        optionTemplate.querySelector('.option-text').value = '';
        optionTemplate.querySelector('.correct-option').checked = false;
        optionTemplate.classList.remove('option-correct');
        
        // Add event listener for the new remove button
        optionTemplate.querySelector('.remove-option').addEventListener('click', function() {
            if (optionsContainer.children.length > 1) {
                this.closest('.option-item').remove();
                validateQuestionOptions(questionElement);
            } else {
                showToast('Each question must have at least one option', 'warning');
            }
        });
        
        // Add event listener for the new correct answer radio
        optionTemplate.querySelector('.correct-option').addEventListener('change', function() {
            if (this.checked) {
                this.closest('.option-item').classList.add('option-correct');
                
                // Remove highlight from other options
                optionsContainer.querySelectorAll('.option-item').forEach(item => {
                    if (item !== this.closest('.option-item')) {
                        item.classList.remove('option-correct');
                    }
                });
            }
        });
        
        // Add to DOM
        optionsContainer.appendChild(optionTemplate);
        
        // Auto-focus the new option input
        optionTemplate.querySelector('.option-text').focus();
        
        // Validate
        validateQuestionOptions(questionElement);
    }
    
    function validateQuestionOptions(questionElement) {
        const options = questionElement.querySelectorAll('.option-text');
        const hasEmptyOption = Array.from(options).some(opt => !opt.value.trim());
        
        if (hasEmptyOption) {
            questionElement.querySelector('.add-option').disabled = true;
            showToast('All options must have text before adding new ones', 'warning');
        } else {
            questionElement.querySelector('.add-option').disabled = false;
        }
        
        // Check if at least one option is marked correct
        const hasCorrectAnswer = questionElement.querySelector('.correct-option:checked') !== null;
        if (!hasCorrectAnswer && options.length > 0) {
            // Auto-select first option if none is selected
            questionElement.querySelector('.correct-option').checked = true;
            questionElement.querySelector('.correct-option').dispatchEvent(new Event('change'));
        }
    }

    function updateQuestionNumbers() {
        // Get all visible question cards
        const questions = document.querySelectorAll('.question-card:not(.d-none)');
        
        questions.forEach((question, index) => {
            // Update the displayed number
            const questionNumberElement = question.querySelector('.question-number');
            questionNumberElement.textContent = `Question #${index + 1}`;
            
            // Update any hidden data attributes if needed
            question.dataset.questionNumber = index + 1;
            
            // Update the question order in our data model
            if (questions[index]._questionData) {
                questions[index]._questionData.order = index + 1;
            }
        });
        
        // Enable/disable move buttons based on position
        questions.forEach((question, index) => {
            const moveUpBtn = question.querySelector('.move-up');
            const moveDownBtn = question.querySelector('.move-down');
            
            if (moveUpBtn) moveUpBtn.disabled = index === 0;
            if (moveDownBtn) moveDownBtn.disabled = index === questions.length - 1;
        });
    }

    function validateQuiz() {
        // Implement validation logic
    }

    function saveQuiz() {
        if (!validateQuiz()) return;
        
        const quizData = {
            title: document.getElementById('quiz-title').value,
            description: document.getElementById('quiz-description').value,
            order: parseInt(document.getElementById('quiz-order').value),
            isActive: document.getElementById('quiz-active').checked,
            questions: gatherQuestionsData() // Implement this to collect questions
        };
    
        const method = isEditMode ? 'PUT' : 'POST';
        const url = isEditMode ? `${API_URL}/quizzes/${currentQuizId}` : `${API_URL}/quizzes`;
        
        fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(quizData)
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to save quiz');
            return response.json();
        })
        .then(data => {
            showToast('Quiz saved successfully! Redirecting...', 'success');
            
            // Redirect after 1.5 seconds (allows toast to be seen)
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 1500);
        })
        .catch(error => {
            console.error('Error saving quiz:', error);
            showToast(error.message || 'Failed to save quiz', 'danger');
        });
    }
    
    // Helper function to gather questions data
    function gatherQuestionsData() {
        const questions = [];
        
        document.querySelectorAll('.question-card:not(.d-none)').forEach(questionEl => {
            const options = [];
            let correctAnswerIndex = -1;
            
            questionEl.querySelectorAll('.option-item').forEach((optionEl, index) => {
                const optionText = optionEl.querySelector('.option-text').value.trim();
                const isCorrect = optionEl.querySelector('.correct-option').checked;
                
                options.push(optionText);
                if (isCorrect) correctAnswerIndex = index;
            });
            
            questions.push({
                questionText: questionEl.querySelector('.question-text').value.trim(),
                options,
                correctAnswer: correctAnswerIndex,
                points: parseInt(questionEl.querySelector('.question-points').value) || 1,
                order: parseInt(questionEl.dataset.questionNumber) || questions.length + 1
            });
        });
        
        return questions;
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast show align-items-center text-white bg-${type}`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    
});