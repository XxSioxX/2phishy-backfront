import React, { useState, useEffect } from 'react';
import './AnnouncementPage.scss';
import { getCurrentDatePH } from '../../utils/dateUtils';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  isPublished: boolean;
  lastEditedBy?: string;
  lastEditedDate?: string;
}

const AnnouncementPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isPublished: true
  });

  const { user } = useAuth();
  const currentUser = user || { username: 'Unknown' };

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const data = await api.getAnnouncements();
        setAnnouncements(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to load announcements from backend:', e);
        setAnnouncements([]);
      }
    };
    loadAnnouncements();
  }, []);

  const handleAdd = () => {
    setFormData({ title: '', content: '', isPublished: true });
    setShowAddForm(true);
    setShowEditForm(false);
  };

  const handleEdit = () => {
    if (selectedAnnouncements.length === 1) {
      const announcement = announcements.find(a => a.id === selectedAnnouncements[0]);
      if (announcement) {
        setEditingAnnouncement(announcement);
        setFormData({
          title: announcement.title,
          content: announcement.content,
          isPublished: announcement.isPublished
        });
        setShowEditForm(true);
        setShowAddForm(false);
      }
    }
  };

  const handleDelete = () => {
    if (selectedAnnouncements.length > 0) {
      if (window.confirm(`Are you sure you want to delete ${selectedAnnouncements.length} announcement(s)?`)) {
        (async () => {
          try {
            await Promise.all(selectedAnnouncements.map(id => api.deleteAnnouncement(id)));
            setAnnouncements(prev => prev.filter(a => !selectedAnnouncements.includes(a.id)));
            setSelectedAnnouncements([]);
          } catch (e) {
            console.error('Failed to delete announcements:', e);
            alert('Failed to delete announcements');
          }
        })();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showAddForm) {
      (async () => {
        try {
          const payload = {
            title: formData.title,
            content: formData.content,
            date: getCurrentDatePH(),
            isPublished: formData.isPublished,
            lastEditedBy: currentUser.username,
            lastEditedDate: getCurrentDatePH()
          };
          console.log('Creating announcement with payload:', payload);
          const created = await api.createAnnouncement(payload);
          console.log('Created announcement response:', created);
          const announcementWithId = { ...created, id: created.id || created._id };
          setAnnouncements(prev => [announcementWithId, ...prev]);
          setShowAddForm(false);
          setFormData({ title: '', content: '', isPublished: true });
          alert('Announcement created successfully!');
        } catch (e) {
          console.error('Failed to create announcement:', e);
          alert(`Failed to create announcement: ${(e as Error).message || 'Unknown error'}`);
        }
      })();
    } else if (showEditForm && editingAnnouncement) {
      (async () => {
        try {
          const payload = {
            title: formData.title,
            content: formData.content,
            isPublished: formData.isPublished,
            lastEditedBy: currentUser.username,
            lastEditedDate: getCurrentDatePH()
          };
          console.log('Updating announcement with payload:', payload);
          const updated = await api.updateAnnouncement(editingAnnouncement.id, payload);
          console.log('Update response:', updated);
          const announcementWithId = { ...updated, id: updated.id || updated._id };
          setAnnouncements(prev => prev.map(a => a.id === editingAnnouncement.id ? announcementWithId : a));
          setShowEditForm(false);
          setEditingAnnouncement(null);
          setSelectedAnnouncements([]);
          setFormData({ title: '', content: '', isPublished: true });
          alert('Announcement updated successfully!');
        } catch (e: any) {
          console.error('Failed to update announcement:', e);
          alert(`Failed to update announcement: ${e.message || 'Unknown error'}`);
        }
      })();
    }
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
              <div className="form-group">
                <label>Status:</label>
                <select
                  value={formData.isPublished ? 'published' : 'draft'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isPublished: e.target.value === 'published'
                    })
                  }
                >
                  <option value="published">Publish</option>
                  <option value="draft">Draft</option>
                </select>
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
                        {announcement.lastEditedBy && (
                          <span className="edited-badge">
                            Edited by {announcement.lastEditedBy} on {announcement.lastEditedDate}
                          </span>
                        )}
                        <span className={`status-badge ${announcement.isPublished ? '' : 'draft'}`}>
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
