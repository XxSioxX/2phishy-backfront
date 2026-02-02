import React from "react";
import "./settings.scss";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

const Settings: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="settings">
      <div className="settings-container">
        <h1>Settings</h1>
        <div className="settings-sections">
          <div className="settings-section">
            <h2>Data & Privacy</h2>
            <div className="form-group">
              <button className="settings-button">Data management</button>
            </div>
            <div className="form-group">
              <button className="settings-button">User management</button>
            </div>
            <div className="form-group">
              <button className="settings-button">Privacy Policy</button>
            </div>
          </div>
          <div className="settings-section">
            <h2>Theme</h2>
            <div className="form-group">
              <button className="settings-button" onClick={toggleTheme}>
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
            <div className="form-group">
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

export default Settings;
