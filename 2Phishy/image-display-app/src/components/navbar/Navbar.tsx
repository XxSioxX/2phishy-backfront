import "./navbar.scss";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from '../../services/api';
import { useAuth } from "../../contexts/AuthContext";
import { useMobileMenu } from "../../contexts/MobileMenuContext";
import { ReportWithResolved, Announcement } from "../../types";
import { generateAvatarUrl } from '../../utils/avatarUtils';
import { parseBackendDate } from '../../utils/dateUtils';

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

    const isCurrentUserOnline = (): boolean => {
        if (!isAuthenticated || !user) return false;

        const parsedLastSeen = parseBackendDate(user.last_seen);
        if (!parsedLastSeen) return true;

        return new Date().getTime() - parsedLastSeen.getTime() < 10 * 60 * 1000;
    };

    // Calculate notification count from backend (with localStorage fallback)
    useEffect(() => {
        const calculateNotifications = async () => {
            try {
                let newNotificationsCount = 0;
                let studentReports: ReportWithResolved[] = [];
                let studentReportStatus: ReportWithResolved[] = [];

                // Try fetching reports from backend first
                let allReports: any[] = [];
                try {
                    const backendReports = await api.getReports();
                    allReports = Array.isArray(backendReports) ? backendReports : [];
                } catch (e) {
                    console.warn('Failed to fetch reports from backend, falling back to localStorage:', e);
                    const stored = localStorage.getItem('studentReports');
                    allReports = stored ? JSON.parse(stored) : [];
                }

                // Merge resolved status if backend doesn't include it
                let reportsWithStatus: ReportWithResolved[] = allReports;
                if (!reportsWithStatus.some(r => 'resolved' in r)) {
                    try {
                        const resolvedReportsData = localStorage.getItem('resolvedReportsWithStatus');
                        if (resolvedReportsData) {
                            const resolvedReports = JSON.parse(resolvedReportsData);
                            reportsWithStatus = allReports.map((report: any) => {
                                const savedReport = resolvedReports.find((r: ReportWithResolved) => r.id === report.id);
                                return { ...report, resolved: savedReport?.resolved || false };
                            });
                        }
                    } catch (e) {
                        console.error('Error parsing resolved reports:', e);
                    }
                }

                if (user && (user.role === 'admin' || user.role === 'super-admin')) {
                    studentReports = reportsWithStatus.filter((r: ReportWithResolved) => !r.resolved);

                    const viewedNotificationsData = localStorage.getItem('viewedNotifications') || '{}';
                    const viewedNotifications = JSON.parse(viewedNotificationsData);
                    newNotificationsCount = studentReports.filter((r: ReportWithResolved) => !viewedNotifications[`report_${r.id}`]).length;
                } else if (user && user.role === 'student') {
                    studentReportStatus = reportsWithStatus.filter((report: ReportWithResolved) => report.username === user.username);

                    const viewedNotificationsData = localStorage.getItem('viewedNotifications') || '{}';
                    const viewedNotifications = JSON.parse(viewedNotificationsData);
                    newNotificationsCount = studentReportStatus.filter((r: ReportWithResolved) => r.resolved && !viewedNotifications[`report_${r.id}`]).length;
                }

                // Announcements: try backend then fallback
                let publishedAnnouncements: Announcement[] = [];
                try {
                    const backendAnnouncements = await api.getAnnouncements();
                    publishedAnnouncements = Array.isArray(backendAnnouncements)
                        ? backendAnnouncements.filter((a: Announcement) => a.isPublished && !a.isScheduled)
                        : [];
                } catch (e) {
                    const storedAnnouncements = localStorage.getItem('adminAnnouncements');
                    if (storedAnnouncements) {
                        const adminAnnouncements = JSON.parse(storedAnnouncements);
                        publishedAnnouncements = adminAnnouncements.filter((announcement: Announcement) =>
                            announcement.isPublished && !announcement.isScheduled
                        );
                    }
                }

                // Count NEW announcements (not viewed yet)
                const viewedNotificationsData = localStorage.getItem('viewedNotifications') || '{}';
                const viewedNotifications = JSON.parse(viewedNotificationsData);
                const newAnnouncementsCount = publishedAnnouncements.filter((_, index: number) => !viewedNotifications[`announcement_${index}`]).length;
                newNotificationsCount += newAnnouncementsCount;

                setNotificationCount(newNotificationsCount);
                setNotificationDetails({
                    reports: studentReports,
                    announcements: publishedAnnouncements,
                    studentReportStatus: studentReportStatus
                });
            } catch (e) {
                console.error('Failed to calculate notifications:', e);
            }
        };

        if (isAuthenticated && user) {
            calculateNotifications();
        }

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
                    <span className={`avatar-ring ${isCurrentUserOnline() ? 'online' : 'offline'}`}>
                        <img 
                            src={isAuthenticated && user?.username ? generateAvatarUrl(user.username, 36) : "/user.svg"} 
                            alt="User Avatar" 
                            className="user-avatar-mobile"
                        />
                    </span>
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
                    <span className={`avatar-ring ${isCurrentUserOnline() ? 'online' : 'offline'}`}>
                        <img 
                            src={isAuthenticated && user?.username ? generateAvatarUrl(user.username, 36) : "/user.svg"} 
                            alt="User Avatar" 
                            className="user-avatar"
                        />
                    </span>
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