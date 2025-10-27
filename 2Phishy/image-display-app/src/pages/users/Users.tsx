import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { User } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { formatDatePH } from "../../utils/dateUtils";
import "./users.scss";

const Users = () => {
  const { user, isAuthenticated } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch users from backend
  const fetchUsers = async () => {
    // Double-check: only proceed if user is admin or super-admin
    if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
      console.log('Access denied: User is not admin or super-admin');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch users if user is authenticated, loaded, and is admin or super-admin
    if (isAuthenticated && user && (user.role === 'admin' || user.role === 'super-admin')) {
      fetchUsers();
    }
  }, [isAuthenticated, user]);

  // Show loading while user data is being loaded
  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  // Don't render anything if user is not admin or super-admin
  if (user.role !== 'admin' && user.role !== 'super-admin') {
    return null;
  }

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setDeleteLoading(userToDelete.userid || userToDelete.id?.toString() || '');
    setError(null);
    setSuccessMessage(null);

    try {
      await api.deleteUser(userToDelete.userid || userToDelete.id?.toString() || '');
      // Remove user from local state
      setUsers(prev => prev.filter(user => (user.userid || user.id?.toString()) !== (userToDelete.userid || userToDelete.id?.toString())));
      setSuccessMessage(`User "${userToDelete.username}" has been deleted successfully.`);
      setShowDeleteModal(false);
      setUserToDelete(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
      console.error("Error deleting user:", err);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  if (loading) {
    return (
      <div className="users">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="users">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchUsers}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="users">
      <div className="users-header">
        <h1>User Management</h1>
        <button onClick={fetchUsers} className="refresh-btn">
          Refresh
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          {successMessage}
        </div>
      )}

      {users.length === 0 ? (
        <div className="no-users">
          <p>No users found</p>
        </div>
      ) : (
        <div className="users-grid">
          {users.map((user) => (
            <div key={user.userid || user.id} className="user-card">
              <div className="user-info">
                <h3>{user.username}</h3>
                <p className="email">{user.email}</p>
                <p className="user-id">ID: {user.userid || user.id}</p>
                <p className="user-role">Role: {user.role || 'N/A'}</p>
                <p className="last-login">
                  Last Online: {formatDatePH(user.last_login || '', true)}
                </p>
              </div>
              <div className="user-actions">
                <button 
                  className="delete-btn"
                  onClick={() => handleDeleteClick(user)}
                  disabled={deleteLoading === (user.userid || user.id?.toString())}
                >
                  {deleteLoading === (user.userid || user.id?.toString()) ? (
                    <>
                      <span className="loading-spinner"></span>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Deletion</h3>
              <button className="modal-close" onClick={handleDeleteCancel}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete user <strong>"{userToDelete.username}"</strong>?
              </p>
              <p className="warning-text">
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn" 
                onClick={handleDeleteCancel}
                disabled={deleteLoading === (userToDelete.userid || userToDelete.id?.toString())}
              >
                Cancel
              </button>
              <button 
                className="confirm-delete-btn" 
                onClick={handleDeleteConfirm}
                disabled={deleteLoading === (userToDelete.userid || userToDelete.id?.toString())}
              >
                {deleteLoading === (userToDelete.userid || userToDelete.id?.toString()) ? (
                  <>
                    <span className="loading-spinner"></span>
                    Deleting...
                  </>
                ) : (
                  'Delete User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;