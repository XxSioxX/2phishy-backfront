import React, { useState, useEffect } from "react";
import "./profile.scss";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { formatDatePH } from "../../utils/dateUtils";

const Profile: React.FC = () => {
  const { user, login } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [scoreProfile, setScoreProfile] = useState<any>(null);
  const [loadingScores, setLoadingScores] = useState(true);
  const [accountOpen, setAccountOpen] = useState(true);
  const [personalOpen, setPersonalOpen] = useState(true);
  const [scoreOpen, setScoreOpen] = useState(true);

  useEffect(() => {
    const fetchScoreProfile = async () => {
      if (!user || !user.userid) return;

      try {
        setLoadingScores(true);
        const profile = await api.getFullScoreProfile(user.userid);
        setScoreProfile(profile);
      } catch (error) {
        console.error("Failed to fetch score profile:", error);
      } finally {
        setLoadingScores(false);
      }
    };

    fetchScoreProfile();
  }, [user]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      if (mobile) {
        setPersonalOpen(false);
        setScoreOpen(false);
      } else {
        setPersonalOpen(true);
        setScoreOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setErrors({});
    setSuccessMessage("");
    
    try {
      // Update profile using the API
      const updatedUser = await api.updateUser(user?.userid || "", formData);
      
      // Update the auth context with new user data
      const token = localStorage.getItem('token');
      if (token) {
        login(updatedUser, token);
      }
      
      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);
    } catch (error: any) {
      console.error("Profile update failed", error);
      setErrors({
        general: error.message || "Failed to update profile. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      username: user?.username || "",
      email: user?.email || "",
    });
    setErrors({});
    setSuccessMessage("");
    setIsEditing(false);
  };

  const toggleAccount = () => setAccountOpen(!accountOpen);
  const togglePersonal = () => setPersonalOpen(!personalOpen);
  const toggleScore = () => setScoreOpen(!scoreOpen);

  if (!user) {
    return (
      <div className="profile">
        <div className="profile-container">
          <h1>Profile</h1>
          <p>Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile">
      <div className="profile-container">
        <h1>Profile</h1>
        
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
        
        {errors.general && (
          <div className="error-message general">
            {errors.general}
          </div>
        )}

        <div className="profile-sections">
          <div className="profile-section">
            <div className="section-header">
              <h2>Account Information</h2>
              <button className="toggle-button" onClick={toggleAccount}>
                <img
                  src="/expand.svg"
                  alt="toggle"
                  className={`toggle-icon ${accountOpen ? 'open' : ''}`}
                />
              </button>
            </div>
            <div className="section-content" style={{ display: accountOpen ? 'block' : 'none' }}>
              <div className="user-details">
              <div className="detail-item">
                <label>User ID:</label>
                <span>{user.userid || 'N/A'}</span>
              </div>
              {user.role && (
                <div className="detail-item">
                  <label>Role:</label>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role}
                  </span>
                </div>
              )}
              {user.account_status && (
                <div className="detail-item">
                  <label>Account Status:</label>
                  <span className={`status-badge status-${user.account_status}`}>
                    {user.account_status}
                  </span>
                </div>
              )}
              {user.created_at && (
                <div className="detail-item">
                  <label>Member Since:</label>
                  <span>{formatDatePH(user.created_at)}</span>
                </div>
              )}
              {user.last_login && (
                <div className="detail-item">
                  <label>Last Login:</label>
                  <span>{formatDatePH(user.last_login, true)}</span>
                </div>
              )}
            </div>
            </div>
          </div>

          <div className="profile-section">
            <div className="section-header">
              <h2>Personal Information</h2>
              <button className="toggle-button" onClick={togglePersonal}>
                <img
                  src="/expand.svg"
                  alt="toggle"
                  className={`toggle-icon ${personalOpen ? 'open' : ''}`}
                />
              </button>
            </div>
            <div className="section-content" style={{ display: personalOpen ? 'block' : 'none' }}>
              {user.role === 'student' ? (
              // Read-only view for students
              <div className="user-details">
                <div className="detail-item">
                  <label>Username:</label>
                  <span>{user.username}</span>
                </div>
                <div className="detail-item">
                  <label>Email:</label>
                  <span>{user.email}</span>
                </div>
                <p className="read-only-notice">
                  Profile editing is not available for student accounts. 
                  Please contact an administrator if you need to update your information.
                </p>
              </div>
            ) : (
              // Editable view for admin/super-admin users
              <>
                {isEditing ? (
                  <form onSubmit={handleSubmit} className="profile-form">
                    <div className="form-group">
                      <label htmlFor="username">Username</label>
                      <input
                        type="text"
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        className={errors.username ? "error" : ""}
                        disabled={isLoading}
                      />
                      {errors.username && (
                        <div className="error-message">{errors.username}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={errors.email ? "error" : ""}
                        disabled={isLoading}
                      />
                      {errors.email && (
                        <div className="error-message">{errors.email}</div>
                      )}
                    </div>
                    
                    <div className="form-actions">
                      <button 
                        type="button" 
                        onClick={handleCancel}
                        className="cancel-button"
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="save-button"
                        disabled={isLoading}
                      >
                        {isLoading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="user-details">
                    <div className="detail-item">
                      <label>Username:</label>
                      <span>{user.username}</span>
                    </div>
                    <div className="detail-item">
                      <label>Email:</label>
                      <span>{user.email}</span>
                    </div>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="edit-button"
                    >
                      Edit Profile
                    </button>
                  </div>
                )}
              </>
            )}
            </div>
          </div>

          <div className="profile-section">
            <div className="section-header">
              <h2>Full Score Profile</h2>
              <button className="toggle-button" onClick={toggleScore}>
                <img
                  src="/expand.svg"
                  alt="toggle"
                  className={`toggle-icon ${scoreOpen ? 'open' : ''}`}
                />
              </button>
            </div>
            <div className="section-content" style={{ display: scoreOpen ? 'block' : 'none' }}>
              {loadingScores ? (
              <div className="loading-message">Loading scores...</div>
            ) : scoreProfile ? (
              <div className="score-details">
                {scoreProfile.overall_knowledge_score !== undefined && (
                  <div className="detail-item">
                    <label>Overall Knowledge Score:</label>
                    <span className="score-value">{scoreProfile.overall_knowledge_score}</span>
                  </div>
                )}
                {scoreProfile.trust_grade && (
                  <div className="detail-item">
                    <label>Trust Grade:</label>
                    <span className="trust-grade">{scoreProfile.trust_grade}</span>
                  </div>
                )}
                {scoreProfile.trust_level && (
                  <div className="detail-item">
                    <label>Trust Level:</label>
                    <span className="trust-level">{scoreProfile.trust_level}</span>
                  </div>
                )}
                {scoreProfile.per_topic_scores && Object.keys(scoreProfile.per_topic_scores).length > 0 && (
                  <div className="topic-scores">
                    <h3>Topic Scores:</h3>
                    {Object.entries(scoreProfile.per_topic_scores).map(([topic, score]: [string, any]) => (
                      <div key={topic} className="topic-score-item">
                        <label>{topic}:</label>
                        <span>{score}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="no-scores-message">No score data available.</div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
