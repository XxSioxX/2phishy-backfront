import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
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

const BulletinPage = () => {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';
  const username = user?.username || '';

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [filterDate, setFilterDate] = useState<string>('');
  const [filterTopic, setFilterTopic] = useState<string>('');
  const [filterUserType, setFilterUserType] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 10;

  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    content: ''
  });

  const [formErrors, setFormErrors] = useState<any>({});

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
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
  };

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

  // Enhanced filtering with search
  const filteredPosts = posts.filter(post => {
    const matchesDate = !filterDate || new Date(post.created_at).toDateString() === new Date(filterDate).toDateString();
    const matchesTopic = !filterTopic || post.category.toLowerCase().includes(filterTopic.toLowerCase());
    const role = post.created_by_role.toLowerCase();
    const matchesUserType = filterUserType === 'all' || filterUserType.toLowerCase() === role;
    const matchesSearch = !searchText || 
      post.title.toLowerCase().includes(searchText.toLowerCase()) ||
      post.content.toLowerCase().includes(searchText.toLowerCase()) ||
      post.created_by.toLowerCase().includes(searchText.toLowerCase());

    return matchesDate && matchesTopic && matchesUserType && matchesSearch && post.status === 'published';
  });

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
    setFilterDate('');
    setFilterTopic('');
    setFilterUserType('all');
    setSearchText('');
    setCurrentPage(1);
  };

  if (loading) return <div className="loading">Loading bulletin...</div>;

  return (
    <div className="posts-page">
      <div className="headerWithButton">
        <h2>Bulletin Board</h2>
        <div className="action-buttons">
          <button className="action-btn" onClick={handleAdd}>+ New Post</button>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-box" style={{display: 'none'}}>
          <input
            type="text"
            placeholder="Search posts by title, content, or author..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
          />
        </div>

        <div className="filters">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-input"
            title="Filter by date"
          />
          <select
            value={filterTopic}
            onChange={(e) => {
              setFilterTopic(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-select"
            title="Filter by topic"
          >
            <option value="">All Topics</option>
            <option value="Tips">Tips</option>
            <option value="Learnings">Learnings</option>
            <option value="Questions">Questions</option>
          </select>
          <select
            value={filterUserType}
            onChange={(e) => {
              setFilterUserType(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-select"
            title="Filter by user type"
          >
            <option value="all">All Users</option>
            <option value="admin">Admin</option>
            <option value="super-admin">Super Admin</option>
            <option value="student">Student</option>
          </select>
          <button 
            className="clear-filters-btn" 
            onClick={handleClearFilters}
            title="Clear all filters"
          >
            Clear
          </button>
        </div>

        <div className="filter-info">
          <span>{filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''} found</span>
        </div>
      </div>

      <div className="bulletin-board">
        {paginatedPosts.length === 0 ? (
          <div className="no-posts">
            <p>No bulletins found.</p>
            <p style={{fontSize: '0.9rem', marginTop: '10px'}}>Try adjusting your filters or create a new post!</p>
          </div>
        ) : (
          paginatedPosts.map(post => (
            <div
              key={post.post_id}
              className="bulletin-item"
              onClick={() => { setSelectedPost(post); setShowPostModal(true); }}
            >
              <div className="bulletin-header">
                <span className="title">{post.title}</span>
                <span className="topic-badge">{post.category}</span>
              </div>
              <div className="bulletin-content-preview">
                {post.content.substring(0, 80)}...
              </div>
              <div className="bulletin-footer">
                <div className="bulletin-meta">
                  <span className="bulletin-author">By {post.created_by}</span>
                  <span className="bulletin-role">({post.created_by_role})</span>
                  <span className="bulletin-date">{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                {username && (post.created_by === username || ['admin','super-admin'].includes(userRole)) && (
                  <button
                    className="delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(post.post_id); }}
                    title="Delete this post"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Previous
          </button>
          <div className="page-info">
            <span>Page {currentPage} of {totalPages}</span>
            <select 
              value={currentPage} 
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              className="page-select"
            >
              {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                <option key={page} value={page}>Go to {page}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} 
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}

      {showPostModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowPostModal(false)}>
          <div className="modal-content post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="post-header">
              <div>
                <span className="title">{selectedPost.title}</span>
                <span className="topic-badge-modal">{selectedPost.category}</span>
              </div>
              <span className="date">{new Date(selectedPost.created_at).toLocaleDateString()}</span>
            </div>
            <div className="post-author">By {selectedPost.created_by} <span className="role-badge">({selectedPost.created_by_role})</span></div>
            <div className="post-content">{selectedPost.content}</div>
            <button className="close-btn" onClick={() => setShowPostModal(false)}>Close</button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Post</h3>
            <p style={{color: '#888', fontSize: '0.9rem'}}>Share your bulletin with all users</p>
            
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                placeholder="Enter post title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={formErrors.title ? 'input-error' : ''}
              />
              {formErrors.title && <span className="error-msg">{formErrors.title}</span>}
            </div>

            <div className="form-group">
              <label>Topic *</label>
              <select
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className={formErrors.topic ? 'input-error' : ''}
              >
                <option value="">Select a topic</option>
                <option value="Tips">Tips</option>
                <option value="Learnings">Learnings</option>
                <option value="Questions">Questions</option>
              </select>
              {formErrors.topic && <span className="error-msg">{formErrors.topic}</span>}
            </div>

            <div className="form-group">
              <label>Content *</label>
              <textarea
                placeholder="Write your post content here..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className={formErrors.content ? 'input-error' : ''}
              />
              {formErrors.content && <span className="error-msg">{formErrors.content}</span>}
              <span className="char-count">{formData.content.length} characters</span>
            </div>

            <div className="modal-buttons">
              <button className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="save-btn" onClick={handleSaveAdd}>Post</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulletinPage;