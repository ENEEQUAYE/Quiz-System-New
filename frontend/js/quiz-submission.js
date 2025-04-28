document.addEventListener("DOMContentLoaded", () => {
  // Authentication check
  const token = localStorage.getItem("token")
  const user = JSON.parse(localStorage.getItem("user") || "{}")
  const API_URL = "https://quiz-system-new.onrender.com/api"

  if (!token || !user || user.role !== "student") {
    showToast("Session expired. Please log in again.", "danger")
    setTimeout(() => {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      window.location.href = "index.html"
    }, 2000)
    return
  }

  // Get submission ID from URL
  const urlParams = new URLSearchParams(window.location.search)
  const submissionId = urlParams.get("id")

  if (!submissionId) {
    showToast("Invalid submission ID", "danger")
    setTimeout(() => {
      window.location.href = "student-dashboard.html"
    }, 2000)
    return
  }

  // Load submission data
  loadSubmission()

  // Event listeners
  document.getElementById("back-btn").addEventListener("click", () => {
    window.history.back()
  })

  document.getElementById("print-btn").addEventListener("click", () => {
    window.print()
  })

  function loadSubmission() {
    fetch(`${API_URL}/submissions/${submissionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        if (!data.success) {
          throw new Error(data.error || "Failed to load submission")
        }

        // Display submission data
        displaySubmission(data.data)
      })
      .catch((error) => {
        console.error("Error loading submission:", error)
        showToast("Failed to load submission: " + error.message, "danger")
        setTimeout(() => {
          window.location.href = "student-dashboard.html"
        }, 2000)
      })
  }

  function displaySubmission(submission) {
    const submissionContent = document.getElementById("submission-content")

    // Update title
    document.getElementById("submission-title").textContent = `${submission.quiz.title} - Submission`

    // Calculate percentage
    const percentage = submission.percentage
    const isPassed = submission.passed

    // Create submission content
    let content = `
            <div class="result-card">
                <div class="result-header">
                    <h3>${submission.quiz.title}</h3>
                    <p class="mb-0">Submitted on ${new Date(submission.submittedAt).toLocaleString()}</p>
                </div>
                <div class="result-body">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="result-stat">
                                <h4>Score</h4>
                                <p>${submission.score}/${submission.totalPossible}</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="result-stat">
                                <h4>Percentage</h4>
                                <p>${percentage}%</p>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="result-stat ${isPassed ? "passed" : "failed"}">
                                <h4>Status</h4>
                                <p>${isPassed ? "PASSED" : "FAILED"}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <h5>Summary</h5>
                        <div class="row">
                            <div class="col-md-6">
                                <ul class="list-group">
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        Total Questions
                                        <span class="badge bg-primary rounded-pill">${submission.totalQuestions}</span>
                                    </li>
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        Correct Answers
                                        <span class="badge bg-success rounded-pill">${submission.correctAnswers}</span>
                                    </li>
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        Incorrect Answers
                                        <span class="badge bg-danger rounded-pill">${submission.incorrectAnswers}</span>
                                    </li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <ul class="list-group">
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        Unanswered Questions
                                        <span class="badge bg-secondary rounded-pill">${submission.unansweredQuestions || 0}</span>
                                    </li>
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        Time Spent
                                        <span class="badge bg-info rounded-pill">${formatTime(submission.timeSpent || 0)}</span>
                                    </li>
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        Passing Score
                                        <span class="badge bg-primary rounded-pill">${submission.quiz.passingScore || 70}%</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `

    // Add question review section
    content += `
            <div class="question-review">
                <h4 class="mb-4">Question Review</h4>
        `

    // Add each question
    submission.quiz.questions.forEach((question, index) => {
      const userAnswer = submission.answers[index]
      const correctAnswer = question.correctAnswer
      const isCorrect = userAnswer === correctAnswer
      const isUnanswered = userAnswer === -1

      const statusClass = isUnanswered ? "unanswered" : isCorrect ? "correct" : "incorrect"
      const statusIcon = isUnanswered
        ? '<i class="fas fa-minus-circle text-secondary"></i>'
        : isCorrect
          ? '<i class="fas fa-check-circle text-success"></i>'
          : '<i class="fas fa-times-circle text-danger"></i>'

      content += `
                <div class="review-item ${statusClass}">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="mb-0">Question ${index + 1}</h5>
                        <span>${statusIcon} ${isUnanswered ? "Unanswered" : isCorrect ? "Correct" : "Incorrect"}</span>
                    </div>
                    <div class="review-question">${question.questionText}</div>
                    <div class="review-options">
            `

      // Add each option
      question.options.forEach((option, optionIndex) => {
        let optionClass = ""
        if (optionIndex === correctAnswer) {
          optionClass = "correct"
        }
        if (optionIndex === userAnswer && optionIndex !== correctAnswer) {
          optionClass = "selected"
        }

        content += `
                    <div class="review-option ${optionClass}">
                        <span class="me-2">${String.fromCharCode(65 + optionIndex)}.</span>
                        ${option}
                        ${optionIndex === correctAnswer ? ' <i class="fas fa-check text-success ms-2"></i>' : ""}
                        ${optionIndex === userAnswer && optionIndex !== correctAnswer ? ' <i class="fas fa-times text-danger ms-2"></i>' : ""}
                    </div>
                `
      })

      content += `
                    </div>
            `

      // Add explanation if available
      if (question.explanation) {
        content += `
                    <div class="review-feedback">
                        <strong>Explanation:</strong> ${question.explanation}
                    </div>
                `
      }

      content += `
                </div>
            `
    })

    content += `
            </div>
        `

    submissionContent.innerHTML = content
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    let timeString = ""
    if (hours > 0) {
      timeString += `${hours}h `
    }
    timeString += `${minutes}m ${remainingSeconds}s`

    return timeString
  }

  function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toast-container")
    const toastElement = document.createElement("div")
    toastElement.className = `toast show align-items-center text-white bg-${type}`
    toastElement.setAttribute("role", "alert")
    toastElement.setAttribute("aria-live", "assertive")
    toastElement.setAttribute("aria-atomic", "true")
    toastElement.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `

    toastContainer.appendChild(toastElement)
    setTimeout(() => {
      toastElement.classList.remove("show")
      setTimeout(() => toastElement.remove(), 300)
    }, 3000)
  }
})
