import { useState, useEffect, useCallback, type FormEvent } from "react";
import { api } from "../../services/api";
import { User } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { formatDatePH } from "../../utils/dateUtils";
import "./users.scss";

interface InitialAssessmentTopic {
  topic: string;
  completed: boolean;
  completedAt?: string | null;
  questionMapCount: number;
  subcatScores: Record<string, unknown>;
}

const buildInitialAssessmentTopics = (initialAssessmentDoc: any): InitialAssessmentTopic[] => {
  const assessments = initialAssessmentDoc?.assessments;
  if (!assessments || typeof assessments !== "object") return [];

  return Object.entries(assessments).map(([topic, assessment]: [string, any]) => {
    const questionMap = Array.isArray(assessment?.question_map) ? assessment.question_map : [];
    return {
      topic,
      completed: assessment?.assessment_completed === true,
      completedAt: assessment?.assessment_completed_at || null,
      questionMapCount: questionMap.length,
      subcatScores: assessment?.subcat_scores || {},
    };
  }).sort((a, b) => a.topic.localeCompare(b.topic));
};

const getUserIdString = (targetUser: User): string => {
  return (targetUser.userid?.toString() || targetUser.id?.toString() || '').toString();
};

const getUserCardKey = (targetUser: User): string => {
  const idKey = getUserIdString(targetUser).trim();
  if (idKey) return idKey;
  return `${targetUser.username || 'user'}::${targetUser.email || 'noemail'}`;
};

const getStatusLabel = (targetUser: User): string => {
  const status = targetUser.account_status || "inactive";
  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getStatusClass = (targetUser: User): string => {
  return targetUser.account_status || "inactive";
};

const Users = () => {
  const { user, isAuthenticated } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsModalUserKey, setDetailsModalUserKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [assessmentByUserId, setAssessmentByUserId] = useState<Record<string, InitialAssessmentTopic[]>>({});
  const [assessmentLoadingByUserId, setAssessmentLoadingByUserId] = useState<Record<string, boolean>>({});
  const [assessmentModalUser, setAssessmentModalUser] = useState<User | null>(null);
  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<string, User["role"]>>({});
  const [actionBusyByUserId, setActionBusyByUserId] = useState<Record<string, boolean>>({});
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserBusy, setCreateUserBusy] = useState(false);

  // Check if user is online (last seen within last 60 seconds, or is the current user)
  const isUserOnline = (userToCheck?: any, lastSeen?: string | null): boolean => {
    // Current user is always online if logged in
    if (user && userToCheck && (userToCheck.id === user.userid || userToCheck.userid === user.userid)) {
      return true;
    }

    const targetId = userToCheck?.userid || userToCheck?.id?.toString();
    if (targetId && onlineStatus[targetId] !== undefined) {
      return onlineStatus[targetId];
    }

    if (!lastSeen) return false;
    try {
      const lastSeenTime = new Date(lastSeen + "Z").getTime();
      const currentTime = new Date().getTime();
      const sixtySecondsMs = 60 * 1000;
      return (currentTime - lastSeenTime) < sixtySecondsMs;
    } catch {
      return false;
    }
  };

  // Fetch users from backend
  const fetchUsers = useCallback(async () => {
    // Double-check: only proceed if user is admin or super-admin
    if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
      console.log('Access denied: User is not admin or super-admin');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const [data, statuses] = await Promise.all([
        api.getUsers(),
        api.getOnlineStatus().catch((err) => {
          console.warn('Falling back to last_seen presence:', err);
          return {};
        }),
      ]);
      setUsers(data);
      setOnlineStatus(statuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Only fetch users if user is authenticated, loaded, and is admin or super-admin
    if (isAuthenticated && user && (user.role === 'admin' || user.role === 'super-admin')) {
      fetchUsers();

      // Poll every 30 seconds for real-time presence updates
      const intervalId = setInterval(fetchUsers, 30000);

      // Cleanup interval on unmount
      return () => clearInterval(intervalId);
    }
  }, [fetchUsers, isAuthenticated, user]);

  // Show loading while user data is being loaded
  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  // Don't render anything if user is not admin or super-admin
  if (user.role !== 'admin' && user.role !== 'super-admin') {
    return null;
  }

  const fetchUserInitialAssessment = async (targetUser: User) => {
    const userId = getUserIdString(targetUser);
    if (!userId || assessmentByUserId[userId] || assessmentLoadingByUserId[userId]) return;

    setAssessmentLoadingByUserId((prev) => ({ ...prev, [userId]: true }));
    try {
      const collectedData = await api.getUserCollectedGameData(userId);
      setAssessmentByUserId((prev) => ({
        ...prev,
        [userId]: buildInitialAssessmentTopics(collectedData?.initial_assessments),
      }));
    } catch (error) {
      console.warn(`Failed to fetch initial assessment for ${targetUser.username}:`, error);
      setAssessmentByUserId((prev) => ({ ...prev, [userId]: [] }));
    } finally {
      setAssessmentLoadingByUserId((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const openUserDetailsModal = (targetUser: User) => {
    setDetailsModalUserKey(getUserCardKey(targetUser));
  };

  const closeUserDetailsModal = () => {
    setDetailsModalUserKey(null);
  };

  const openInitialAssessmentModal = (targetUser: User) => {
    setAssessmentModalUser(targetUser);
    fetchUserInitialAssessment(targetUser);
  };

  const closeInitialAssessmentModal = () => {
    setAssessmentModalUser(null);
  };

  const openInitialAssessmentFromDetails = (targetUser: User) => {
    closeUserDetailsModal();
    openInitialAssessmentModal(targetUser);
  };

  const closeCreateUserModal = () => {
    if (createUserBusy) return;
    setCreateUserModalOpen(false);
    setCreateUserError(null);
    setCreateUserForm({ username: '', email: '', password: '', confirmPassword: '' });
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createUserForm.password !== createUserForm.confirmPassword) {
      setCreateUserError('Passwords do not match.');
      return;
    }

    setCreateUserBusy(true);
    setCreateUserError(null);
    try {
      await api.createAdminUser({
        username: createUserForm.username.trim(),
        email: createUserForm.email.trim(),
        password: createUserForm.password,
      });
      setCreateUserForm({ username: '', email: '', password: '', confirmPassword: '' });
      setCreateUserModalOpen(false);
      await fetchUsers();
    } catch (err) {
      setCreateUserError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setCreateUserBusy(false);
    }
  };

  const setUserActionBusy = (targetUser: User, busy: boolean) => {
    const userId = getUserIdString(targetUser);
    if (!userId) return;
    setActionBusyByUserId((prev) => ({ ...prev, [userId]: busy }));
  };

  const isSelf = (targetUser: User): boolean => {
    return getUserIdString(targetUser) === String(user.userid || user.id || "");
  };

  const handleDeleteUser = async (targetUser: User) => {
    const userId = getUserIdString(targetUser);
    if (!userId || isSelf(targetUser)) return;
    if (!window.confirm(`Delete ${targetUser.username}? This cannot be undone.`)) return;

    setUserActionBusy(targetUser, true);
    try {
      await api.deleteUser(userId);
      setUsers((prev) => prev.filter((item) => getUserIdString(item) !== userId));
      setDetailsModalUserKey((current) => current === getUserCardKey(targetUser) ? null : current);
      setAssessmentModalUser((current) => current && getUserCardKey(current) === getUserCardKey(targetUser) ? null : current);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setUserActionBusy(targetUser, false);
    }
  };

  const handleToggleSuspension = async (targetUser: User) => {
    const userId = getUserIdString(targetUser);
    if (!userId || isSelf(targetUser)) return;
    const nextStatus = targetUser.account_status === "suspended" ? "active" : "suspended";

    setUserActionBusy(targetUser, true);
    try {
      const updatedUser = await api.changeUserStatus(userId, nextStatus);
      setUsers((prev) => prev.map((item) => getUserIdString(item) === userId ? updatedUser : item));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update user status");
    } finally {
      setUserActionBusy(targetUser, false);
    }
  };

  const handleChangeRole = async (targetUser: User) => {
    const userId = getUserIdString(targetUser);
    const nextRole = roleDraftByUserId[userId] || targetUser.role;
    if (!userId || !nextRole || isSelf(targetUser) || nextRole === targetUser.role) return;

    setUserActionBusy(targetUser, true);
    try {
      const updatedUser = await api.changeUserRole(userId, nextRole);
      setUsers((prev) => prev.map((item) => getUserIdString(item) === userId ? updatedUser : item));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to change user role");
    } finally {
      setUserActionBusy(targetUser, false);
    }
  };

  const filteredUsers = users.filter((targetUser) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const idText = (targetUser.userid || targetUser.id || '').toString().toLowerCase();
    const usernameText = (targetUser.username || '').toLowerCase();
    const emailText = (targetUser.email || '').toLowerCase();
    const roleText = (targetUser.role || '').toLowerCase();
    const statusText = (targetUser.account_status || '').toLowerCase();

    return (
      idText.includes(query) ||
      usernameText.includes(query) ||
      emailText.includes(query) ||
      roleText.includes(query) ||
      statusText.includes(query)
    );
  });

  const detailsModalUser = detailsModalUserKey
    ? users.find((targetUser) => getUserCardKey(targetUser) === detailsModalUserKey) || null
    : null;

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
        <div className="header-actions">
          <input
            type="text"
            className="search-input"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={fetchUsers} className="refresh-btn">
            Refresh
          </button>
          <button onClick={() => setCreateUserModalOpen(true)} className="create-user-btn">
            Create User
          </button>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="no-users">
          <p>{users.length === 0 ? 'No users found' : 'No matching users found'}</p>
        </div>
      ) : (
        <div className="users-grid">
          {filteredUsers.map((targetUser) => {
            const cardKey = getUserCardKey(targetUser);
            const presenceLabel = isUserOnline(targetUser, targetUser.last_seen) ? "Online now" : "Offline";
            return (
              <button
                key={cardKey}
                type="button"
                className="user-card"
                onClick={() => openUserDetailsModal(targetUser)}
                aria-label={`View details for ${targetUser.username}`}
              >
                <div className="user-summary-left">
                  <h3>{targetUser.username}</h3>
                  <p className="email">{targetUser.email}</p>
                </div>
                <div className="user-summary-right">
                  <span
                    className={`account-status-badge ${getStatusClass(targetUser)}`}
                    title={presenceLabel}
                  >
                    <span className="account-status-dot"></span>
                    {getStatusLabel(targetUser)}
                  </span>
                  <span className="details-arrow" aria-hidden="true">&gt;</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detailsModalUser && (
        <div className="modal-overlay user-details-modal-overlay" onClick={closeUserDetailsModal}>
          <div className="modal-content user-details-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header user-details-header">
              <div>
                <h3>{detailsModalUser.username}</h3>
                <p>{detailsModalUser.email}</p>
              </div>
              <span className={`account-status-badge ${getStatusClass(detailsModalUser)}`}>
                <span className="account-status-dot"></span>
                {getStatusLabel(detailsModalUser)}
              </span>
              <button className="modal-close" onClick={closeUserDetailsModal}>
                x
              </button>
            </div>
            <div className="modal-body">
              <section className="user-detail-section">
                <h4>User Information</h4>
                <div className="user-detail-grid">
                  <div className="user-detail-item">
                    <span>User ID</span>
                    <strong>{detailsModalUser.userid || detailsModalUser.id || "N/A"}</strong>
                  </div>
                  <div className="user-detail-item">
                    <span>Role</span>
                    <strong>{detailsModalUser.role || "N/A"}</strong>
                  </div>
                  <div className="user-detail-item">
                    <span>Account Status</span>
                    <strong>{getStatusLabel(detailsModalUser)}</strong>
                  </div>
                  <div className="user-detail-item">
                    <span>Last Seen</span>
                    <strong>{formatDatePH(detailsModalUser.last_seen || "", true)}</strong>
                  </div>
                </div>
              </section>

              <section className="user-detail-section">
                <h4>Actions</h4>
                <div className="user-management-actions">
                  <button
                    type="button"
                    className="assessment-link-button"
                    onClick={() => openInitialAssessmentFromDetails(detailsModalUser)}
                  >
                    View Initial Assessment
                  </button>
                  {user.role === "super-admin" && (
                    <div className="role-action">
                      <select
                        value={roleDraftByUserId[getUserIdString(detailsModalUser)] || detailsModalUser.role || "student"}
                        onChange={(event) =>
                          setRoleDraftByUserId((prev) => ({
                            ...prev,
                            [getUserIdString(detailsModalUser)]: event.target.value as User["role"],
                          }))
                        }
                        disabled={actionBusyByUserId[getUserIdString(detailsModalUser)] || isSelf(detailsModalUser)}
                      >
                        <option value="student">Student</option>
                        <option value="admin">Admin</option>
                        <option value="super-admin">Super Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleChangeRole(detailsModalUser)}
                        disabled={actionBusyByUserId[getUserIdString(detailsModalUser)] || isSelf(detailsModalUser)}
                      >
                        Change Role
                      </button>
                    </div>
                  )}
                  <div className="user-action-row">
                    <button
                      type="button"
                      className="suspend-user-button"
                      onClick={() => handleToggleSuspension(detailsModalUser)}
                      disabled={actionBusyByUserId[getUserIdString(detailsModalUser)] || isSelf(detailsModalUser)}
                    >
                      {detailsModalUser.account_status === "suspended" ? "Activate" : "Suspend"}
                    </button>
                    <button
                      type="button"
                      className="delete-user-button"
                      onClick={() => handleDeleteUser(detailsModalUser)}
                      disabled={actionBusyByUserId[getUserIdString(detailsModalUser)] || isSelf(detailsModalUser)}
                    >
                      Delete User
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {assessmentModalUser && (
        <div className="modal-overlay assessment-modal-overlay" onClick={closeInitialAssessmentModal}>
          <div className="modal-content assessment-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{assessmentModalUser.username} Initial Assessment</h3>
                <p>{assessmentModalUser.email}</p>
              </div>
              <button className="modal-close" onClick={closeInitialAssessmentModal}>
                x
              </button>
            </div>
            <div className="modal-body">
              {assessmentLoadingByUserId[getUserIdString(assessmentModalUser)] ? (
                <p className="assessment-loading">Loading initial assessment...</p>
              ) : (assessmentByUserId[getUserIdString(assessmentModalUser)] || []).length > 0 ? (
                <div className="assessment-topic-list modal-topic-list">
                  {(assessmentByUserId[getUserIdString(assessmentModalUser)] || []).map((assessment) => (
                    <div className="assessment-topic-card" key={assessment.topic}>
                      <div className="assessment-topic-header">
                        <span>{assessment.topic}</span>
                        <em className={assessment.completed ? "complete" : "pending"}>
                          {assessment.completed ? "Completed" : "Pending"}
                        </em>
                      </div>
                      <div className="assessment-topic-meta">
                        <span>{assessment.questionMapCount} questions</span>
                        {assessment.completedAt && <span>{formatDatePH(assessment.completedAt, true)}</span>}
                      </div>
                      {Object.keys(assessment.subcatScores).length > 0 && (
                        <div className="assessment-topic-scores">
                          {Object.entries(assessment.subcatScores).map(([label, value]) => (
                            <span key={label}>{label}: <strong>{String(value)}</strong></span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="assessment-empty">No initial assessment data available.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeInitialAssessmentModal}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {createUserModalOpen && (
        <div className="modal-overlay" onClick={closeCreateUserModal}>
          <form className="modal-content create-user-modal-content" onSubmit={handleCreateUser} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Create User</h3>
                <p>New accounts are created as students.</p>
              </div>
              <button type="button" className="modal-close" onClick={closeCreateUserModal} aria-label="Close create user form">
                x
              </button>
            </div>
            <div className="modal-body create-user-form">
              <label>
                Username
                <input
                  required
                  value={createUserForm.username}
                  onChange={(event) => setCreateUserForm((prev) => ({ ...prev, username: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={createUserForm.email}
                  onChange={(event) => setCreateUserForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label>
                Password
                <input
                  required
                  type="password"
                  value={createUserForm.password}
                  onChange={(event) => setCreateUserForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </label>
              <label>
                Confirm password
                <input
                  required
                  type="password"
                  value={createUserForm.confirmPassword}
                  onChange={(event) => setCreateUserForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                />
              </label>
              {createUserError && <p className="create-user-error">{createUserError}</p>}
            </div>
            <div className="modal-footer">
              <button type="button" className="cancel-btn" onClick={closeCreateUserModal} disabled={createUserBusy}>
                Cancel
              </button>
              <button type="submit" className="confirm-btn" disabled={createUserBusy}>
                {createUserBusy ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Users;
