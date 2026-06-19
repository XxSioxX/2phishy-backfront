import React from "react";
import "./settings.scss";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import * as XLSX from "xlsx";
import { api } from "../../services/api";

const Settings: React.FC = () => {
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

  const handleUserManagementExport = async () => {
    try {
      const users = await api.getUsers();

      const rows = users.map((user) => ({
        Username: user.username || "",
        Email: user.email || "",
        "Date Created": user.created_at
          ? new Date(user.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "",
        Active: user.account_status === "active" ? "Yes" : "No",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

      const fileDate = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `2phishy-users-${fileDate}.xlsx`);
    } catch (error) {
      console.error("Failed to export users:", error);
      alert("Failed to export users. Please try again.");
    }
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
              <button className="settings-button" onClick={handleUserManagementExport}>User management</button>
            </div>
            <div className="form-group">
              <button className="settings-button" onClick={handlePrivacyPolicy}>Privacy Policy</button>
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
