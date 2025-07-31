document.addEventListener("DOMContentLoaded", () => {
  // Use the API_URL from config.js instead of hardcoded URL
  // const API_URL = "https://quiz-system-new.onrender.com/api"; // Replace with your actual API URL
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Session expired. Please log in again.");
    window.location.href = "index.html";
    return;
  }

  // Get student ID from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get("studentId");

  if (!studentId) {
    alert("Invalid student ID.");
    window.location.href = "admin-dashboard.html";
    return;
  }

  // Fetch and display student report
  fetch(`${API_URL}/admin/students/${studentId}/report`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch student report.");
      }
      return response.json();
    })
    .then((data) => {
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch student report.");
      }

      // Populate student info
      document.getElementById("student-full-name").textContent = `${data.student.firstName} ${data.student.lastName}`;
      document.getElementById("student-email").textContent = data.student.email;
      document.getElementById("total-quizzes").textContent = data.report.length;
      document.getElementById("average-score").textContent = `${data.averageScore || 0}%`;
      document.getElementById("grade").textContent = data.grade || "N/A";

      // Populate transcript table
      const submissionsTableBody = document.getElementById("submissions-table-body");
      submissionsTableBody.innerHTML = ""; // Clear loading state

      if (data.report.length === 0) {
        submissionsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">No quiz submissions found.</td></tr>`;
        return;
      }

      data.report.forEach((submission, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${submission.quizTitle}</td>
          <td>${submission.percentage}%</td>
          <td>${new Date(submission.timeCompleted).toLocaleDateString()}</td>
        `;
        submissionsTableBody.appendChild(row);
      });
    })
    .catch((error) => {
      console.error("Error loading student report:", error);
      alert("Failed to load student report. Please try again.");
    });


});