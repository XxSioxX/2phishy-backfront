import React, { useState, useEffect } from 'react';
import './AnnouncementPage.scss';
import { getCurrentDatePH } from '../../utils/dateUtils';

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  scheduledDate?: string;
  isScheduled: boolean;
  isPublished: boolean;
}

const AnnouncementPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    scheduledDate: ''
  });

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = () => {
    // Load from localStorage
    const stored = localStorage.getItem('adminAnnouncements');
    if (stored) {
      setAnnouncements(JSON.parse(stored));
    } else {
      // Initialize with empty array
      setAnnouncements([]);
    }
  };

  const saveAnnouncements = (newAnnouncements: Announcement[]) => {
    localStorage.setItem('adminAnnouncements', JSON.stringify(newAnnouncements));
    setAnnouncements(newAnnouncements);
  };

  const handleAdd = () => {
    setFormData({ title: '', content: '', scheduledDate: '' });
    setShowAddForm(true);
    setShowEditForm(false);
    setShowScheduleForm(false);
  };

  const handleEdit = () => {
    if (selectedAnnouncements.length === 1) {
      const announcement = announcements.find(a => a.id === selectedAnnouncements[0]);
      if (announcement) {
        setEditingAnnouncement(announcement);
        setFormData({
          title: announcement.title,
          content: announcement.content,
          scheduledDate: announcement.scheduledDate || ''
        });
        setShowEditForm(true);
        setShowAddForm(false);
        setShowScheduleForm(false);
      }
    }
  };

  const handleDelete = () => {
    if (selectedAnnouncements.length > 0) {
      if (window.confirm(`Are you sure you want to delete ${selectedAnnouncements.length} announcement(s)?`)) {
        const updatedAnnouncements = announcements.filter(a => !selectedAnnouncements.includes(a.id));
        saveAnnouncements(updatedAnnouncements);
        setSelectedAnnouncements([]);
      }
    }
  };

  const handleSchedule = () => {
    if (selectedAnnouncements.length > 0) {
      setShowScheduleForm(true);
      setShowAddForm(false);
      setShowEditForm(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showAddForm) {
      const newAnnouncement: Announcement = {
        id: Date.now().toString(),
        title: formData.title,
        content: formData.content,
        date: getCurrentDatePH(),
        isScheduled: false,
        isPublished: true
      };
      
      const updatedAnnouncements = [newAnnouncement, ...announcements];
      saveAnnouncements(updatedAnnouncements);
      setShowAddForm(false);
    } else if (showEditForm && editingAnnouncement) {
      const updatedAnnouncements = announcements.map(a => 
        a.id === editingAnnouncement.id 
          ? { ...a, title: formData.title, content: formData.content }
          : a
      );
      saveAnnouncements(updatedAnnouncements);
      setShowEditForm(false);
      setEditingAnnouncement(null);
    }
    
    setFormData({ title: '', content: '', scheduledDate: '' });
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updatedAnnouncements = announcements.map(a => 
      selectedAnnouncements.includes(a.id)
        ? { 
            ...a, 
            scheduledDate: formData.scheduledDate,
            isScheduled: true,
            isPublished: false
          }
        : a
    );
    
    saveAnnouncements(updatedAnnouncements);
    setShowScheduleForm(false);
    setSelectedAnnouncements([]);
    setFormData({ title: '', content: '', scheduledDate: '' });
  };

  const handleCheckboxChange = (id: string) => {
    setSelectedAnnouncements(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedAnnouncements.length === announcements.length) {
      setSelectedAnnouncements([]);
    } else {
      setSelectedAnnouncements(announcements.map(a => a.id));
    }
  };

  return (
    <div className="announcement-page">
      <div className="headerWithButton">
        <h1>Announcement Management</h1>
        <div className="addAnnouncementBox">
          <button className="actionButton" onClick={handleAdd}>Add</button>
          <button 
            className="actionButton" 
            onClick={handleDelete}
            disabled={selectedAnnouncements.length === 0}
          >
            Delete
          </button>
          <button 
            className="actionButton" 
            onClick={handleEdit}
            disabled={selectedAnnouncements.length !== 1}
          >
            Edit
          </button>
          <button 
            className="actionButton" 
            onClick={handleSchedule}
            disabled={selectedAnnouncements.length === 0}
          >
            Schedule
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || showEditForm) && (
        <div className="modal-overlay" onClick={() => { setShowAddForm(false); setShowEditForm(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{showAddForm ? 'Add New Announcement' : 'Edit Announcement'}</h3>
              <button className="modal-close" onClick={() => { setShowAddForm(false); setShowEditForm(false); }}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="announcement-form">
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Content:</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  rows={5}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setShowAddForm(false); setShowEditForm(false); }}>
                  Cancel
                </button>
                <button type="submit">
                  {showAddForm ? 'Add Announcement' : 'Update Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Form */}
      {showScheduleForm && (
        <div className="modal-overlay" onClick={() => setShowScheduleForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Announcements</h3>
              <button className="modal-close" onClick={() => setShowScheduleForm(false)}>×</button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="announcement-form">
              <div className="form-group">
                <label>Scheduled Date:</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowScheduleForm(false)}>
                  Cancel
                </button>
                <button type="submit">
                  Schedule Announcements
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Announcements List */}
      <div className="announcementGrid">
        {announcements.length === 0 ? (
          <div className="no-announcements">
            <p>No announcements found. Click "Add" to create your first announcement.</p>
          </div>
        ) : (
          <>
            <div className="announcement-controls">
              <label className="select-all">
                <input
                  type="checkbox"
                  checked={selectedAnnouncements.length === announcements.length && announcements.length > 0}
                  onChange={handleSelectAll}
                />
                Select All
              </label>
              <span className="selected-count">
                {selectedAnnouncements.length} selected
              </span>
            </div>
            
            <div className="announcements-list">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="announcement-card">
                  <div className="announcement-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedAnnouncements.includes(announcement.id)}
                      onChange={() => handleCheckboxChange(announcement.id)}
                    />
                  </div>
                  <div className="announcement-content">
                    <div className="announcement-header">
                      <h3>{announcement.title}</h3>
                      <div className="announcement-meta">
                        <span className="date">{announcement.date}</span>
                        {announcement.isScheduled && (
                          <span className="scheduled-badge">
                            Scheduled: {announcement.scheduledDate}
                          </span>
                        )}
                        <span className="status-badge">
                          {announcement.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                    <p className="announcement-text">{announcement.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnnouncementPage;
