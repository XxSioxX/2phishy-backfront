import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import "./PostsPage.scss";

interface Post {
  post_id: string;
  title: string;
  topic: string;
  status: string;
  created_at: string;
  updated_at: string;
  content: string;
  created_by: string;       // username
  created_by_role: string;  // role name: Admin, Super-Admin, Student, etc.
}

const BulletinPage = () => {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || ''; // Safe access
  const username = user?.username || '';           // Safe access

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [filterDate, setFilterDate] = useState<string>('');
  const [filterTopic, setFilterTopic] = useState<string>('');
  const [filterUserType, setFilterUserType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 20;

  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    content: ''
  });

  // Fetch posts on mount
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await api.getPosts();

      // Normalize role names to lowercase for filtering
      const formattedPosts = data.map((post: any) => ({
        ...post,
        created_by_role: post.created_by_role?.toLowerCase() || 'student'
      }));

      setPosts(formattedPosts);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', topic: '', content: '' });
  };

  // Dynamic filtering
  const filteredPosts = posts.filter(post => {
    const matchesDate = !filterDate || new Date(post.created_at).toDateString() === new Date(filterDate).toDateString();
    const matchesTopic = !filterTopic || post.topic === filterTopic;

    const role = post.created_by_role.toLowerCase(); // dynamic role from post
    const matchesUserType = filterUserType === 'all' || filterUserType.toLowerCase() === role;

    return matchesDate && matchesTopic && matchesUserType && post.status === 'published';
  });

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + postsPerPage);
  const uniqueTopics = [...new Set(posts.map(p => p.topic))];

  const handleAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleSaveAdd = async () => {
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
      } catch (error) {
        console.error("Failed to delete post:", error);
        alert("Failed to delete post");
      }
    }
  };

  if (loading) return <div>Loading bulletin...</div>;

  return (
    <div className="posts-page">
      <div className="headerWithButton">
        <h2>Bulletin Board</h2>
        <div className="action-buttons">
          <button className="action-btn" onClick={handleAdd}>Post</button>
        </div>
      </div>

      <div className="filters">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
        >
          <option value="">All Topics</option>
          {uniqueTopics.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filterUserType}
          onChange={(e) => setFilterUserType(e.target.value)}
        >
          <option value="all">All Users</option>
          <option value="admin">Admin</option>
          <option value="student">Student</option>
        </select>
      </div>

      <div className="bulletin-board">
        {paginatedPosts.length === 0 ? (
          <div className="no-posts">No bulletins found.</div>
        ) : (
          paginatedPosts.map(post => (
            <div
              key={post.post_id}
              className="bulletin-item"
              onClick={() => { setSelectedPost(post); setShowPostModal(true); }}
            >
              <div className="bulletin-header">
                <span className="title">{post.title}</span>
                <span className="date">{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
              <div className="bulletin-footer">
                <span className="bulletin-author">BY {post.created_by}</span>
                {username && (post.created_by === username || ['admin','super-admin'].includes(userRole)) && (
                  <button
                    className="delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(post.post_id); }}
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
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Previous</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next</button>
        </div>
      )}

      {showPostModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowPostModal(false)}>
          <div className="modal-content post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="post-header">
              <span className="title">{selectedPost.title}</span>
              <span className="date">{new Date(selectedPost.created_at).toLocaleDateString()}</span>
            </div>
            <div className="post-author">BY {selectedPost.created_by} ({selectedPost.created_by_role})</div>
            <div className="post-content">{selectedPost.content}</div>
            <button onClick={() => setShowPostModal(false)}>Close</button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Post</h3>
            <input
              type="text"
              placeholder="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <input
              type="text"
              placeholder="Topic"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            />
            <textarea
              placeholder="Content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            />
            <div className="modal-buttons">
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
              <button onClick={handleSaveAdd}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulletinPage;
