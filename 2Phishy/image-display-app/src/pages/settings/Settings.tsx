import React, { useEffect, useState } from "react";
import "./settings.scss";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useBranding } from "../../contexts/BrandingContext";
import * as XLSX from "xlsx";
import { api } from "../../services/api";
import { SystemContentRecord, SystemContentType, SystemSettings } from "../../types";

const FULLSCREEN_MODE_STORAGE_KEY = "phishyFullscreenMode";
const EXPORT_SHEETS = {
  users: "Users",
  initialAssessments: "Initial Assessments",
  progress: "Progress",
  quizInsights: "Quiz Insights",
  reports: "Reports",
  scoreProfiles: "Score Profiles",
} as const;

const CONTENT_TOOLS: Array<{ type: SystemContentType; label: string; helper: string }> = [
  {
    type: "knowledge_base",
    label: "Knowledgebase",
    helper: "Learning content shown with generated remediation and explanations.",
  },
  {
    type: "question_base",
    label: "Questionbase",
    helper: "Game question pools, choices, answers, topics, subtopics, and difficulty.",
  },
  {
    type: "initial_assessment",
    label: "Initial Assessments",
    helper: "Assessment topics, questions, choices, answers, and subcategory mapping.",
  },
];

type ExportType = keyof typeof EXPORT_SHEETS;
type FullscreenMode = "ask" | "windowed";

const normalizeCellValue = (value: unknown): string | number | boolean | null => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
};

const normalizeRows = (rows: any[] = []) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row || {}).map(([key, value]) => [key, normalizeCellValue(value)])
    )
  );

const appendSheet = (workbook: XLSX.WorkBook, rows: any[], sheetName: string) => {
  const safeRows = normalizeRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(safeRows.length ? safeRows : [{ Notice: "No records available" }]);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
};

const getExportRows = (exportData: any, type: ExportType): any[] => {
  switch (type) {
    case "users":
      return exportData.users || [];
    case "initialAssessments":
      return exportData.initial_assessments?.summary || [];
    case "progress":
      return exportData.progress?.summary || [];
    case "quizInsights":
      return exportData.quiz_insights || [];
    case "reports":
      return exportData.reports || [];
    case "scoreProfiles":
      return exportData.score_profiles || [];
    default:
      return [];
  }
};

const escapeHtml = (value: unknown): string =>
  String(normalizeCellValue(value) ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const rowsToPrintableTable = (title: string, rows: any[]) => {
  const normalizedRows = normalizeRows(rows);
  const columns = Array.from(
    normalizedRows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  if (normalizedRows.length === 0 || columns.length === 0) {
    return `<section><h2>${escapeHtml(title)}</h2><p>No records available.</p></section>`;
  }

  return `
    <section>
      <h2>${escapeHtml(title)} <span>${normalizedRows.length} records</span></h2>
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${normalizedRows.map((row) => `
            <tr>
              ${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
};

const formatContentJson = (record: SystemContentRecord) => JSON.stringify(record.data, null, 2);

const Settings: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { branding, refreshBranding } = useBranding();
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>(() => {
    const savedMode = localStorage.getItem(FULLSCREEN_MODE_STORAGE_KEY);
    return savedMode === "windowed" ? "windowed" : "ask";
  });
  const [brandingForm, setBrandingForm] = useState<SystemSettings>(branding);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState("");
  const [contentRecord, setContentRecord] = useState<SystemContentRecord | null>(null);
  const [contentEditorValue, setContentEditorValue] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentMessage, setContentMessage] = useState("");
  const [contentError, setContentError] = useState("");
  const isSuperAdmin = user?.role === "super-admin";

  useEffect(() => {
    setBrandingForm(branding);
  }, [branding]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handlePrivacyPolicy = () => {
    navigate("/privacy-policy");
  };

  const fileDate = () => new Date().toISOString().slice(0, 10);

  const fetchExportData = async () => {
    return api.getAdminDataExport();
  };

  const writeWorkbook = (workbook: XLSX.WorkBook, filename: string) => {
    XLSX.writeFile(workbook, `${filename}-${fileDate()}.xlsx`);
  };

  const handleExport = async (type: ExportType) => {
    setExportLoading(type);
    try {
      const exportData = await fetchExportData();
      const workbook = XLSX.utils.book_new();
      appendSheet(workbook, getExportRows(exportData, type), EXPORT_SHEETS[type]);
      writeWorkbook(workbook, `${branding.system_name.toLowerCase().replace(/\s+/g, "-")}-${type}`);
    } catch (error) {
      console.error(`Failed to export ${type}:`, error);
      alert(`Failed to export ${EXPORT_SHEETS[type]}. Please try again.`);
    } finally {
      setExportLoading(null);
    }
  };

  const handleFullExport = async () => {
    setExportLoading("full");
    try {
      const exportData = await fetchExportData();
      const workbook = XLSX.utils.book_new();
      (Object.keys(EXPORT_SHEETS) as ExportType[]).forEach((type) => {
        appendSheet(workbook, getExportRows(exportData, type), EXPORT_SHEETS[type]);
      });
      appendSheet(workbook, [exportData.metadata || {}], "Export Metadata");
      appendSheet(workbook, exportData.initial_assessments?.raw || [], "Raw Initial Assessments");
      appendSheet(workbook, exportData.progress?.raw || [], "Raw Progress");
      writeWorkbook(workbook, `${branding.system_name.toLowerCase().replace(/\s+/g, "-")}-full-data-export`);
    } catch (error) {
      console.error("Failed to export full dataset:", error);
      alert("Failed to export the full dataset. Please try again.");
    } finally {
      setExportLoading(null);
    }
  };

  const handlePrintSummary = async () => {
    setExportLoading("print");
    try {
      const exportData = await fetchExportData();
      const metadata = exportData.metadata || {};
      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) {
        alert("Unable to open the print window. Please allow pop-ups and try again.");
        return;
      }

      const rows = [
        ["Users", metadata.users_count || 0],
        ["Initial Assessment Rows", metadata.initial_assessment_rows_count || 0],
        ["Progress Rows", metadata.progress_rows_count || 0],
        ["Quiz Insight Rows", metadata.quiz_insights_rows_count || 0],
        ["Reports", metadata.reports_count || 0],
        ["Score Profiles", metadata.score_profiles_count || 0],
      ];
      const datasetSections = (Object.keys(EXPORT_SHEETS) as ExportType[])
        .map((type) => rowsToPrintableTable(EXPORT_SHEETS[type], getExportRows(exportData, type)))
        .join("");

      printWindow.document.write(`
        <html>
          <head>
            <title>${escapeHtml(branding.system_name)} Data Export Summary</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
              h1 { margin-bottom: 4px; }
              p { margin-top: 0; color: #4b5563; }
              h2 { margin: 32px 0 10px; font-size: 18px; }
              h2 span { color: #6b7280; font-size: 13px; font-weight: 400; }
              table { width: 100%; border-collapse: collapse; margin-top: 24px; }
              section table { margin-top: 0; font-size: 11px; }
              th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
              th { background: #f3f4f6; }
              td { word-break: break-word; }
              @media print { body { padding: 16px; } section { page-break-inside: avoid; } }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(branding.system_name)} Data Export Summary</h1>
            <p>Exported ${metadata.exported_at || new Date().toISOString()} by ${metadata.exported_by_username || "admin"}.</p>
            <table>
              <thead><tr><th>Dataset</th><th>Records</th></tr></thead>
              <tbody>
                ${rows.map(([label, count]) => `<tr><td>${label}</td><td>${count}</td></tr>`).join("")}
              </tbody>
            </table>
            ${datasetSections}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.error("Failed to print data summary:", error);
      alert("Failed to print data summary. Please try again.");
    } finally {
      setExportLoading(null);
    }
  };

  const handleFullscreenModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode = event.target.value as FullscreenMode;
    setFullscreenMode(nextMode);
    localStorage.setItem(FULLSCREEN_MODE_STORAGE_KEY, nextMode);
    window.dispatchEvent(new Event("phishy-fullscreen-mode-change"));
  };

  const handleBrandingChange = (field: keyof SystemSettings, value: string) => {
    setBrandingForm((prev) => ({ ...prev, [field]: value }));
    setBrandingMessage("");
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBrandingMessage("Choose an image file for the logo.");
      return;
    }
    if (file.size > 750 * 1024) {
      setBrandingMessage("Logo image is too large. Use an image under 750 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBrandingForm((prev) => ({ ...prev, logo_url: String(reader.result || prev.logo_url) }));
      setBrandingMessage("Logo preview updated. Save branding to apply it for everyone.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async () => {
    setBrandingSaving(true);
    setBrandingMessage("");
    try {
      await api.updateSystemSettings({
        system_name: brandingForm.system_name,
        institution_name: brandingForm.institution_name,
        logo_url: brandingForm.logo_url,
        login_subtitle: brandingForm.login_subtitle,
        register_subtitle: brandingForm.register_subtitle,
        privacy_summary: brandingForm.privacy_summary,
        consent_text: brandingForm.consent_text,
      });
      await refreshBranding();
      setBrandingMessage("Branding saved for this institution.");
    } catch (error) {
      console.error("Failed to save branding:", error);
      setBrandingMessage(error instanceof Error ? error.message : "Failed to save branding.");
    } finally {
      setBrandingSaving(false);
    }
  };

  const openContentEditor = async (contentType: SystemContentType) => {
    setContentLoading(true);
    setContentError("");
    setContentMessage("");
    setContentRecord(null);
    try {
      const record = await api.getSystemContent(contentType);
      setContentRecord(record);
      setContentEditorValue(formatContentJson(record));
    } catch (error) {
      console.error("Failed to load content:", error);
      setContentError(error instanceof Error ? error.message : "Failed to load content.");
    } finally {
      setContentLoading(false);
    }
  };

  const closeContentEditor = () => {
    if (contentSaving) return;
    setContentRecord(null);
    setContentError("");
    setContentMessage("");
  };

  const parseEditorJson = () => {
    try {
      setContentError("");
      return JSON.parse(contentEditorValue);
    } catch {
      setContentError("Invalid JSON. Fix the structure before saving or publishing.");
      return null;
    }
  };

  const handleSaveDraft = async () => {
    if (!contentRecord) return;
    const parsed = parseEditorJson();
    if (parsed === null) return;

    setContentSaving(true);
    setContentMessage("");
    try {
      const record = await api.saveSystemContentDraft(contentRecord.content_type, parsed);
      setContentRecord(record);
      setContentEditorValue(formatContentJson(record));
      setContentMessage("Draft saved.");
    } catch (error) {
      console.error("Failed to save draft:", error);
      setContentError(error instanceof Error ? error.message : "Failed to save draft.");
    } finally {
      setContentSaving(false);
    }
  };

  const handlePublishContent = async () => {
    if (!contentRecord) return;
    const parsed = parseEditorJson();
    if (parsed === null) return;

    setContentSaving(true);
    setContentMessage("");
    try {
      const record = await api.publishSystemContent(contentRecord.content_type, parsed);
      setContentRecord(record);
      setContentEditorValue(formatContentJson(record));
      setContentMessage("Published. New game sessions will use this content.");
    } catch (error) {
      console.error("Failed to publish content:", error);
      setContentError(error instanceof Error ? error.message : "Failed to publish content.");
    } finally {
      setContentSaving(false);
    }
  };

  const exportButtonLabel = (type: ExportType) =>
    exportLoading === type ? "Preparing..." : `Download ${EXPORT_SHEETS[type]}`;

  return (
    <div className="settings">
      <div className="settings-container">
        <div className="settings-titlebar">
          <h1>Settings</h1>
        </div>

        <div className="settings-sections">
          <section className="settings-section data-section">
            <div className="section-title">
              <div>
                <h2>Data & Privacy</h2>
                <p>Export and manage system data.</p>
              </div>
            </div>
            <div className="data-management">
              {(Object.keys(EXPORT_SHEETS) as ExportType[]).map((type) => (
                <button
                  key={type}
                  className="settings-row-button"
                  onClick={() => handleExport(type)}
                  disabled={exportLoading !== null}
                >
                  <span>{exportButtonLabel(type)}</span>
                  <strong>&gt;</strong>
                </button>
              ))}
              <button
                className="settings-row-button primary-export"
                onClick={handleFullExport}
                disabled={exportLoading !== null}
              >
                <span>{exportLoading === "full" ? "Preparing..." : "Download Full Export"}</span>
                <strong>&gt;</strong>
              </button>
              <button
                className="settings-row-button"
                onClick={handlePrintSummary}
                disabled={exportLoading !== null}
              >
                <span>{exportLoading === "print" ? "Preparing..." : "Print Data Summary"}</span>
                <strong>&gt;</strong>
              </button>
              <button className="settings-row-button privacy-button" onClick={handlePrivacyPolicy}>
                <span>Privacy Policy</span>
                <strong>&gt;</strong>
              </button>
            </div>
          </section>

          <section className="settings-section display-section">
            <div className="section-title">
              <div>
                <h2>Game Display</h2>
                <p>Manage how the game opens.</p>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="fullscreenMode">Fullscreen behavior</label>
              <select
                id="fullscreenMode"
                className="settings-select"
                value={fullscreenMode}
                onChange={handleFullscreenModeChange}
              >
                <option value="ask">Ask before entering fullscreen</option>
                <option value="windowed">Use browser window</option>
              </select>
            </div>
            <div className="display-preview">
              <div className="preview-bar">
                <span />
                <span />
                <span />
              </div>
              <div className="preview-scene">
                <div />
                <div />
                <div />
              </div>
            </div>

            <div className="content-management">
              <div className="section-title compact-title">
                <div>
                  <h2>System Content</h2>
                  <p>Admins can edit institution learning content.</p>
                </div>
              </div>
              {CONTENT_TOOLS.map((tool) => (
                <button
                  key={tool.type}
                  className="content-tool-button"
                  onClick={() => openContentEditor(tool.type)}
                  disabled={contentLoading}
                >
                  <span>{tool.label}</span>
                  <small>{tool.helper}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section theme-section">
            <div className="section-title">
              <div>
                <h2>Theme</h2>
                <p>Customize the appearance.</p>
              </div>
            </div>
            <div className="theme-toggle-row">
              <button
                className={`theme-choice ${theme === "light" ? "active" : ""}`}
                onClick={() => theme === "dark" && toggleTheme()}
              >
                Light Mode
              </button>
              <button
                className={`theme-choice ${theme === "dark" ? "active" : ""}`}
                onClick={() => theme === "light" && toggleTheme()}
              >
                Dark Mode
              </button>
            </div>

            <div className="branding-panel">
              <h2>Institution Branding</h2>
              <p>Only super-admins can save branding for everyone.</p>
              <div className="brand-preview">
                <img src={brandingForm.logo_url || "/logo1.png"} alt="" />
                <div>
                  <strong>{brandingForm.system_name || "2Phishy"}</strong>
                  <span>{brandingForm.institution_name || "Institution"}</span>
                </div>
              </div>
              <label>
                System name
                <input
                  value={brandingForm.system_name}
                  onChange={(e) => handleBrandingChange("system_name", e.target.value)}
                  disabled={!isSuperAdmin || brandingSaving}
                />
              </label>
              <label>
                Institution name
                <input
                  value={brandingForm.institution_name}
                  onChange={(e) => handleBrandingChange("institution_name", e.target.value)}
                  disabled={!isSuperAdmin || brandingSaving}
                />
              </label>
              <label>
                Logo image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={!isSuperAdmin || brandingSaving}
                />
              </label>
              <label>
                Login subtitle
                <input
                  value={brandingForm.login_subtitle}
                  onChange={(e) => handleBrandingChange("login_subtitle", e.target.value)}
                  disabled={!isSuperAdmin || brandingSaving}
                />
              </label>
              <label>
                Register subtitle
                <input
                  value={brandingForm.register_subtitle}
                  onChange={(e) => handleBrandingChange("register_subtitle", e.target.value)}
                  disabled={!isSuperAdmin || brandingSaving}
                />
              </label>
              <label>
                Privacy summary
                <textarea
                  value={brandingForm.privacy_summary}
                  onChange={(e) => handleBrandingChange("privacy_summary", e.target.value)}
                  disabled={!isSuperAdmin || brandingSaving}
                />
              </label>
              <label>
                Consent text
                <textarea
                  value={brandingForm.consent_text}
                  onChange={(e) => handleBrandingChange("consent_text", e.target.value)}
                  disabled={!isSuperAdmin || brandingSaving}
                />
              </label>
              <button
                className="save-branding-button"
                onClick={handleSaveBranding}
                disabled={!isSuperAdmin || brandingSaving}
              >
                {brandingSaving ? "Saving..." : "Save Branding"}
              </button>
              {brandingMessage && <p className="settings-message">{brandingMessage}</p>}
            </div>

            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </section>
        </div>
      </div>

      {(contentLoading || contentRecord || contentError) && (
        <div className="content-modal-overlay" onClick={closeContentEditor}>
          <div className="content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="content-modal-header">
              <div>
                <h2>{contentRecord?.label || "System Content"}</h2>
                {contentRecord && (
                  <p>
                    Source: {contentRecord.source} | Published v{contentRecord.published_version} | Draft v{contentRecord.draft_version}
                  </p>
                )}
              </div>
              <button onClick={closeContentEditor} disabled={contentSaving}>
                x
              </button>
            </div>
            {contentLoading ? (
              <div className="content-loading">Loading content...</div>
            ) : contentRecord ? (
              <>
                <textarea
                  className="content-json-editor"
                  value={contentEditorValue}
                  onChange={(e) => {
                    setContentEditorValue(e.target.value);
                    setContentError("");
                    setContentMessage("");
                  }}
                  spellCheck={false}
                />
                {contentError && <p className="content-error">{contentError}</p>}
                {contentMessage && <p className="content-success">{contentMessage}</p>}
                <div className="content-modal-footer">
                  <button onClick={handleSaveDraft} disabled={contentSaving}>
                    {contentSaving ? "Saving..." : "Save Draft"}
                  </button>
                  <button className="publish-button" onClick={handlePublishContent} disabled={contentSaving}>
                    {contentSaving ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </>
            ) : (
              <p className="content-error">{contentError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
