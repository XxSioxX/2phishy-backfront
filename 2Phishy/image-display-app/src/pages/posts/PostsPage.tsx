import { useState, useEffect } from "react";
import { api } from "../../services/api";
import "./PostsPage.scss";

interface Post {
  post_id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  content: string;
  admin_notes?: string;
  created_by: string;
}

const PostsPage = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    category: 'general',
    status: 'draft',
    content: '',
    admin_notes: ''
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const data = await api.getPosts();
      setPosts(data);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'general',
      status: 'draft',
      content: '',
      admin_notes: ''
    });
  };

  const handleDelete = async () => {
    if (!selectedPost) return;
    if (!window.confirm(`Delete post "${selectedPost.title}"?`)) return;
    
    try {
      await api.deletePost(selectedPost.post_id);
      fetchPosts();
      setSelectedPost(null);
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post");
    }
  };

  const handleEdit = () => {
    if (!selectedPost) {
      alert("Please select a post to edit");
      return;
    }
    setFormData({
      title: selectedPost.title,
      category: selectedPost.category,
      status: selectedPost.status,
      content: selectedPost.content,
      admin_notes: selectedPost.admin_notes || ''
    });
    setShowEditModal(true);
  };

  const handleAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleSaveAdd = async () => {
    try {
      await api.createPost(formData);
      setShowAddModal(false);
      resetForm();
      fetchPosts();
    } catch (error) {
      console.error("Failed to create post:", error);
      alert("Failed to create post");
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPost) return;
    try {
      await api.updatePost(selectedPost.post_id, formData);
      setShowEditModal(false);
      setSelectedPost(null);
      fetchPosts();
    } catch (error) {
      console.error("Failed to update post:", error);
      alert("Failed to update post");
    }
  };

  const handleViewNotes = (post: Post) => {
    setSelectedPost(post);
    setShowNotesModal(true);
  };

  if (loading) return <div>Loading posts...</div>;

  return (
    <div className="posts-page">
      <div className="headerWithButton">
        <h2>Posts</h2>
        <div className="action-buttons">
          <button className="action-btn" onClick={handleAdd}>Add</button>
          <button className="action-btn" onClick={handleDelete} disabled={!selectedPost}>
            Delete
          </button>
          <button className="action-btn" onClick={handleEdit} disabled={!selectedPost}>
            Edit
          </button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No posts found. Click "Add" to create a new post.
        </div>
      ) : (
        <table className="posts-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Date</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
            <tr 
              key={post.post_id} 
              className={selectedPost?.post_id === post.post_id ? 'selected' : ''}
              onClick={() => setSelectedPost(post)}
            >
              <td>{post.title}</td>
              <td>{post.category}</td>
              <td>{post.status}</td>
              <td>{new Date(post.created_at).toLocaleDateString()}</td>
              <td>
                {post.admin_notes && (
                  <button 
                    className="notes-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewNotes(post);
                    }}
                  >
                    View Notes
                  </button>
                )}
              </td>
            </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Post</h3>
            <input type="text" placeholder="Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
            <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
              <option value="general">General</option>
              <option value="announcement">Announcement</option>
              <option value="tutorial">Tutorial</option>
              <option value="update">Update</option>
            </select>
            <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <textarea placeholder="Content" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})}></textarea>
            <textarea placeholder="Admin Notes (optional)" value={formData.admin_notes} onChange={(e) => setFormData({...formData, admin_notes: e.target.value})}></textarea>
            <div className="modal-buttons">
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
              <button onClick={handleSaveAdd}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content form-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Post</h3>
            <input type="text" placeholder="Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
            <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
              <option value="general">General</option>
              <option value="announcement">Announcement</option>
              <option value="tutorial">Tutorial</option>
              <option value="update">Update</option>
            </select>
            <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <textarea placeholder="Content" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})}></textarea>
            <textarea placeholder="Admin Notes (optional)" value={formData.admin_notes} onChange={(e) => setFormData({...formData, admin_notes: e.target.value})}></textarea>
            <div className="modal-buttons">
              <button onClick={() => setShowEditModal(false)}>Cancel</button>
              <button onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showNotesModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowNotesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Admin Notes</h3>
            <p>{selectedPost.admin_notes}</p>
            <button onClick={() => setShowNotesModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostsPage; 