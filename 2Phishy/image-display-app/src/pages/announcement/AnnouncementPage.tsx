import React, { useState, useEffect, useMemo } from 'react';
import './AnnouncementPage.scss';
import { getCurrentDatePH, formatDatePH } from '../../utils/dateUtils';
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
          const created = await api.createAnnouncement(payload);
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
          const updated = await api.updateAnnouncement(editingAnnouncement.id, payload);
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
    if (selectedAnnouncements.length === filteredAnnouncements.length && filteredAnnouncements.length > 0) {
      setSelectedAnnouncements([]);
    } else {
      setSelectedAnnouncements(filteredAnnouncements.map(a => a.id));
    }
  };

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = announcements;

    if (q) {
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      if (statusFilter === "published") {
        filtered = filtered.filter(a => a.isPublished);
      } else if (statusFilter === "draft") {
        filtered = filtered.filter(a => !a.isPublished);
      }
    }

    return filtered;
  }, [announcements, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = announcements.length;
    const published = announcements.filter(a => a.isPublished).length;
    const draft = announcements.filter(a => !a.isPublished).length;
    const recent = announcements.length > 0 
      ? announcements.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0]?.date
      : null;
    return { total, published, draft, recent };
  }, [announcements]);

  const closeModals = () => {
    setShowAddForm(false);
    setShowEditForm(false);
  };

  return (
    <div className="announcement-page">

      {/* ── Page header ─────────────────────────────────── */}
      <div className="ap-header">
        <div className="ap-header-left">
          <h1 className="ap-title">Announcement Management</h1>
          <p className="ap-subtitle">Create, manage, and publish announcements</p>
        </div>
        <div className="ap-actions">
          <button onClick={handleAdd} className="ap-btn ap-btn-primary">+ Add</button>
          <button 
            onClick={handleEdit} 
            className="ap-btn ap-btn-secondary"
            disabled={selectedAnnouncements.length !== 1}
          >
            ✎ Edit
          </button>
          <button 
            onClick={handleDelete} 
            className="ap-btn ap-btn-danger"
            disabled={selectedAnnouncements.length === 0}
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────── */}
      {announcements.length > 0 && (
        <div className="ap-stats-row">
          <div className="ap-stat-card">
            <span className="ap-stat-value">{stats.total}</span>
            <span className="ap-stat-label">Total Announcements</span>
          </div>
          <div className="ap-stat-card">
            <span className="ap-stat-value">{stats.published}</span>
            <span className="ap-stat-label">Published</span>
          </div>
          <div className="ap-stat-card">
            <span className="ap-stat-value">{stats.draft}</span>
            <span className="ap-stat-label">Drafts</span>
          </div>
          <div className="ap-stat-card">
            <span className="ap-stat-value">{stats.recent ? formatDatePH(stats.recent, false) : '—'}</span>
            <span className="ap-stat-label">Recently Updated</span>
          </div>
        </div>
      )}

      {/* ── Search & Filter ─────────────────────────────── */}
      {announcements.length > 0 && (
        <div className="ap-toolbar">
          <div className="ap-search-wrap">
            <span className="ap-search-icon">🔍</span>
            <input
              type="text"
              className="ap-search"
              placeholder="Search announcements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ap-clear-btn" onClick={() => setSearch("")}>×</button>
            )}
          </div>
          <select
            className="ap-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      )}

      {/* ── Announcements List ──────────────────────────── */}
      <div className="ap-table-card">
        {announcements.length === 0 ? (
          <div className="ap-empty">
            <span className="ap-empty-icon">📢</span>
            <p>No announcements yet. Click "Add" to create your first announcement.</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="ap-empty">
            <span className="ap-empty-icon">🔍</span>
            <p>No announcements match your search.</p>
          </div>
        ) : (
          <>
            <div className="ap-list-header">
              <label className="ap-select-all">
                <input
                  type="checkbox"
                  checked={selectedAnnouncements.length === filteredAnnouncements.length && filteredAnnouncements.length > 0}
                  onChange={handleSelectAll}
                />
                Select All
              </label>
              <span className="ap-selected-count">
                {selectedAnnouncements.length} of {filteredAnnouncements.length} selected
              </span>
            </div>

            <div className="ap-list">
              {filteredAnnouncements.map((announcement) => (
                <div 
                  key={announcement.id} 
                  className={`ap-row ${selectedAnnouncements.includes(announcement.id) ? 'selected' : ''}`}
                >
                  <div className="ap-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedAnnouncements.includes(announcement.id)}
                      onChange={() => handleCheckboxChange(announcement.id)}
                    />
                  </div>

                  <div className="ap-row-content">
                    <div className="ap-row-title-section">
                      <h3 className="ap-row-title">{announcement.title}</h3>
                      <p className="ap-row-preview">{announcement.content.substring(0, 100)}...</p>
                    </div>

                    <div className="ap-row-meta">
                      <span className={`ap-status-badge ${announcement.isPublished ? 'published' : 'draft'}`}>
                        {announcement.isPublished ? '● Published' : '● Draft'}
                      </span>
                      {announcement.lastEditedBy && (
                        <span className="ap-edited-info">
                          Edited by {announcement.lastEditedBy}
                        </span>
                      )}
                      <span className="ap-date">
                        {announcement.lastEditedDate ? formatDatePH(announcement.lastEditedDate, false) : formatDatePH(announcement.date, false)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modal Form ──────────────────────────────── */}
      {(showAddForm || showEditForm) && (
        <div className="ap-modal-overlay" onClick={closeModals}>
          <div className="ap-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ap-modal-header">
              <h3>{showAddForm ? 'Add New Announcement' : 'Edit Announcement'}</h3>
              <button className="ap-modal-close" onClick={closeModals}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="ap-form">
              <div className="ap-form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Announcement title"
                  required
                />
              </div>
              <div className="ap-form-group">
                <label>Content *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  rows={6}
                  placeholder="Announcement content"
                  required
                />
              </div>
              <div className="ap-form-group">
                <label>Status</label>
                <select
                  value={formData.isPublished ? 'published' : 'draft'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isPublished: e.target.value === 'published'
                    })
                  }
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="ap-form-actions">
                <button type="button" onClick={closeModals} className="ap-form-btn ap-form-btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="ap-form-btn ap-form-btn-submit">
                  {showAddForm ? 'Create Announcement' : 'Update Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementPage;
