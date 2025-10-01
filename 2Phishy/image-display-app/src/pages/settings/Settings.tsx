import React, { useState } from "react";
import "./settings.scss";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import TimezoneModal from "../../components/TimezoneModal/TimezoneModal";

const Settings: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleTimezoneClick = () => {
    setShowTimezoneModal(true);
  };

  return (
    <div className="settings">
      <div className="settings-container">
        <h1>Settings</h1>
        <div className="settings-sections">
          <div className="settings-section">
            <h2>System Settings</h2>
            <div className="form-group">
              <label>Language Selection</label>
              <button className="settings-button">Change Language</button>
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <button className="settings-button" onClick={handleTimezoneClick}>Set Timezone</button>
            </div>
          </div>
          <div className="settings-section">
            <h2>Data & Privacy</h2>
            <div className="form-group">
              <label>Data Management</label>
              <button className="settings-button">Export user data (CSV/Excel)</button>
            </div>
            <div className="form-group">
              <label>User Management</label>
              <button className="settings-button">Delete Users</button>
            </div>
            <div className="form-group">
              <label>Privacy</label>
              <button className="settings-button">Privacy Policy</button>
            </div>
          </div>
          <div className="settings-section">
            <h2>Notification Settings</h2>
            <div className="form-group">
              <label>
                <input type="checkbox" /> Alerts for quiz completions
              </label>
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" /> Alerts for user registrations
              </label>
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
      
      <TimezoneModal 
        isOpen={showTimezoneModal} 
        onClose={() => setShowTimezoneModal(false)} 
      />
    </div>
  );
};

export default Settings; 