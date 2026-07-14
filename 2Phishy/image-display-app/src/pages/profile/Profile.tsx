import React, { useState, useEffect } from "react";
import "./profile.scss";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { formatDatePH } from "../../utils/dateUtils";
import { generateAvatarUrl } from "../../utils/avatarUtils";
import OverallScoreRing from "./components/OverallScoreRing";
import TopicScoreCard from "./components/TopicScoreCard";

interface InitialAssessmentTopic {
  topic: string;
  completed: boolean;
  completedAt?: string | null;
  questionMapCount: number;
  subcatScores: Record<string, unknown>;
  subcatPriority: unknown[];
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
      subcatPriority: Array.isArray(assessment?.subcat_priority) ? assessment.subcat_priority : [],
    };
  }).sort((a, b) => a.topic.localeCompare(b.topic));
};

const Profile: React.FC = () => {
  const { user, login } = useAuth();
  const userId = user?.userid;
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || "");
  const [scoreProfile, setScoreProfile] = useState<any>(null);
  const [loadingScores, setLoadingScores] = useState(true);
  const [initialAssessments, setInitialAssessments] = useState<InitialAssessmentTopic[]>([]);
  const [loadingInitialAssessments, setLoadingInitialAssessments] = useState(true);
  const [accountOpen, setAccountOpen] = useState<boolean>(() => {
    const v = localStorage.getItem('profile_accountOpen');
    return v !== null ? v === 'true' : true;
  });
  const [personalOpen, setPersonalOpen] = useState<boolean>(() => {
    const v = localStorage.getItem('profile_personalOpen');
    return v !== null ? v === 'true' : true;
  });
  const [scoreOpen, setScoreOpen] = useState<boolean>(() => {
    const v = localStorage.getItem('profile_scoreOpen');
    return v !== null ? v === 'true' : true;
  });
  const [initialAssessmentOpen, setInitialAssessmentOpen] = useState<boolean>(() => {
    const v = localStorage.getItem('profile_initialAssessmentOpen');
    return v !== null ? v === 'true' : true;
  });
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchScoreProfile = async () => {
      if (!userId) return;

      try {
        setLoadingScores(true);
        setLoadingInitialAssessments(true);
        const profile = await api.getFullScoreProfile(userId);
        const collectedData = await api.getUserCollectedGameData(userId).catch((error) => {
          console.warn("Failed to fetch initial assessment data:", error);
          return null;
        });
        if (cancelled) return;
        setScoreProfile(profile);
        setInitialAssessments(buildInitialAssessmentTopics(collectedData?.initial_assessments));
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch score profile:", error);
      } finally {
        if (!cancelled) {
          setLoadingScores(false);
          setLoadingInitialAssessments(false);
        }
      }
    };

    fetchScoreProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      if (mobile) {
        // Auto-collapse on mobile if no saved preference exists.
        if (localStorage.getItem('profile_personalOpen') === null) setPersonalOpen(false);
        if (localStorage.getItem('profile_scoreOpen') === null) setScoreOpen(false);
      }
      // On desktop: respect user's saved preference (do not force open)
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setAvatarPreview(user?.avatar_url || "");
  }, [user?.avatar_url]);

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

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setErrors({ general: "Choose an image file for your avatar." });
      return;
    }

    if (file.size > 500 * 1024) {
      setErrors({ general: "Avatar image is too large. Use an image under 500 KB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const avatarUrl = String(reader.result || "");
      const token = localStorage.getItem("token");
      setIsLoading(true);
      setAvatarPreview(avatarUrl);
      try {
        const savedUser = await api.updateCurrentUserProfile({ avatar_url: avatarUrl });
        if (token) {
          login(savedUser, token);
        } else {
          localStorage.setItem("user", JSON.stringify(savedUser));
        }
        setSuccessMessage("Avatar updated.");
        setErrors({});
      } catch (error: any) {
        setAvatarPreview(user.avatar_url || "");
        setErrors({
          general: error.message || "Failed to update avatar. Please try again."
        });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleAccount = () => { const v = !accountOpen; setAccountOpen(v); localStorage.setItem('profile_accountOpen', String(v)); };
  const togglePersonal = () => { const v = !personalOpen; setPersonalOpen(v); localStorage.setItem('profile_personalOpen', String(v)); };
  const toggleScore = () => { const v = !scoreOpen; setScoreOpen(v); localStorage.setItem('profile_scoreOpen', String(v)); };
  const toggleInitialAssessment = () => {
    const v = !initialAssessmentOpen;
    setInitialAssessmentOpen(v);
    localStorage.setItem('profile_initialAssessmentOpen', String(v));
  };

  const parseScore = (value: unknown): number => {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsedValue)));
  };

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
        <div className="profile-heading">
          <h1>Profile</h1>
          <div className="avatar-editor">
            <img
              src={avatarPreview || generateAvatarUrl(user.username, 72)}
              alt="User avatar"
            />
            <label>
              Change Avatar
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
            </label>
          </div>
        </div>
        
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
          <div className={`profile-section ${accountOpen ? 'open' : 'collapsed'}`}>
            <div className="section-header">
              <h2>Account Information</h2>
              <button className="toggle-button" onClick={toggleAccount} aria-expanded={accountOpen}>
                <span className={`toggle-arrow ${accountOpen ? 'open' : ''}`} aria-hidden="true">&gt;</span>
              </button>
            </div>
            {accountOpen && (
            <div className="section-content">
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
            )}
          </div>

          <div className={`profile-section ${personalOpen ? 'open' : 'collapsed'}`}>
            <div className="section-header">
              <h2>Personal Information</h2>
              <button className="toggle-button" onClick={togglePersonal} aria-expanded={personalOpen}>
                <span className={`toggle-arrow ${personalOpen ? 'open' : ''}`} aria-hidden="true">&gt;</span>
              </button>
            </div>
            {personalOpen && (
            <div className="section-content">
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
            )}
          </div>

          <div className={`profile-section ${scoreOpen ? 'open' : 'collapsed'}`}>
            <div className="section-header">
              <h2>Full Score Profile</h2>
              <button className="toggle-button" onClick={toggleScore} aria-expanded={scoreOpen}>
                <span className={`toggle-arrow ${scoreOpen ? 'open' : ''}`} aria-hidden="true">&gt;</span>
              </button>
            </div>
            {scoreOpen && (
            <div className="section-content">
              {loadingScores ? (
              <div className="loading-message">Loading scores...</div>
            ) : scoreProfile ? (
              <div className="score-details">
                <div className="score-overview">
                  {scoreProfile.overall_knowledge_score !== undefined && (
                    <OverallScoreRing score={parseScore(scoreProfile.overall_knowledge_score)} />
                  )}
                  <div className="score-meta-cards">
                    {scoreProfile.trust_grade && (
                      <div className="detail-item metric-card">
                        <label>Trust Grade</label>
                        <span className="trust-grade">{scoreProfile.trust_grade}</span>
                      </div>
                    )}
                    {scoreProfile.trust_level && (
                      <div className="detail-item metric-card">
                        <label>Trust Level</label>
                        <span className="trust-level">{scoreProfile.trust_level}</span>
                      </div>
                    )}
                  </div>
                </div>
                {scoreProfile.per_topic_scores && Object.keys(scoreProfile.per_topic_scores).length > 0 && (
                  <div className="topic-scores">
                    <h3>Topic Performance</h3>
                    <div className="topic-score-grid">
                      {Object.entries(scoreProfile.per_topic_scores).map(([topic, score]: [string, any]) => (
                        <TopicScoreCard key={topic} topic={topic} score={parseScore(score)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-scores-message">No score data available.</div>
            )}
            </div>
            )}
          </div>

          <div className={`profile-section ${initialAssessmentOpen ? 'open' : 'collapsed'}`}>
            <div className="section-header">
              <h2>Initial Assessment</h2>
              <button className="toggle-button" onClick={toggleInitialAssessment} aria-expanded={initialAssessmentOpen}>
                <span className={`toggle-arrow ${initialAssessmentOpen ? 'open' : ''}`} aria-hidden="true">&gt;</span>
              </button>
            </div>
            {initialAssessmentOpen && (
              <div className="section-content">
                {loadingInitialAssessments ? (
                  <div className="loading-message">Loading initial assessment...</div>
                ) : initialAssessments.length > 0 ? (
                  <>
                    <div className="initial-assessment-list compact-assessment-list">
                      {initialAssessments.slice(0, 3).map((assessment) => (
                        <div className="initial-assessment-card" key={assessment.topic}>
                          <div className="initial-assessment-header">
                            <h3>{assessment.topic}</h3>
                            <span className={`assessment-status ${assessment.completed ? "complete" : "pending"}`}>
                              {assessment.completed ? "Completed" : "Pending"}
                            </span>
                          </div>
                          <div className="assessment-meta">
                            <span>Questions: {assessment.questionMapCount}</span>
                            {assessment.completedAt && <span>Completed: {formatDatePH(assessment.completedAt, true)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="view-assessments-button"
                      onClick={() => setShowAssessmentModal(true)}
                    >
                      View All Assessments
                    </button>
                  </>
                ) : (
                  <div className="no-scores-message">No initial assessment data available.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showAssessmentModal && (
        <div className="profile-modal-overlay" onClick={() => setShowAssessmentModal(false)}>
          <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
            <div className="profile-modal-header">
              <div>
                <h2>All Assessments</h2>
                <p>{initialAssessments.length} topics</p>
              </div>
              <button type="button" onClick={() => setShowAssessmentModal(false)}>
                x
              </button>
            </div>
            <div className="initial-assessment-list modal-assessment-list">
              {initialAssessments.map((assessment) => (
                <div className="initial-assessment-card" key={assessment.topic}>
                  <div className="initial-assessment-header">
                    <h3>{assessment.topic}</h3>
                    <span className={`assessment-status ${assessment.completed ? "complete" : "pending"}`}>
                      {assessment.completed ? "Completed" : "Pending"}
                    </span>
                  </div>
                  <div className="assessment-meta">
                    <span>Questions: {assessment.questionMapCount}</span>
                    {assessment.completedAt && <span>Completed: {formatDatePH(assessment.completedAt, true)}</span>}
                  </div>
                  {Object.keys(assessment.subcatScores).length > 0 && (
                    <div className="assessment-score-grid">
                      {Object.entries(assessment.subcatScores).map(([label, value]) => (
                        <div className="assessment-score-pill" key={label}>
                          <span>{label}</span>
                          <strong>{String(value)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

