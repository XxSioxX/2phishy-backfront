import "./reportPage.scss";
import { Report } from "../../types";
import { getReportsFromStorage } from "../../data";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface ReportWithResolved extends Report {
  resolved?: boolean;
}

const ReportPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [studentReports, setStudentReports] = useState<ReportWithResolved[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const loadReports = () => {
    console.log('Loading reports from localStorage...');
    // Get fresh reports from studentReports storage
    const freshReports = getReportsFromStorage();
    
    // Get reports with resolved status
    const resolvedReportsData = localStorage.getItem('resolvedReportsWithStatus');
    let reportsWithStatus: ReportWithResolved[] = [...freshReports];
    
    if (resolvedReportsData) {
      try {
        const savedReports = JSON.parse(resolvedReportsData);
        // Merge: add resolved status to fresh reports
        reportsWithStatus = freshReports.map((report: Report) => {
          const savedReport = savedReports.find((r: ReportWithResolved) => r.id === report.id);
          return {
            ...report,
            resolved: savedReport?.resolved || false
          };
        });
      } catch (e) {
        console.error('Error parsing resolved reports:', e);
      }
    }

    // Filter reports based on user role
    let filteredReports = reportsWithStatus;
    if (user && user.role === 'student') {
      // Students only see their own reports
      filteredReports = reportsWithStatus.filter(report => report.username === user.username);
    }
    // Admins/super-admins see all reports (no filtering)

    console.log('Reports found:', filteredReports);
    setStudentReports(filteredReports);
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      loadReports();
    }
  }, [isAuthenticated, user]);

  // Listen for storage changes to update reports in real-time
  useEffect(() => {
    const handleStorageChange = () => {
      console.log('Storage changed, reloading reports...');
      if (isAuthenticated && user) {
        loadReports();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAuthenticated, user]);

  const handleMarkResolved = (reportId: string) => {
    const updatedReports = studentReports.map(report => 
      report.id === reportId ? { ...report, resolved: true } : report
    );
    setStudentReports(updatedReports);
    // Save with resolved status so it persists
    localStorage.setItem('resolvedReportsWithStatus', JSON.stringify(updatedReports));
    setExpandedReportId(null); // Close dropdown after marking resolved
  };

  const toggleReportExpand = (reportId: string) => {
    setExpandedReportId(expandedReportId === reportId ? null : reportId);
  };

  const newReports = studentReports.filter(report => !report.resolved);
  const resolvedReports = studentReports.filter(report => report.resolved);

  return (
    <div className="reportPage">
      <div className="headerWithButton">
        <h1>{user && user.role === 'student' ? 'My Reports' : 'Student Reports'}</h1>
        <div className="button-group">
          <button className="clearButton" onClick={loadReports}>Refresh</button>
          {user && (user.role === 'admin' || user.role === 'super-admin') && (
            <button className="clearButton" onClick={() => {
              localStorage.removeItem('studentReports');
              loadReports();
            }}>Clear All</button>
          )}
        </div>
      </div>

      {/* New Reports Section */}
      <div className="reportSection">
        <h2 className="sectionTitle">New Reports</h2>
        <div className="reportList">
          {newReports.length === 0 ? (
            <div className="no-reports">
              <p>No new reports</p>
            </div>
          ) : (
            newReports.map((report) => (
              <div key={report.id} className="reportItem">
                <div 
                  className="reportTitle" 
                  onClick={() => toggleReportExpand(report.id)}
                >
                  <span className={`expandIcon ${expandedReportId === report.id ? 'expanded' : ''}`}>
                    ▶
                  </span>
                  <span className="titleText">{report.message.substring(0, 50)}{report.message.length > 50 ? '...' : ''}</span>
                  <span className="reportStatusBadge high">High</span>
                </div>
                
                {expandedReportId === report.id && (
                  <div className="reportDetails">
                    <div className="detailRow">
                      <span className="label">ID:</span>
                      <span className="value">{report.id}</span>
                    </div>
                    <div className="detailRow">
                      <span className="label">Message:</span>
                      <span className="value">{report.message}</span>
                    </div>
                    <div className="detailRow">
                      <span className="label">Reported by:</span>
                      <span className="value">{report.username || 'Unknown Student'}</span>
                    </div>
                    <div className="detailRow">
                      <span className="label">Type:</span>
                      <span className="value">{report.type}</span>
                    </div>
                    <div className="detailRow">
                      <span className="label">Date:</span>
                      <span className="value">{report.date}</span>
                    </div>
                    {user && (user.role === 'admin' || user.role === 'super-admin') && (
                      <button 
                        className="resolveButton" 
                        onClick={() => handleMarkResolved(report.id)}
                      >
                        Mark as Resolved
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resolved Reports Section */}
      {resolvedReports.length > 0 && (
        <div className="reportSection">
          <h2 className="sectionTitle">Resolved Reports</h2>
          <div className="reportList">
            {resolvedReports.map((report) => (
              <div key={report.id} className="reportItem resolved">
                <div 
                  className="reportTitle" 
                  onClick={() => toggleReportExpand(report.id)}
                >
                  <span className={`expandIcon ${expandedReportId === report.id ? 'expanded' : ''}`}>
                    ▶
                  </span>
                  <span className="titleText">{report.message.substring(0, 50)}{report.message.length > 50 ? '...' : ''}</span>
                  <span className="reportStatusBadge resolved">✓ Resolved</span>
                </div>
                
                {expandedReportId === report.id && (
                  <div className="reportDetails">
                    <div className="detailRow">
                      <span className="label">ID:</span>
                      <span className="value">{report.id}</span>
                    </div>
                    <div className="detailRow">
                      <span className="label">Message:</span>
                      <span className="value">{report.message}</span>
                    </div>
                    <div className="detailRow">
                      <span className="label">Reported by:</span>
                      <span className="value">{report.username || 'Unknown Student'}</span>
                    </div>
                    <div className="detailRow">
                      <span className="label">Type:</span>
                      <span className="value">{report.type}</span>
                    </div>
                    <div className="detailRow">
                      <span className="label">Date:</span>
                      <span className="value">{report.date}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPage;
