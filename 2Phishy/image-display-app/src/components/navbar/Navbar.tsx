import "./navbar.scss";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getReportsFromStorage } from "../../data";
import { useAuth } from "../../contexts/AuthContext";
import { useMobileMenu } from "../../contexts/MobileMenuContext";
import { Report, ReportWithResolved, Announcement } from "../../types";

const Navbar = () => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [notificationDetails, setNotificationDetails] = useState<{
        reports: ReportWithResolved[];
        announcements: Announcement[];
        studentReportStatus?: ReportWithResolved[];
    }>({ reports: [], announcements: [] });
    const { user, isAuthenticated } = useAuth();
    const { toggleMobileMenu } = useMobileMenu();

    // Calculate notification count from localStorage data
    useEffect(() => {
        const calculateNotifications = () => {
            let newNotificationsCount = 0;
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
                
                // Count NEW unresolved reports (not viewed yet)
                const viewedNotificationsData = localStorage.getItem('viewedNotifications') || '{}';
                const viewedNotifications = JSON.parse(viewedNotificationsData);
                newNotificationsCount = studentReports.filter((r: ReportWithResolved) => !viewedNotifications[`report_${r.id}`]).length;
            } 
            // Students see if their reports were resolved
            else if (user && user.role === 'student') {
                const allReports = getReportsFromStorage();
                studentReportStatus = allReports.filter((report: Report) => report.username === user.username);
                
                // Count NEW resolved reports (not viewed yet)
                const viewedNotificationsData = localStorage.getItem('viewedNotifications') || '{}';
                const viewedNotifications = JSON.parse(viewedNotificationsData);
                newNotificationsCount = studentReportStatus.filter((r: ReportWithResolved) => r.resolved && !viewedNotifications[`report_${r.id}`]).length;
            }

            // Get admin announcements count (published only)
            const storedAnnouncements = localStorage.getItem('adminAnnouncements');
            let publishedAnnouncements: Announcement[] = [];
            if (storedAnnouncements) {
                const adminAnnouncements = JSON.parse(storedAnnouncements);
                publishedAnnouncements = adminAnnouncements.filter((announcement: Announcement) =>
                    announcement.isPublished && !announcement.isScheduled
                );
                
                // Count NEW announcements (not viewed yet)
                const viewedNotificationsData = localStorage.getItem('viewedNotifications') || '{}';
                const viewedNotifications = JSON.parse(viewedNotificationsData);
                const newAnnouncementsCount = publishedAnnouncements.filter((_, index: number) => !viewedNotifications[`announcement_${index}`]).length;
                newNotificationsCount += newAnnouncementsCount;
            }

            setNotificationCount(newNotificationsCount);
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

    const handleNotificationClick = () => {
        // Mark all notifications as viewed
        const viewedNotifications = JSON.parse(localStorage.getItem('viewedNotifications') || '{}');
        
        // Mark reports as viewed
        notificationDetails.reports.forEach((report: ReportWithResolved) => {
            viewedNotifications[`report_${report.id}`] = true;
        });
        
        // Mark student reports as viewed
        notificationDetails.studentReportStatus?.forEach((report: ReportWithResolved) => {
            if (report.resolved) {
                viewedNotifications[`report_${report.id}`] = true;
            }
        });
        
        // Mark announcements as viewed
        notificationDetails.announcements.forEach((_, index: number) => {
            viewedNotifications[`announcement_${index}`] = true;
        });
        
        localStorage.setItem('viewedNotifications', JSON.stringify(viewedNotifications));
        
        // Update badge count
        setNotificationCount(0);
    };



    return(
        <div className="navbar">
            <div className="navbar-left">
                <button 
                    className="menu-toggle"
                    onClick={toggleMobileMenu}
                    aria-label="Toggle menu"
                    title="Toggle menu"
                >
                    ☰
                </button>
                <div className="logo">
                    <img src="/logo1.png" alt="" />
                    <span>2Phishy</span>
                </div>
                <div className="user-mobile">
                    <img src="user.svg" alt="" />
                    <span>{isAuthenticated ? user?.username || 'User' : 'Guest'}</span>
                </div>
            </div>
            <div className="icons">
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
                                        {notificationCount} New Notification{notificationCount !== 1 ? 's' : ''}
                                    </div>
                                    {/* Admin/Super-admin see reports */}
                                    {user && (user.role === 'admin' || user.role === 'super-admin') && notificationDetails.reports.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-section-title">📋 Reports ({notificationDetails.reports.length})</div>
                                            {notificationDetails.reports.map((report: ReportWithResolved) => (
                                                <div key={report.id} className="report-item">
                                                    <div className="report-type">{report.type || 'Report'}</div>
                                                    <div className="report-message">{report.message.substring(0, 40)}...</div>
                                                    <div className="report-meta">From: {report.username} | {report.status}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Students see their own report status */}
                                    {user && user.role === 'student' && notificationDetails.studentReportStatus && notificationDetails.studentReportStatus.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-section-title">📋 Your Reports</div>
                                            {notificationDetails.studentReportStatus.map((report: ReportWithResolved) => (
                                                <div key={report.id} className="report-status-item">
                                                    <div className="status-badge">
                                                        <span className="status-icon">{report.resolved ? '✓' : '⏳'}</span>
                                                        <span className={`status-text ${report.resolved ? 'resolved' : 'pending'}`}>
                                                            {report.resolved ? 'Resolved' : 'Pending'}
                                                        </span>
                                                    </div>
                                                    <span className="report-text">{report.message.substring(0, 30)}...</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {notificationDetails.announcements.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-section-title">📢 Announcements ({notificationDetails.announcements.length})</div>
                                            {notificationDetails.announcements.map((_, index: number) => (
                                                <div key={`announcement_${index}`} className="announcement-item">
                                                    <div className="announcement-badge">New Announcement #{index + 1}</div>
                                                </div>
                                            ))}
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