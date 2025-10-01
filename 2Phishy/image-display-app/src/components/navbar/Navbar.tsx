import "./navbar.scss";
import { Link } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { getReportsFromStorage } from "../../data";
import { useAuth } from "../../contexts/AuthContext";

const Navbar = () => {
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showTooltip, setShowTooltip] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [notificationDetails, setNotificationDetails] = useState<{
        reports: any[];
        announcements: any[];
    }>({ reports: [], announcements: [] });
    const { user, isAuthenticated } = useAuth();

    // Calculate notification count from localStorage data
    useEffect(() => {
        const calculateNotifications = () => {
            // Get student reports count
            const studentReports = getReportsFromStorage();
            const reportsCount = studentReports.length;

            // Get admin announcements count (published only)
            const storedAnnouncements = localStorage.getItem('adminAnnouncements');
            let announcementsCount = 0;
            let publishedAnnouncements: any[] = [];
            if (storedAnnouncements) {
                const adminAnnouncements = JSON.parse(storedAnnouncements);
                publishedAnnouncements = adminAnnouncements.filter((announcement: any) => 
                    announcement.isPublished && !announcement.isScheduled
                );
                announcementsCount = publishedAnnouncements.length;
            }

            setNotificationCount(reportsCount + announcementsCount);
            setNotificationDetails({
                reports: studentReports,
                announcements: publishedAnnouncements
            });
        };

        calculateNotifications();

        // Listen for storage changes to update notifications in real-time
        const handleStorageChange = () => {
            calculateNotifications();
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

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
                                        {notificationCount} notifications - Click to clear
                                    </div>
                                    {notificationDetails.reports.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-section-title">📋 Reports ({notificationDetails.reports.length})</div>
                                        </div>
                                    )}
                                    {notificationDetails.announcements.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-section-title">📢 Announcements ({notificationDetails.announcements.length})</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                "No new notifications"
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