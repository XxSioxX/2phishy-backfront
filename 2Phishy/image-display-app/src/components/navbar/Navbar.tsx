import "./navbar.scss";
import { Link } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { getReportsFromStorage } from "../../data";
import { useAuth } from "../../contexts/AuthContext";
import { Report, ReportWithResolved, Announcement } from "../../types";

const Navbar = () => {
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showTooltip, setShowTooltip] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [notificationDetails, setNotificationDetails] = useState<{
        reports: ReportWithResolved[];
        announcements: Announcement[];
        studentReportStatus?: ReportWithResolved[];
    }>({ reports: [], announcements: [] });
    const { user, isAuthenticated } = useAuth();

    // Calculate notification count from localStorage data
    useEffect(() => {
        const calculateNotifications = () => {
            let reportsCount = 0;
            let studentReports: ReportWithResolved[] = [];
            let studentReportStatus: ReportWithResolved[] = [];

            // Admins see unresolved reports only
            if (user && (user.role === 'admin' || user.role === 'super-admin')) {
                const allReports = getReportsFromStorage();
                // Get resolved status
                const resolvedReportsData = localStorage.getItem('resolvedReportsWithStatus');
                let reportsWithStatus = allReports;
                
                if (resolvedReportsData) {
                    try {
                        const resolvedReports = JSON.parse(resolvedReportsData);
                reportsWithStatus = allReports.map((report: Report) => {
                    const savedReport = resolvedReports.find((r: ReportWithResolved) => r.id === report.id);
                    return {
                        ...report,
                        resolved: savedReport?.resolved || false
                    };
                });
                    } catch (e) {
                        console.error('Error parsing resolved reports:', e);
                    }
                }
                
                studentReports = reportsWithStatus.filter((r: ReportWithResolved) => !r.resolved); // Only unresolved
                reportsCount = studentReports.length;
            } 
            // Students see if their reports were resolved
            else if (user && user.role === 'student') {
                const allReports = getReportsFromStorage();
                studentReportStatus = allReports.filter((report: Report) => report.username === user.username);
                reportsCount = studentReportStatus.filter((r: ReportWithResolved) => r.resolved).length; // Count resolved reports to notify student
            }

            // Get admin announcements count (published only)
            const storedAnnouncements = localStorage.getItem('adminAnnouncements');
            let announcementsCount = 0;
            let publishedAnnouncements: Announcement[] = [];
            if (storedAnnouncements) {
                const adminAnnouncements = JSON.parse(storedAnnouncements);
                publishedAnnouncements = adminAnnouncements.filter((announcement: Announcement) =>
                    announcement.isPublished && !announcement.isScheduled
                );
                announcementsCount = publishedAnnouncements.length;
            }

            setNotificationCount(reportsCount + announcementsCount);
            setNotificationDetails({
                reports: studentReports,
                announcements: publishedAnnouncements,
                studentReportStatus: studentReportStatus
            });
        };

        if (isAuthenticated && user) {
            calculateNotifications();
        }

        // Listen for storage changes to update notifications in real-time
        const handleStorageChange = () => {
            if (isAuthenticated && user) {
                calculateNotifications();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [isAuthenticated, user]);

    const handleSearchClick = () => {
        setShowSearch((prev) => !prev);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            document.documentElement.requestFullscreen().catch((err) => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            // Exit fullscreen
            document.exitFullscreen().catch((err) => {
                console.error('Error attempting to exit fullscreen:', err);
            });
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Search query:", searchQuery);
        // You can add your search logic here
    };

    const handleNotificationClick = () => {
        // Clear notifications by setting count to 0
        setNotificationCount(0);
        // Optionally, you could also clear the actual data or mark as read
        // For now, we'll just hide the notification badge
    };


    return(
        <div className="navbar">
            <div className="logo">
                <img src="/logo1.png" alt="" />
                <span>2Phishy</span>
            </div>
            <div className="icons">
                <img src="/search.svg" className="icon" onClick={handleSearchClick} style={{ cursor: "pointer" }} />
                {showSearch && (
                    <form className="search-form" onSubmit={handleSearchSubmit}>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            autoFocus
                        />
                    </form>
                )}
                <img src="/app.svg" className="icon" />
                <img 
                    src="/expand.svg" 
                    className="icon" 
                    onClick={toggleFullscreen}
                    style={{ cursor: 'pointer' }}
                    title="Toggle Fullscreen (F11)"
                />
                <div
                    className="notification"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    onClick={handleNotificationClick}
                    style={{ position: "relative", cursor: "pointer" }}
                >
                    <img src="/notifications.svg" className="icon" />
                    {notificationCount > 0 && (
                        <span>{notificationCount}</span>
                    )}
                    {showTooltip && (
                        <div className="custom-tooltip">
                            {notificationCount > 0 ? (
                                <div>
                                    <div className="tooltip-header">
                                        {notificationCount} Notifications
                                    </div>
                                    {/* Admin/Super-admin see reports */}
                                    {user && (user.role === 'admin' || user.role === 'super-admin') && notificationDetails.reports.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-section-title">📋 Reports ({notificationDetails.reports.length})</div>
                                        </div>
                                    )}
                                    {/* Students see their own report status */}
                                    {user && user.role === 'student' && notificationDetails.studentReportStatus && notificationDetails.studentReportStatus.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-section-title">📋 Your Reports</div>
                                            {notificationDetails.studentReportStatus.map((report: ReportWithResolved) => (
                                                <div key={report.id} className="report-status-item">
                                                    <span>{report.resolved ? '✓' : '⏳'} {report.message.substring(0, 20)}...</span>
                                                    <span className={report.resolved ? 'status-resolved' : 'status-pending'}>{report.resolved ? 'Resolved' : 'Pending'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {notificationDetails.announcements.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-section-title">📢 Announcements ({notificationDetails.announcements.length})</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                'No new notifications'
                            )}
                        </div>
                    )}
                </div>
                <div className="user">
                    <img src="user.svg" alt="" />
                    <span>{isAuthenticated ? user?.username || 'User' : 'Guest'}</span>
                    {isAuthenticated && user?.role && (
                        <span className="user-role">({user.role})</span>
                    )}
                </div>
                {isAuthenticated ? (
                    <Link 
                        to={user?.role === 'student' ? "/student-settings" : "/settings"} 
                        className="icon settings-link" 
                        title="Settings"
                    >
                        <img src="/settings.svg" alt="Settings" />
                    </Link>
                ) : (
                    <Link to="/login" className="login-link">
                        Login
                    </Link>
                )}
            </div>
        </div>
    );
};

export default Navbar;