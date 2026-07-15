import { QUESTIONNAIRES } from "./questionnaire-data.js";

const questionnaireId = window.QUESTIONNAIRE_ID || "pretest";
const config = QUESTIONNAIRES[questionnaireId];

if (!config) {
  throw new Error(`Unknown questionnaire type: ${questionnaireId}`);
}

const elements = {
  page: document.querySelector("[data-page]"),
  header: document.querySelector("[data-header]"),
  intro: document.querySelector("[data-intro]"),
  progress: document.querySelector("[data-progress]"),
  step: document.querySelector("[data-step]"),
  notice: document.querySelector("[data-notice]"),
  footer: document.querySelector("[data-footer]"),
  themeToggle: document.querySelector("[data-theme-toggle]"),
};

const storageKey = `questionnaire-draft:${questionnaireId}`;
const themeKey = "questionnaire-theme";

let state = {
  currentStep: 0,
  answers: {},
  hydrated: false,
  submitting: false,
  submitted: false,
  backupStatus: "idle",
  errors: {},
  submissionId: null,
  notice: "",
  transitionDirection: "next",
  theme: "dark",
  googleFormsHiddenFields: null,
  draftLoadedAt: null,
};

const escapeHTML = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const setTheme = (theme) => {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(themeKey, theme);
  document.documentElement.classList.remove("theme-transitioning");
  void document.documentElement.offsetWidth;
  document.documentElement.classList.add("theme-transitioning");
  window.setTimeout(() => {
    document.documentElement.classList.remove("theme-transitioning");
  }, 240);
  if (elements.themeToggle) {
    elements.themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  }
};

const loadTheme = () => {
  const saved = localStorage.getItem(themeKey);
  if (saved === "light" || saved === "dark") {
    setTheme(saved);
    return;
  }
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  setTheme(prefersLight ? "light" : "dark");
};

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.currentStep = Number.isInteger(parsed.currentStep)
      ? Math.min(Math.max(parsed.currentStep, 0), config.steps.length - 1)
      : 0;
    state.answers = parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {};
    state.draftLoadedAt = Number.isInteger(parsed.draftLoadedAt) ? parsed.draftLoadedAt : null;
  } catch (error) {
    console.warn("Failed to restore draft:", error);
  }
};

const saveDraft = () => {
  if (state.submitted) return;
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      currentStep: state.currentStep,
      answers: state.answers,
      draftLoadedAt: state.draftLoadedAt,
      updatedAt: new Date().toISOString(),
    })
  );
};

const clearDraft = () => {
  localStorage.removeItem(storageKey);
};

const buildAnswerMap = () => {
  const answers = {};
  config.steps.forEach((step) => {
    step.questions.forEach((question) => {
      answers[question.entry] = state.answers[question.id] ?? "";
    });
  });
  return answers;
};

const currentStep = () => config.steps[state.currentStep];

const currentProgress = () => ((state.currentStep + 1) / config.steps.length) * 100;

const isLikertScaleQuestion = (question) =>
  question.type === "radio" &&
  Array.isArray(question.choices) &&
  question.choices.length === 5 &&
  question.choices.every((choice, index) => String(choice) === String(index + 1));

const renderLikertScale = (question, value, error, requiredMark) => {
  const choices = question.choices || [];
  const parsedValue = Number.parseInt(value || "", 10);
  const selectedIndex = Number.isInteger(parsedValue)
    ? Math.max(0, Math.min(choices.length - 1, parsedValue - 1))
    : Math.floor(choices.length / 2);
  const sliderValue = String(selectedIndex + 1);
  const hasValue = value !== "";
  const valueLabel =
    choices[selectedIndex] && hasValue ? `${choices[selectedIndex]}` : "Select a response";

  return `
    <div class="question ${error ? "has-error" : ""}">
      <label class="label" for="${escapeHTML(question.id)}">${escapeHTML(question.question)}${requiredMark}</label>
      ${question.helperText ? `<p class="question-helper">${escapeHTML(question.helperText)}</p>` : ""}
      <div class="likert-scale ${hasValue ? "has-value" : "is-unanswered"}">
        <div class="likert-scale__header">
          <span class="likert-scale__value">${escapeHTML(valueLabel)}</span>
          <span class="likert-scale__hint">1 = Strongly disagree · 5 = Strongly agree</span>
        </div>
        <input
          id="${escapeHTML(question.id)}"
          class="likert-slider"
          type="range"
          min="1"
          max="5"
          step="1"
          value="${escapeHTML(sliderValue)}"
          aria-valuemin="1"
          aria-valuemax="5"
          aria-valuenow="${escapeHTML(sliderValue)}"
          aria-label="${escapeHTML(question.question)}"
        />
        <div class="likert-scale__labels" aria-hidden="true">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </div>
      </div>
      ${error ? `<p class="error">${error}</p>` : ""}
    </div>
  `;
};

const validateQuestion = (question) => {
  const value = (state.answers[question.id] ?? "").trim();
  if (question.required && !value) {
    return "This field is required.";
  }

  if (question.type === "short_answer" && question.inputType === "number" && value) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue)) {
      return "Please enter a whole number.";
    }
  }

  if (question.type === "radio" && question.choices?.length && value) {
    if (!question.choices.includes(value)) {
      return "Please choose a valid answer.";
    }
  }

  return null;
};

const validateStep = (stepIndex) => {
  const errors = {};
  config.steps[stepIndex].questions.forEach((question) => {
    const message = validateQuestion(question);
    if (message) errors[question.id] = message;
  });
  state.errors = { ...state.errors, ...errors };
  return Object.keys(errors).length === 0;
};

const validateAll = () => {
  const errors = {};
  config.steps.forEach((step) => {
    step.questions.forEach((question) => {
      const message = validateQuestion(question);
      if (message) errors[question.id] = message;
    });
  });
  state.errors = errors;
  return Object.keys(errors).length === 0;
};

const updateAnswer = (question, value) => {
  state.answers[question.id] = value;
  delete state.errors[question.id];
  saveDraft();
};

const handleBeforeUnload = (event) => {
  if (state.submitted) return;
  event.preventDefault();
  event.returnValue = "";
};

const renderHeader = () => {
  elements.header.innerHTML = `
    <div>
      <p class="kicker">2Phishy Research Form</p>
      <h1 class="title">${escapeHTML(config.title)}</h1>
      <p class="subtitle">${escapeHTML(config.subtitle)}</p>
    </div>
    <button type="button" class="theme-toggle" data-theme-toggle>${state.theme === "dark" ? "Light mode" : "Dark mode"}</button>
  `;
  elements.header.querySelector("[data-theme-toggle]").addEventListener("click", () => {
    setTheme(state.theme === "dark" ? "light" : "dark");
  });
};

const renderIntro = () => {
  elements.intro.innerHTML = `
    <div class="card intro-card">
      <div class="intro-copy">
        ${config.intro.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join("")}
      </div>
    </div>
  `;
};

const renderProgress = () => {
  elements.progress.innerHTML = `
    <div class="card progress-card sticky-progress">
      <div class="progress-meta">
        <span>Section ${state.currentStep + 1} of ${config.steps.length}</span>
        <span>${Math.round(currentProgress())}%</span>
      </div>
      <div class="track" aria-hidden="true">
        <div class="fill" style="width:${currentProgress()}%"></div>
      </div>
      <div class="chips" aria-hidden="true">
        ${config.steps
          .map((_, index) => {
            const classes = ["chip"];
            if (index === state.currentStep) classes.push("active");
            if (index < state.currentStep) classes.push("complete");
            return `<span class="${classes.join(" ")}">${index + 1}</span>`;
          })
          .join("")}
      </div>
    </div>
  `;
};

const renderQuestion = (question) => {
  const value = state.answers[question.id] ?? "";
  const error = state.errors[question.id];
  const requiredMark = question.required ? '<span class="required">*</span>' : "";

  if (question.type === "short_answer") {
    return `
      <div class="question ${error ? "has-error" : ""}">
        <label class="label" for="${escapeHTML(question.id)}">${escapeHTML(question.question)}${requiredMark}</label>
        ${question.helperText ? `<p class="question-helper">${escapeHTML(question.helperText)}</p>` : ""}
        <input
          id="${escapeHTML(question.id)}"
          class="input"
          type="${question.inputType === "number" ? "number" : "text"}"
          inputmode="${question.inputType === "number" ? "numeric" : "text"}"
          placeholder="${escapeHTML(question.placeholder || "")}"
          value="${escapeHTML(value)}"
        />
        ${error ? `<p class="error">${error}</p>` : ""}
      </div>
    `;
  }

  if (isLikertScaleQuestion(question)) {
    return renderLikertScale(question, value, error, requiredMark);
  }

  return `
    <div class="question ${error ? "has-error" : ""}">
      <label class="label">${escapeHTML(question.question)}${requiredMark}</label>
      ${question.helperText ? `<p class="question-helper">${escapeHTML(question.helperText)}</p>` : ""}
      <div class="radio-group">
        ${question.choices
          .map(
            (choice) => `
              <label class="radio-option">
                <input type="radio" name="${escapeHTML(question.id)}" value="${escapeHTML(choice)}" ${value === choice ? "checked" : ""}/>
                <span>${escapeHTML(choice)}</span>
              </label>
            `
          )
          .join("")}
      </div>
      ${error ? `<p class="error">${error}</p>` : ""}
    </div>
  `;
};

const renderStep = () => {
  const step = currentStep();
  elements.step.innerHTML = `
    <div class="card step-card step-card--${state.transitionDirection}">
      <div class="section-head">
        <div>
          <h2 class="section-title">${escapeHTML(step.title)}</h2>
          ${step.description ? `<p class="section-description">${escapeHTML(step.description)}</p>` : ""}
        </div>
      </div>
      ${
        step.questions.length
          ? `
            <div class="questions">
              ${step.questions.map(renderQuestion).join("")}
            </div>
          `
          : ""
      }
    </div>
  `;

  step.questions.forEach((question) => {
    if (question.type === "short_answer") {
      const input = elements.step.querySelector(`#${CSS.escape(question.id)}`);
      input.addEventListener("input", (event) => updateAnswer(question, event.target.value));
    } else if (isLikertScaleQuestion(question)) {
      const input = elements.step.querySelector(`#${CSS.escape(question.id)}`);
      input.addEventListener("input", (event) => updateAnswer(question, event.target.value));
      input.addEventListener("change", (event) => updateAnswer(question, event.target.value));
    } else {
      elements.step.querySelectorAll(`input[name="${CSS.escape(question.id)}"]`).forEach((input) => {
        input.addEventListener("change", (event) => updateAnswer(question, event.target.value));
      });
    }
  });
};

const renderFooter = () => {
  const isFirst = state.currentStep === 0;
  const isLast = state.currentStep === config.steps.length - 1;
  elements.footer.innerHTML = `
    <div class="card intro-card footer">
      <div class="footer-status">
        ${state.backupStatus === "sent" ? "Autosaved and backed up." : ""}
        ${state.backupStatus === "failed" ? '<span class="warning">Backup pending for Google Forms.</span>' : ""}
      </div>
      <div class="btn-group">
        <button type="button" class="secondary" data-prev ${isFirst || state.submitting ? "disabled" : ""}>Previous</button>
        <button type="button" class="primary" data-next ${state.submitting ? "disabled" : ""}>
          ${state.submitting ? "Submitting…" : isLast ? "Submit" : "Next"}
        </button>
      </div>
    </div>
  `;

  const prev = elements.footer.querySelector("[data-prev]");
  const next = elements.footer.querySelector("[data-next]");

  prev?.addEventListener("click", () => {
    if (state.currentStep > 0) {
      state.transitionDirection = "prev";
      state.currentStep -= 1;
      state.errors = {};
      saveDraft();
      render();
    }
  });

  next?.addEventListener("click", async () => {
    if (isLast) {
      await submit();
      return;
    }

    if (validateStep(state.currentStep)) {
      state.transitionDirection = "next";
      state.currentStep += 1;
      saveDraft();
      render();
    } else {
      render();
    }
  });
};

const renderNotice = () => {
  elements.notice.innerHTML = state.submitted
    ? `
      <div class="card success-shell success">
        <div class="check"><span>✓</span></div>
        <h2>Submission complete</h2>
        <p class="completion-copy">${escapeHTML(config.completionCopy)}</p>
        <p class="meta">Backend submission ID: ${escapeHTML(state.submissionId || "n/a")}</p>
        ${
          state.backupStatus === "sent"
            ? '<p class="meta">Google Forms backup sent.</p>'
            : state.backupStatus === "failed"
              ? '<p class="meta warning">Backend save succeeded, but the Google Forms backup could not be confirmed.</p>'
              : ""
        }
      </div>
    `
    : "";
};

const loadGoogleFormsMeta = async () => {
  try {
    const metaResponse = await fetch(`/api/google-forms/meta?questionnaire_type=${encodeURIComponent(questionnaireId)}`);
    if (!metaResponse.ok) {
      return;
    }

    const meta = await metaResponse.json();
    state.googleFormsHiddenFields = meta.hidden_fields || null;
    if (!state.draftLoadedAt) {
      state.draftLoadedAt = Date.now();
      saveDraft();
    }
  } catch (error) {
    console.warn("Failed to preload Google Forms metadata:", error);
  }
};

const submitGoogleForms = async () => {
  // Minimal payload that Google actually accepts: only the answered entry.*
  // fields plus fvv/pageHistory. Both forms are single-page, so pageHistory is
  // "0" — any larger value (and any malformed draftResponse/sentinel) makes
  // Google reject the whole submission with HTTP 400.
  const payload = new URLSearchParams();
  payload.set("fvv", "1");
  payload.set("pageHistory", "0");

  config.steps.forEach((step) => {
    step.questions.forEach((question) => {
      const answer = String(state.answers[question.id] ?? "");
      if (answer === "") {
        return; // never submit empty values — Google rejects empty required fields
      }
      const formEntry = question.googleFormsEntry || question.entry;
      const formValue =
        question.googleFormsOtherValue && answer === "Other" ? question.googleFormsOtherValue : answer;
      payload.set(formEntry, formValue);
    });
  });

  await fetch(config.googleFormsEndpoint, {
    method: "POST",
    mode: "no-cors",
    body: payload,
  });
};

const submit = async () => {
  if (!validateAll()) {
    render();
    return;
  }

  state.submitting = true;
  state.backupStatus = "idle";
  render();

  try {
    const response = await fetch("/api/questionnaires/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questionnaire_type: questionnaireId,
        participant_id: state.answers.participant_id || "Unknown",
        answers: buildAnswerMap(),
        current_step: state.currentStep,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
        theme: state.theme,
        autosave_snapshot: {
          questionnaire_id: questionnaireId,
          current_step: state.currentStep,
          answers: state.answers,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to save questionnaire submission");
    }

    const backendResult = await response.json();
    state.submissionId = backendResult.submission_id;

    try {
      await submitGoogleForms();
      state.backupStatus = "sent";
    } catch (error) {
      console.warn("Google Forms backup failed:", error);
      state.backupStatus = "failed";
    }

    state.submitted = true;
    clearDraft();
    window.removeEventListener("beforeunload", handleBeforeUnload);
    render();
  } catch (error) {
    const message = error?.message || "Submission failed.";
    state.notice = message;
    alert(message);
  } finally {
    state.submitting = false;
    render();
  }
};

const render = () => {
  renderHeader();
  renderIntro();
  renderProgress();

  if (state.submitted) {
    elements.step.innerHTML = "";
    elements.footer.innerHTML = "";
    renderNotice();
    return;
  }

  renderStep();
  renderFooter();
  renderNotice();
  saveDraft();
};

const boot = () => {
  document.title = config.title;
  loadTheme();
  loadDraft();
  if (!state.draftLoadedAt) {
    state.draftLoadedAt = Date.now();
  }
  state.transitionDirection = "next";
  state.hydrated = true;
  window.addEventListener("beforeunload", handleBeforeUnload);
  render();
  void loadGoogleFormsMeta();
};

boot();
