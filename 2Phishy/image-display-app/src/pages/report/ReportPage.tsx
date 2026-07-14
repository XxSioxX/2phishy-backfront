import "./reportPage.scss";
import { Report } from "../../types";
import { api } from '../../services/api';
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface ReportWithResolved extends Report {
  resolved?: boolean;
}

const ReportPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.userid;
  const userRole = user?.role;
  const [studentReports, setStudentReports] = useState<ReportWithResolved[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const loadReports = useCallback(() => {
    (async () => {
      try {
        const backendReports = await api.getReports();
        let reportsWithStatus: ReportWithResolved[] = Array.isArray(backendReports) ? backendReports : [];

        if (!reportsWithStatus.some(r => 'resolved' in r)) {
          try {
            const resolvedReportsData = localStorage.getItem('resolvedReportsWithStatus');
            if (resolvedReportsData) {
              const savedReports = JSON.parse(resolvedReportsData);
              reportsWithStatus = reportsWithStatus.map((report: ReportWithResolved) => {
                const saved = savedReports.find((r: ReportWithResolved) => r.id === report.id);
                return { ...report, resolved: saved?.resolved || false };
              });
            }
          } catch (e) {
            console.error('Error merging resolved status from localStorage:', e);
          }
        }

        // Filter reports based on user role
        let filteredReports = reportsWithStatus;
        if (userRole === 'student') {
          filteredReports = reportsWithStatus.filter(report => report.studentId === userId);
        }

        setStudentReports(filteredReports);
      } catch (e) {
        console.error('Failed to load reports from backend:', e);
        setStudentReports([]);
      }
    })();
  }, [userId, userRole]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      loadReports();
    }
  }, [isAuthenticated, loadReports, userId]);

  useEffect(() => {
    const handleStorageChange = () => {
      console.log('Storage changed, reloading reports...');
      if (isAuthenticated && userId) {
        loadReports();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAuthenticated, loadReports, userId]);

  const handleMarkResolved = (reportId: string) => {
    (async () => {
      try {
        const updated = await api.updateReport(reportId, { resolved: true });
        setStudentReports(prev => prev.map(r => r.id === reportId ? { ...r, resolved: true, ...updated } : r));
        try {
          const existing = localStorage.getItem('resolvedReportsWithStatus');
          const arr = existing ? JSON.parse(existing) : [];
          const updatedArr = arr.filter((r: any) => r.id !== reportId).concat([{ id: reportId, resolved: true }]);
          localStorage.setItem('resolvedReportsWithStatus', JSON.stringify(updatedArr));
        } catch (e) {
          console.error('Failed to update local resolved cache:', e);
        }
        setExpandedReportId(null);
      } catch (e) {
        console.error('Failed to mark report resolved:', e);
        alert('Failed to mark report resolved');
      }
    })();
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
