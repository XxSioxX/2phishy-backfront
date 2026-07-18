export const SEEKER_MARK_STORAGE_KEY = "questionnaire-seeker-mark";

export const SEEKER_MARK_PATTERN = /^SKR-[A-Z0-9]{4,5}$/;

export const normalizeSeekerMark = (value) => {
  const mark = String(value || "").trim().toUpperCase();
  return SEEKER_MARK_PATTERN.test(mark) ? mark : "";
};

export const getStoredSeekerMark = () => {
  try {
    return normalizeSeekerMark(localStorage.getItem(SEEKER_MARK_STORAGE_KEY));
  } catch {
    return "";
  }
};

export const setStoredSeekerMark = (value) => {
  const mark = normalizeSeekerMark(value);
  if (!mark) return "";

  localStorage.setItem(SEEKER_MARK_STORAGE_KEY, mark);
  return mark;
};

export const getSeekerMarkFromLocation = (location = window.location) => {
  try {
    const queryMark = new URL(location.href).searchParams.get("sid");
    return normalizeSeekerMark(queryMark);
  } catch {
    return "";
  }
};
