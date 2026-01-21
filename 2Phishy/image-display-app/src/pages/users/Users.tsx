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
  const [deactivateLoading, setDeactivateLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('student');
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);

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

  const handleDeactivate = async (user: User) => {
    const userId = getUserIdString(user);
    const newStatus = user.account_status === 'active' ? 'suspended' : 'active';

    setDeactivateLoading(userId);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.changeUserStatus(userId, newStatus);
      // Update user in local state
      setUsers(prev => prev.map(u =>
        getUserIdString(u) === userId
          ? { ...u, account_status: newStatus as "active" | "inactive" | "suspended" }
          : u
      ));
      setSuccessMessage(`User "${user.username}" has been ${newStatus === 'suspended' ? 'deactivated' : 'activated'} successfully.`);
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change user status");
      console.error("Error changing user status:", err);
    } finally {
      setDeactivateLoading(null);
    }
  };

  const handleChangeRoleClick = (user: User) => {
    setUserToChangeRole(user);
    setSelectedRole(user.role || 'student');
    setShowRoleModal(true);
  };

  // Helper function to get consistent user ID string
  const getUserIdString = (user: User): string => {
    return (user.userid?.toString() || user.id?.toString() || '').toString();
  };

  const handleRoleChange = async () => {
    if (!userToChangeRole) return;

    const userId = getUserIdString(userToChangeRole);
    setRoleChangeLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.changeUserRole(userId, selectedRole);
      // Update user in local state
      setUsers(prev => prev.map(u =>
        getUserIdString(u) === userId
          ? { ...u, role: selectedRole as "student" | "admin" | "super-admin" }
          : u
      ));
      setSuccessMessage(`User "${userToChangeRole.username}" role has been changed to "${selectedRole}" successfully.`);
      setShowRoleModal(false);
      setUserToChangeRole(null);
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change user role");
      console.error("Error changing user role:", err);
    } finally {
      setRoleChangeLoading(false);
    }
  };

  const handleRoleCancel = () => {
    setShowRoleModal(false);
    setUserToChangeRole(null);
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
          {users.map((targetUser) => (
            <div key={targetUser.userid || targetUser.id} className="user-card">
              <div className="user-info">
                <h3>{targetUser.username}</h3>
                <p className="email">{targetUser.email}</p>
                <p className="user-id">ID: {targetUser.userid || targetUser.id}</p>
                <p className="user-role">Role: {targetUser.role || 'N/A'}</p>
                <p className="account-status">Status: {targetUser.account_status || 'N/A'}</p>
                <p className="last-login">
                  Last Online: {formatDatePH(targetUser.last_login || '', true)}
                </p>
              </div>
              <div className="user-actions">
                {user.role === 'super-admin' && targetUser.role !== 'super-admin' && (
                  <>
                    <button
                      className="change-role-btn"
                      onClick={() => handleChangeRoleClick(targetUser)}
                      disabled={roleChangeLoading}
                    >
                      Change Role
                    </button>
                    <button
                      className={`deactivate-btn ${targetUser.account_status === 'suspended' ? 'activate' : ''}`}
                      onClick={() => handleDeactivate(targetUser)}
                      disabled={deactivateLoading === (targetUser.userid || targetUser.id?.toString())}
                    >
                      {deactivateLoading === (targetUser.userid || targetUser.id?.toString()) ? (
                        <>
                          <span className="loading-spinner"></span>
                          {targetUser.account_status === 'suspended' ? 'Activating...' : 'Deactivating...'}
                        </>
                      ) : (
                        targetUser.account_status === 'suspended' ? 'Activate' : 'Deactivate'
                      )}
                    </button>
                  </>
                )}
                {user.role === 'super-admin' && (
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteClick(targetUser)}
                    disabled={deleteLoading === (targetUser.userid || targetUser.id?.toString())}
                  >
                    {deleteLoading === (targetUser.userid || targetUser.id?.toString()) ? (
                      <>
                        <span className="loading-spinner"></span>
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Change Role Modal */}
      {showRoleModal && userToChangeRole && (
        <div className="modal-overlay" onClick={handleRoleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change User Role</h3>
              <button className="modal-close" onClick={handleRoleCancel}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Change role for user <strong>"{userToChangeRole.username}"</strong>
              </p>
              <div className="role-selection">
                <label>Select New Role:</label>
                <select 
                  value={selectedRole} 
                  onChange={(e) => setSelectedRole(e.target.value)}
                  disabled={roleChangeLoading}
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin (IT Admin)</option>
                  <option value="super-admin">Super Admin</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn" 
                onClick={handleRoleCancel}
                disabled={roleChangeLoading}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn" 
                onClick={handleRoleChange}
                disabled={roleChangeLoading}
              >
                {roleChangeLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Changing...
                  </>
                ) : (
                  'Change Role'
                )}
              </button>
            </div>
          </div>
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