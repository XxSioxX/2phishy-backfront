import React, { useState, useEffect } from "react";
import "./student-report.scss";
import { useAuth } from "../../contexts/AuthContext";
import { api } from '../../services/api';
import { getCurrentDatePH } from "../../utils/dateUtils";

interface StudentReport {
  id: string;
  message: string;
  status: "High" | "Mid" | "Low";
  date: string;
  type: "Bug" | "Exploit" | "Behavior";
  user_id: string;
  resolved?: boolean;
}

const StudentReport: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    message: "",
    status: "Mid" as "High" | "Mid" | "Low",
    type: "Bug" as "Bug" | "Exploit" | "Behavior"
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchMyReports();
  }, []);

  const fetchMyReports = async () => {
    try {
      setIsLoading(true);
      // Fetch from backend and filter by current user
      try {
        const backendReports = await api.getReports();
        const allReports: StudentReport[] = Array.isArray(backendReports) ? backendReports : [];
        let userReports = allReports.filter(report => report.user_id === user?.userid);
        setReports(userReports);
      } catch (e) {
        console.error('Failed to fetch reports from backend, falling back to localStorage:', e);
        // Fallback to localStorage for offline/dev
        const storedReports = localStorage.getItem('studentReports');
        if (storedReports) {
          const allReports: StudentReport[] = JSON.parse(storedReports);
          const userReports = allReports.filter(report => report.user_id === user?.userid);
          setReports(userReports);
        } else {
          setReports([]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.message.trim()) {
      newErrors.message = "Report message is required";
    } else if (formData.message.trim().length < 10) {
      newErrors.message = "Report message must be at least 10 characters";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const payload = {
        message: formData.message,
        status: formData.status,
        type: formData.type,
        date: getCurrentDatePH(),
        studentId: user?.userid || ''
      };

      const created = await api.createReport(payload);
      setReports(prev => [created, ...prev]);
      setFormData({ message: "", status: "Mid", type: "Bug" });
      setShowForm(false);
    } catch (error) {
      console.error("Failed to create report:", error);
      setErrors({ general: "Failed to create report. Please try again." });
    }
  };

  const handleDelete = async (reportId: string) => {
    if (window.confirm("Are you sure you want to delete this report?")) {
      try {
        // Try deleting via backend and fall back to localStorage
        try {
          await api.deleteReport(reportId);
          setReports(prev => prev.filter(report => report.id !== reportId));
        } catch (e) {
          console.warn('Failed to delete report via backend, falling back to localStorage:', e);
          const storedReports = localStorage.getItem('studentReports');
          const allReports: StudentReport[] = storedReports ? JSON.parse(storedReports) : [];
          const updatedReports = allReports.filter(report => report.id !== reportId);
          localStorage.setItem('studentReports', JSON.stringify(updatedReports));
          setReports(prev => prev.filter(report => report.id !== reportId));
        }
      } catch (error) {
        console.error("Failed to delete report:", error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "High": return "#e74c3c";
      case "Mid": return "#f39c12";
      case "Low": return "#2ecc71";
      default: return "#95a5a6";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Bug": return "#e74c3c";
      case "Exploit": return "#9b59b6";
      case "Behavior": return "#3498db";
      default: return "#95a5a6";
    }
  };

  if (isLoading) {
    return (
      <div className="student-report">
        <div className="student-report-container">
          <h1>My Reports</h1>
          <p>Loading your reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-report">
      <div className="student-report-container">
        <div className="header">
          <h1>My Reports</h1>
          <button 
            className="add-report-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Cancel" : "Add New Report"}
          </button>
        </div>

        {showForm && (
          <div className="report-form-section">
            <h2>Create New Report</h2>
            {errors.general && (
              <div className="error-message general">
                {errors.general}
              </div>
            )}
            <form onSubmit={handleSubmit} className="report-form">
              <div className="form-group">
                <label htmlFor="type">Report Type</label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                >
                  <option value="Bug">Bug Report</option>
                  <option value="Exploit">Security Issue</option>
                  <option value="Behavior">Feature Request</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="status">Priority</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="Low">Low</option>
                  <option value="Mid">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message">Report Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Describe the issue or suggestion..."
                  rows={4}
                  className={errors.message ? "error" : ""}
                />
                {errors.message && (
                  <div className="error-message">{errors.message}</div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit">Submit Report</button>
              </div>
            </form>
          </div>
        )}

        <div className="reports-list">
          {/* Pending Reports Section */}
          <div className="reports-section">
            <h2>Pending Reports ({reports.filter(r => !r.resolved).length})</h2>
            {reports.filter(r => !r.resolved).length === 0 ? (
              <div className="no-reports">
                <p>No pending reports.</p>
              </div>
            ) : (
              <div className="reports-grid">
                {reports.filter(r => !r.resolved).map((report) => (
                  <div key={report.id} className="report-card">
                    <div className="report-header">
                      <div className="report-meta">
                        <span 
                          className="type-badge"
                          style={{ backgroundColor: getTypeColor(report.type) }}
                        >
                          {report.type}
                        </span>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(report.status) }}
                        >
                          {report.status}
                        </span>
                      </div>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDelete(report.id)}
                        title="Delete Report"
                      >
                        ×
                      </button>
                    </div>
                    <div className="report-content">
                      <p>{report.message}</p>
                    </div>
                    <div className="report-footer">
                      <span className="date">{report.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved Reports Section */}
          {reports.filter(r => r.resolved).length > 0 && (
            <div className="reports-section">
              <h2>Resolved Reports ({reports.filter(r => r.resolved).length})</h2>
              <div className="reports-grid">
                {reports.filter(r => r.resolved).map((report) => (
                  <div key={report.id} className="report-card resolved">
                    <div className="report-header">
                      <div className="report-meta">
                        <span 
                          className="type-badge"
                          style={{ backgroundColor: getTypeColor(report.type) }}
                        >
                          {report.type}
                        </span>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(report.status) }}
                        >
                          {report.status}
                        </span>
                      </div>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDelete(report.id)}
                        title="Delete Report"
                      >
                        ×
                      </button>
                    </div>
                    <div className="report-content">
                      <p>{report.message}</p>
                    </div>
                    <div className="report-footer">
                      <span className="date">{report.date}</span>
                      <span className="resolved-badge">✓ Resolved</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentReport;
