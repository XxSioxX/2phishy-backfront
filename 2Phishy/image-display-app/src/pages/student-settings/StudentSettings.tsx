import React from "react";
import "./student-settings.scss";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

const StudentSettings: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handlePrivacyPolicy = () => {
    navigate("/privacy-policy");
  };

  return (
    <div className="student-settings">
      <div className="student-settings-container">
        <h1>Settings</h1>
        <div className="settings-sections">
          <div className="settings-section">
            <h2>Privacy & Security</h2>
            <div className="form-group">
              <label>Theme</label>
              <button className="settings-button" onClick={toggleTheme}>
                Switch to {theme === 'dark' ? 'Light' : 'Dark'} Theme
              </button>
            </div>
            <div className="form-group">
              <label>Privacy</label>
              <button className="settings-button" onClick={handlePrivacyPolicy}>Privacy Policy</button>
            </div>
            <div className="form-group">
              <label>Account</label>
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSettings;
