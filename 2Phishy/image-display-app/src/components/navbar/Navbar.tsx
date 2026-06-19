import "./navbar.scss";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { api } from '../../services/api';
import { useAuth } from "../../contexts/AuthContext";
import { useMobileMenu } from "../../contexts/MobileMenuContext";
import { ReportWithResolved } from "../../types";
import { generateAvatarUrl } from '../../utils/avatarUtils';
import { formatDatePH, parseBackendDate } from '../../utils/dateUtils';

type NotificationKind = 'report' | 'announcement';
type NotificationTone = 'danger' | 'warning' | 'info' | 'success';

interface NotificationItem {
    id: string;
    kind: NotificationKind;
    title: string;
    message: string;
    meta: string;
    timestamp: string | null;
    tone: NotificationTone;
    readKey: string;
}

const Navbar = () => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [notificationDetails, setNotificationDetails] = useState<{
        reportItems: NotificationItem[];
        announcementItems: NotificationItem[];
        items: NotificationItem[];
    }>({ reportItems: [], announcementItems: [], items: [] });
    const { user, isAuthenticated } = useAuth();
    const { toggleMobileMenu } = useMobileMenu();
    const navigate = useNavigate();
    const notificationRef = useRef<HTMLDivElement | null>(null);

    const getNotificationStorageKey = () => {
        const userIdentifier = user?.userid || user?.id?.toString() || user?.username || 'guest';
        const userRole = user?.role || 'guest';
        return `viewedNotifications:${userIdentifier}:${userRole}`;
    };

    const readViewedNotifications = () => {
        try {
            return JSON.parse(localStorage.getItem(getNotificationStorageKey()) || '{}');
        } catch {
            return {};
        }
    };

    const getNotificationTimestamp = (item: Record<string, any>) => {
        const parsedDate = parseBackendDate(
            item.updatedAt || item.resolvedAt || item.createdAt || item.date || null
        );
        return parsedDate ? parsedDate.toISOString() : (item.updatedAt || item.resolvedAt || item.createdAt || item.date || null);
    };

    const formatNotificationDate = (timestamp: string | null) => {
        if (!timestamp) return 'Recently';
        const parsed = parseBackendDate(timestamp);
        return parsed ? formatDatePH(parsed.toISOString(), true) : timestamp;
    };

    const createReportItem = (
        report: ReportWithResolved & Record<string, any>,
        role: 'admin' | 'student'
    ): NotificationItem => {
        const timestamp = getNotificationTimestamp(report);
        const baseId = String(report.id || report._id || report.report_id || 'report');
        const readKey = `report_${baseId}_${report.resolved ? 'resolved' : 'pending'}_${timestamp || 'no-time'}`;
        const authorName = report.username || report.studentId || report.user_id || 'Student';
        const cleanMessage = report.message || 'Report update available';
        const shortMessage = cleanMessage.length > 72 ? `${cleanMessage.slice(0, 72)}...` : cleanMessage;

        if (role === 'admin') {
            return {
                id: baseId,
                kind: 'report',
                title: report.resolved ? 'Resolved report' : 'New report received',
                message: shortMessage,
                meta: `${authorName} • ${report.status || 'No priority'}`,
                timestamp,
                tone: report.resolved ? 'success' : 'danger',
                readKey,
            };
        }

        return {
            id: baseId,
            kind: 'report',
            title: report.resolved ? 'Your report was resolved' : 'Your report is being reviewed',
            message: shortMessage,
            meta: `Updated ${formatNotificationDate(timestamp)}`,
            timestamp,
            tone: report.resolved ? 'success' : 'warning',
            readKey,
        };
    };

    const createAnnouncementItem = (announcement: Record<string, any>, index: number): NotificationItem => {
        const announcementId = String(announcement._id || announcement.id || announcement.slug || index);
        const timestamp = getNotificationTimestamp(announcement);
        const readKey = `announcement_${announcementId}_${timestamp || 'no-time'}`;
        const title = announcement.title || announcement.subject || 'New announcement';
        const message = announcement.content || announcement.message || 'A new announcement is available.';
        const shortMessage = String(message).length > 84 ? `${String(message).slice(0, 84)}...` : String(message);

        return {
            id: announcementId,
            kind: 'announcement',
            title,
            message: shortMessage,
            meta: `Published ${formatNotificationDate(timestamp)}`,
            timestamp,
            tone: 'info',
            readKey,
        };
    };

    const isCurrentUserOnline = (): boolean => {
        if (!isAuthenticated || !user) return false;

        const parsedLastSeen = parseBackendDate(user.last_seen);
        if (!parsedLastSeen) return true;

        return new Date().getTime() - parsedLastSeen.getTime() < 10 * 60 * 1000;
    };

    // Calculate notification count from backend (with localStorage fallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const calculateNotifications = async () => {
            try {
                let newNotificationsCount = 0;
                let reportItems: NotificationItem[] = [];
                let announcementItems: NotificationItem[] = [];

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

                const currentUserId = user?.userid || user?.id?.toString() || '';
                const currentUsername = user?.username || '';
                const viewedNotifications = readViewedNotifications();

                if (user && (user.role === 'admin' || user.role === 'super-admin')) {
                    reportItems = reportsWithStatus
                        .filter((r: ReportWithResolved) => !r.resolved)
                        .sort((a: ReportWithResolved, b: ReportWithResolved) => {
                            const aTime = new Date(getNotificationTimestamp(a as Record<string, any>) || 0).getTime();
                            const bTime = new Date(getNotificationTimestamp(b as Record<string, any>) || 0).getTime();
                            return bTime - aTime;
                        })
                        .map((report: ReportWithResolved) => createReportItem(report as ReportWithResolved & Record<string, any>, 'admin'));
                } else if (user && user.role === 'student') {
                    reportItems = reportsWithStatus
                        .filter((report: ReportWithResolved & Record<string, any>) => {
                            const reportUserId = report.studentId || report.user_id || report.userId;
                            return (
                                (reportUserId && String(reportUserId) === currentUserId) ||
                                (currentUsername && report.username === currentUsername)
                            );
                        })
                        .sort((a: ReportWithResolved, b: ReportWithResolved) => {
                            const aTime = new Date(getNotificationTimestamp(a as Record<string, any>) || 0).getTime();
                            const bTime = new Date(getNotificationTimestamp(b as Record<string, any>) || 0).getTime();
                            return bTime - aTime;
                        })
                        .map((report: ReportWithResolved) => createReportItem(report as ReportWithResolved & Record<string, any>, 'student'));
                }

                // Announcements: try backend then fallback
                let publishedAnnouncements: any[] = [];
                try {
                    const backendAnnouncements = await api.getAnnouncements();
                    publishedAnnouncements = Array.isArray(backendAnnouncements)
                        ? backendAnnouncements.filter((a: any) => a.isPublished && !a.isScheduled)
                        : [];
                } catch (e) {
                    const storedAnnouncements = localStorage.getItem('adminAnnouncements');
                    if (storedAnnouncements) {
                        const adminAnnouncements = JSON.parse(storedAnnouncements);
                        publishedAnnouncements = adminAnnouncements.filter((announcement: any) =>
                            announcement.isPublished && !announcement.isScheduled
                        );
                    }
                }

                announcementItems = publishedAnnouncements.map((announcement: any, index: number) =>
                    createAnnouncementItem(announcement, index)
                );

                const items = [...reportItems, ...announcementItems];
                newNotificationsCount = items.filter((item) => !viewedNotifications[item.readKey]).length;

                setNotificationCount(newNotificationsCount);
                setNotificationDetails({
                    reportItems,
                    announcementItems,
                    items
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
        const refreshInterval = window.setInterval(() => {
            if (isAuthenticated && user) {
                calculateNotifications();
            }
        }, 30000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.clearInterval(refreshInterval);
        };
    }, [isAuthenticated, user]);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowTooltip(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

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
        const storageKey = getNotificationStorageKey();
        const viewedNotifications = readViewedNotifications();

        // Mark all notifications as viewed
        notificationDetails.items.forEach((item: NotificationItem) => {
            viewedNotifications[item.readKey] = true;
        });
        
        localStorage.setItem(storageKey, JSON.stringify(viewedNotifications));
        
        // Update badge count
        setNotificationCount(0);
        setShowTooltip((prev) => !prev);
    };

    const handleNotificationItemClick = (item: NotificationItem) => {
        const storageKey = getNotificationStorageKey();
        const viewedNotifications = readViewedNotifications();
        viewedNotifications[item.readKey] = true;
        localStorage.setItem(storageKey, JSON.stringify(viewedNotifications));

        setNotificationCount((prev) => Math.max(0, prev - 1));
        setShowTooltip(false);

        if (item.kind === 'report') {
            navigate(user?.role === 'student' ? '/student-report' : '/report');
            return;
        }

        navigate(user?.role === 'student' ? '/student-announcement' : '/announcement');
    };

    const viewedNotifications = readViewedNotifications();



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
                    alt="Toggle fullscreen"
                    onClick={toggleFullscreen}
                    style={{ cursor: 'pointer' }}
                    title="Toggle Fullscreen (F11)"
                />
                <div
                    ref={notificationRef}
                    className="notification"
                    style={{ position: "relative" }}
                >
                    <button
                        type="button"
                        className={`notification-trigger ${showTooltip ? 'active' : ''}`}
                        onClick={handleNotificationClick}
                        aria-label="Notifications"
                        aria-expanded={showTooltip}
                    >
                        <img src="/notifications.svg" className="icon" alt="Notifications" />
                        {notificationCount > 0 && (
                            <span>{notificationCount}</span>
                        )}
                    </button>
                    {showTooltip && (
                        <div className="custom-tooltip notification-panel">
                            <div className="tooltip-header">
                                <div>
                                    <div className="panel-eyebrow">Live updates</div>
                                    <div className="panel-title">
                                        {notificationCount > 0
                                            ? `${notificationCount} unread notification${notificationCount !== 1 ? 's' : ''}`
                                            : notificationDetails.items.length > 0
                                                ? 'All notifications are read'
                                                : 'No notifications yet'}
                                    </div>
                                </div>
                                <div className="panel-status">
                                    <span className="live-dot" />
                                    Dashboard feed
                                </div>
                            </div>

                            <div className="panel-summary">
                                <div className="summary-chip">
                                    <span className="summary-label">Reports</span>
                                    <span className="summary-value">{notificationDetails.reportItems.length}</span>
                                </div>
                                <div className="summary-chip">
                                    <span className="summary-label">Announcements</span>
                                    <span className="summary-value">{notificationDetails.announcementItems.length}</span>
                                </div>
                            </div>

                            {notificationDetails.items.length > 0 ? (
                                <div className="notification-feed">
                                    {notificationDetails.items.map((item) => {
                                        return (
                                        <div
                                            key={item.readKey}
                                            className={`notification-card tone-${item.tone} ${!viewedNotifications[item.readKey] ? 'unread' : 'read'}`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleNotificationItemClick(item)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    handleNotificationItemClick(item);
                                                }
                                            }}
                                        >
                                            <div className="card-top">
                                                <div className="card-badge">{item.kind === 'report' ? 'Report' : 'Announcement'}</div>
                                                {!viewedNotifications[item.readKey] && <span className="unread-pill">New</span>}
                                            </div>
                                            <div className="card-title">{item.title}</div>
                                            <div className="card-message">{item.message}</div>
                                            <div className="card-meta">
                                                <span>{item.meta}</span>
                                                <span>{formatNotificationDate(item.timestamp)}</span>
                                            </div>
                                            <div className="card-action">Open details</div>
                                        </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-notifications">
                                    Everything is up to date.
                                </div>
                            )}
                            {notificationDetails.items.length > 0 && (
                                <div className="panel-footer">
                                    <span>Auto-refreshes every 30 seconds.</span>
                                </div>
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