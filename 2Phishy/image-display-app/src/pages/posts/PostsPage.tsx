import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { formatDatePH } from "../../utils/dateUtils";
import "./PostsPage.scss";

interface Post {
  post_id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  content: string;
  created_by: string;
  created_by_role: string;
}

type BulletinFilter = "all" | "important" | "general" | "updates";
type BulletinCategory = "Important" | "Update" | "General" | "Notice";

const IMPORTANT_KEYWORDS = ["important", "urgent", "alert", "warning", "security", "password", "breach"];
const UPDATE_KEYWORDS = ["update", "updated", "maintenance", "release", "feature", "system", "upgrade", "patch"];
const NOTICE_KEYWORDS = ["notice", "reminder", "event", "schedule", "advisory", "tips", "questions"];

const getBulletinCategory = (post: Post): BulletinCategory => {
  const source = `${post.title} ${post.content} ${post.category}`.toLowerCase();

  if (IMPORTANT_KEYWORDS.some((keyword) => source.includes(keyword))) {
    return "Important";
  }

  if (UPDATE_KEYWORDS.some((keyword) => source.includes(keyword))) {
    return "Update";
  }

  if (NOTICE_KEYWORDS.some((keyword) => source.includes(keyword))) {
    return "Notice";
  }

  return "General";
};

const getPreviewText = (content: string, maxLength: number = 120) => {
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
};

const BulletinPage = () => {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';
  const username = user?.username || '';

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<BulletinFilter>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 10;

  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    content: ''
  });

  const [formErrors, setFormErrors] = useState<any>({});

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPosts();

      const formattedPosts = data.map((post: any) => ({
        ...post,
        created_by_role: post.created_by_role?.toLowerCase() || 'student'
      }));

      setPosts(formattedPosts);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      alert("Failed to load bulletin posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const resetForm = () => {
    setFormData({ title: '', topic: '', content: '' });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.title.trim()) errors.title = "Title is required";
    if (!formData.topic.trim()) errors.topic = "Topic is required";
    if (!formData.content.trim()) errors.content = "Content is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const publishedPosts = useMemo(() => (
    posts
      .filter((post) => post.status?.toLowerCase() === 'published')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  ), [posts]);

  const enhancedPosts = useMemo(() => (
    publishedPosts.map((post) => ({
      ...post,
      bulletinCategory: getBulletinCategory(post),
      preview: getPreviewText(post.content),
    }))
  ), [publishedPosts]);

  const filteredPosts = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    return enhancedPosts.filter((post) => {
      const matchesCategory =
        categoryFilter === 'all' ||
        (categoryFilter === 'important' && post.bulletinCategory === 'Important') ||
        (categoryFilter === 'general' && post.bulletinCategory === 'General') ||
        (categoryFilter === 'updates' && post.bulletinCategory === 'Update');

      const matchesSearch =
        !term ||
        [post.title, post.content, post.created_by, post.category, post.bulletinCategory]
          .some((field) => field.toLowerCase().includes(term));

      return matchesCategory && matchesSearch;
    });
  }, [enhancedPosts, categoryFilter, searchText]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    const latestPost = enhancedPosts[0];
    const thisWeek = enhancedPosts.filter((post) => new Date(post.created_at) >= weekAgo).length;
    const importantNotices = enhancedPosts.filter(
      (post) => post.bulletinCategory === 'Important' || post.bulletinCategory === 'Notice'
    ).length;

    return {
      total: enhancedPosts.length,
      latestTitle: latestPost?.title || '—',
      latestDate: latestPost ? formatDatePH(latestPost.created_at, false) : 'No announcements',
      thisWeek,
      importantNotices,
    };
  }, [enhancedPosts]);

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + postsPerPage);

  const handleAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleSaveAdd = async () => {
    if (!validateForm()) return;

    try {
      await api.createPost({
        ...formData,
        status: 'published',
        created_by: username,
        created_by_role: userRole
      });
      setShowAddModal(false);
      resetForm();
      fetchPosts();
      alert("Post created successfully!");
    } catch (error) {
      console.error("Failed to create post:", error);
      alert("Failed to create post");
    }
  };

  const handleDelete = async (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await api.deletePost(postId);
        fetchPosts();
        alert("Post deleted successfully!");
      } catch (error) {
        console.error("Failed to delete post:", error);
        alert("Failed to delete post");
      }
    }
  };

  const handleClearFilters = () => {
    setCategoryFilter('all');
    setSearchText('');
    setCurrentPage(1);
  };

  return (
    <div className="posts-page">
      <div className="bp-header">
        <div className="bp-header-left">
          <h1 className="bp-title">Bulletin Board</h1>
          <p className="bp-subtitle">Latest announcements and updates for users</p>
        </div>
        <div className="bp-actions">
          <button className="bp-btn bp-btn-secondary" onClick={fetchPosts}>Refresh Feed</button>
          <button className="bp-btn bp-btn-primary" onClick={handleAdd}>+ New Post</button>
        </div>
      </div>

      <div className="bp-stats-row">
        <div className="bp-stat-card">
          <span className="bp-stat-value">{stats.total}</span>
          <span className="bp-stat-label">Total Announcements</span>
        </div>
        <div className="bp-stat-card bp-stat-card-highlight">
          <span className="bp-stat-value bp-stat-text" title={stats.latestTitle}>{stats.latestTitle}</span>
          <span className="bp-stat-label">Latest Announcement • {stats.latestDate}</span>
        </div>
        <div className="bp-stat-card">
          <span className="bp-stat-value">{stats.thisWeek}</span>
          <span className="bp-stat-label">Announcements This Week</span>
        </div>
        <div className="bp-stat-card">
          <span className="bp-stat-value">{stats.importantNotices}</span>
          <span className="bp-stat-label">Important Notices</span>
        </div>
      </div>

      <div className="bp-toolbar">
        <div className="bp-search-wrap">
          <span className="bp-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search announcements by title or keywords..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
            className="bp-search"
          />
          {searchText && (
            <button className="bp-clear-btn" onClick={() => { setSearchText(''); setCurrentPage(1); }}>×</button>
          )}
        </div>

        <div className="bp-toolbar-actions">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as BulletinFilter);
              setCurrentPage(1);
            }}
            className="bp-filter"
            title="Filter by category"
          >
            <option value="all">All</option>
            <option value="important">Important</option>
            <option value="general">General</option>
            <option value="updates">Updates</option>
          </select>
          <button 
            className="bp-btn bp-btn-secondary" 
            onClick={handleClearFilters}
            title="Clear all filters"
          >
            Clear
          </button>
        </div>

        <div className="bp-filter-info">
          <span>{filteredPosts.length} announcement{filteredPosts.length !== 1 ? 's' : ''} found</span>
        </div>
      </div>

      <div className="bp-feed-card">
        {loading ? (
          <div className="bp-empty">
            <span className="bp-empty-icon">⏳</span>
            <p>Loading bulletin posts...</p>
          </div>
        ) : paginatedPosts.length === 0 ? (
          <div className="bp-empty">
            <span className="bp-empty-icon">📭</span>
            <p>
              {enhancedPosts.length === 0
                ? 'No announcements available right now.'
                : 'No announcements match your current search or filter.'}
            </p>
          </div>
        ) : (
          <div className="bp-grid">
            {paginatedPosts.map(post => (
            <article
              key={post.post_id}
              className="bp-card"
              onClick={() => { setSelectedPost(post); setShowPostModal(true); }}
            >
              <div className="bp-card-header">
                <div className="bp-card-title-wrap">
                  <span className="bp-card-icon">📢</span>
                  <h3 className="bp-card-title">{post.title}</h3>
                </div>
                <span className={`bp-badge ${post.bulletinCategory.toLowerCase()}`}>{post.bulletinCategory}</span>
              </div>

              <p className="bp-card-preview">{post.preview}</p>

              <div className="bp-card-footer">
                <div className="bp-meta-row">
                  <span className="bp-meta-label">Category:</span>
                  <span className="bp-meta-value">{post.category}</span>
                </div>
                <div className="bp-meta-row">
                  <span className="bp-meta-label">Posted by:</span>
                  <span className="bp-meta-value">{post.created_by}</span>
                </div>
                <div className="bp-meta-row">
                  <span className="bp-meta-label">Date:</span>
                  <span className="bp-meta-value">{formatDatePH(post.created_at, false)}</span>
                </div>
                {username && (post.created_by === username || ['admin','super-admin'].includes(userRole)) && (
                  <button
                    className="bp-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(post.post_id); }}
                    title="Delete this post"
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="bp-pagination">
          <button 
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
            disabled={currentPage === 1}
            className="bp-pagination-btn"
          >
            ← Previous
          </button>
          <div className="bp-page-info">
            <span>Page {currentPage} of {totalPages}</span>
            <select 
              value={currentPage} 
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              className="bp-page-select"
            >
              {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                <option key={page} value={page}>Go to {page}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} 
            disabled={currentPage === totalPages}
            className="bp-pagination-btn"
          >
            Next →
          </button>
        </div>
      )}

      {showPostModal && selectedPost && (
        <div className="bp-modal-overlay" onClick={() => setShowPostModal(false)}>
          <div className="bp-modal-content bp-post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bp-post-header">
              <div>
                <span className="bp-post-title">{selectedPost.title}</span>
                <span className={`bp-badge ${getBulletinCategory(selectedPost).toLowerCase()}`}>{getBulletinCategory(selectedPost)}</span>
              </div>
              <span className="bp-post-date">{formatDatePH(selectedPost.created_at, false)}</span>
            </div>
            <div className="bp-post-author">Posted by {selectedPost.created_by} <span className="bp-role-badge">({selectedPost.created_by_role})</span></div>
            <div className="bp-post-content">{selectedPost.content}</div>
            <button className="bp-close-btn" onClick={() => setShowPostModal(false)}>Close</button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="bp-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="bp-modal-content bp-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Post</h3>
            <p className="bp-modal-subtext">Share your bulletin with all users</p>
            
            <div className="bp-form-group">
              <label>Title *</label>
              <input
                type="text"
                placeholder="Enter post title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={formErrors.title ? 'bp-input-error' : ''}
              />
              {formErrors.title && <span className="bp-error-msg">{formErrors.title}</span>}
            </div>

            <div className="bp-form-group">
              <label>Topic *</label>
              <select
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className={formErrors.topic ? 'bp-input-error' : ''}
              >
                <option value="">Select a topic</option>
                <option value="Tips">Tips</option>
                <option value="Learnings">Learnings</option>
                <option value="Questions">Questions</option>
              </select>
              {formErrors.topic && <span className="bp-error-msg">{formErrors.topic}</span>}
            </div>

            <div className="bp-form-group">
              <label>Content *</label>
              <textarea
                placeholder="Write your post content here..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className={formErrors.content ? 'bp-input-error' : ''}
              />
              {formErrors.content && <span className="bp-error-msg">{formErrors.content}</span>}
              <span className="bp-char-count">{formData.content.length} characters</span>
            </div>

            <div className="bp-modal-buttons">
              <button className="bp-cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="bp-save-btn" onClick={handleSaveAdd}>Post</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulletinPage;