import React, { useState, useEffect } from "react";
import "./student-announcement.scss";

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

const StudentAnnouncement: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
    
    // Listen for storage changes to update announcements in real-time
    const handleStorageChange = () => {
      fetchAnnouncements();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setIsLoading(true);
      // Load announcements from admin's localStorage
      const stored = localStorage.getItem('adminAnnouncements');
      if (stored) {
        const adminAnnouncements = JSON.parse(stored);
        // Filter only published announcements (not drafts or scheduled)
        const publishedAnnouncements = adminAnnouncements.filter((announcement: any) => 
          announcement.isPublished && !announcement.isScheduled
        );
        
        // Convert to student announcement format
        const studentAnnouncements = publishedAnnouncements.map((announcement: any) => ({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          date: announcement.date,
          author: "2Phishy"
        }));
        
        setAnnouncements(studentAnnouncements);
      } else {
        setAnnouncements([]);
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading) {
    return (
      <div className="student-announcement">
        <div className="student-announcement-container">
          <h1>Announcements</h1>
          <p>Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-announcement">
      <div className="student-announcement-container">
        <div className="announcement-header">
          <div>
            <h1>Announcements</h1>
            <p className="subtitle">Stay updated with the latest news and updates</p>
          </div>
          <button className="refresh-button" onClick={fetchAnnouncements}>
            Refresh
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="no-announcements">
            <p>No announcements available at the moment.</p>
          </div>
        ) : (
          <div className="announcements-list">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="announcement-card">
                <div className="announcement-header">
                  <div className="announcement-meta">
                    <span className="date">{announcement.date}</span>
                  </div>
                  <span className="author">By: 2Phishy</span>
                </div>
                <div className="announcement-content">
                  <h3>{announcement.title}</h3>
                  <p>{announcement.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAnnouncement;
