import "./reportPage.scss";
import { Report } from "../../types";
import { getReportsFromStorage } from "../../data";
import { useState, useEffect } from "react";

const ReportPage: React.FC = () => {
  const [studentReports, setStudentReports] = useState<Report[]>([]);

  const loadReports = () => {
    console.log('Loading reports from localStorage...');
    const reportsFromStorage = getReportsFromStorage();
    console.log('Reports found:', reportsFromStorage);
    setStudentReports(reportsFromStorage);
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Listen for storage changes to update reports in real-time
  useEffect(() => {
    const handleStorageChange = () => {
      console.log('Storage changed, reloading reports...');
      loadReports();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="reportPage">
      <div className="headerWithButton">
        <h1>Student Reports</h1>
        <div className="button-group">
          <button className="clearButton" onClick={loadReports}>Refresh</button>
          <button className="clearButton" onClick={() => {
            localStorage.removeItem('studentReports');
            loadReports();
          }}>Clear All</button>
        </div>
      </div>
      <div className="reportGrid">
        {studentReports.length === 0 ? (
          <div className="no-reports">
            <p>No student reports found</p>
          </div>
        ) : (
          studentReports.map((report) => (
            <div key={report.id} className="reportCard">
              <div className="reportId">ID: {report.id}</div>
              <div className="reportMessage">{report.message}</div>
              <div className="reportUser">Reported by: {report.username || 'Unknown Student'}</div>
              <div className={`reportStatus ${report.status.toLowerCase()}`}>
                Status: {report.status}
              </div>
              <div className="reportDate">Date: {report.date}</div>
              <div className="reportType">Type: {report.type}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReportPage;
