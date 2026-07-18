export const getApiBaseUrl = () => {
  const configured = window.QUESTIONNAIRE_API_BASE_URL;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim().replace(/\/$/, "");
  }

  return window.location.origin;
};

export const apiUrl = (path) => {
  const cleanPath = String(path).startsWith("/") ? String(path) : `/${path}`;
  return new URL(cleanPath, getApiBaseUrl()).toString();
};
