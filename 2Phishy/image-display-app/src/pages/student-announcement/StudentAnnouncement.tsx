import React, { useState, useEffect } from "react";
import "./student-announcement.scss";
import { api } from '../../services/api';

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  isPublished: boolean;
  isScheduled?: boolean;
}

const StudentAnnouncement: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    fetchAnnouncements();

    const handleStorageChange = () => fetchAnnouncements();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const fetchAnnouncements = () => {
    (async () => {
      try {
        const data: Announcement[] = await api.getAnnouncements();
        const publishedAnnouncements = Array.isArray(data)
          ? data.filter((a: Announcement) => a.isPublished && !a.isScheduled)
          : [];
        setAnnouncements(publishedAnnouncements);
      } catch (e) {
        console.error('Failed to fetch announcements from backend:', e);
        setAnnouncements([]);
      }
    })();
  };

  return (
    <div className="student-announcement">
      <div className="headerWithButton">
        <h1>Announcements</h1>
        <button className="refresh-button" onClick={fetchAnnouncements}>
          Refresh
        </button>
      </div>

      <div className="announcementGrid">
        {announcements.length === 0 ? (
          <div className="no-announcements">
            <p>No announcements available at the moment.</p>
          </div>
        ) : (
          <div className="announcements-list">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="announcement-card">
                <div className="announcement-content">
                  <div className="announcement-header">
                    <h3>{announcement.title}</h3>
                    <div className="announcement-meta">
                      <span className="date">{announcement.date}</span>
                    </div>
                  </div>
                  <p className="announcement-text">{announcement.content}</p>
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