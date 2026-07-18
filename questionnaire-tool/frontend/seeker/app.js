import {
  getStoredSeekerMark,
  normalizeSeekerMark,
  setStoredSeekerMark,
} from "../shared/seeker-mark.js";
import { apiUrl } from "../shared/api.js";

const PRODUCTION_PRETEST_URL = "https://pretest.phishydev.tech";

const getPretestUrl = () => {
  const configured = window.QUESTIONNAIRE_PRETEST_URL;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim().replace(/\/$/, "");
  }

  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";

  if (isLocalHost) {
    return new URL("/pretest/", window.location.origin).toString();
  }

  return new URL("/pretest/", window.location.origin).toString();
};

const elements = {
  stage: document.querySelector("[data-stage]"),
};

const state = {
  seekerMark: "",
  issuing: false,
  error: "",
  copied: false,
  downloading: false,
};

const escapeHTML = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const setSeekerMark = (value) => {
  const mark = normalizeSeekerMark(value);
  if (!mark) return "";

  state.seekerMark = setStoredSeekerMark(mark);
  return state.seekerMark;
};

const loadSeekerMark = () => {
  const saved = getStoredSeekerMark();
  if (saved) {
    state.seekerMark = saved;
  }
};

const issueSeekerMark = async () => {
  state.issuing = true;
  state.error = "";
  render();

  try {
    const response = await fetch(apiUrl("/api/seeker-marks"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referrer: document.referrer || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Unable to issue a Seeker Mark.");
    }

    const payload = await response.json();
    const mark = setSeekerMark(payload.seeker_mark);
    if (!mark) {
      throw new Error("The Guild could not recognize this mark.");
    }

    state.copied = false;
  } catch (error) {
    state.error = error?.message || "Unable to issue a Seeker Mark.";
  } finally {
    state.issuing = false;
    render();
  }
};

const copySeekerMark = async () => {
  if (!state.seekerMark) return;

  try {
    await navigator.clipboard.writeText(state.seekerMark);
    state.copied = true;
    state.error = "";
    render();

    window.setTimeout(() => {
      if (!state.copied) return;
      state.copied = false;
      render();
    }, 1600);
  } catch {
    state.error = "Copy failed. You can still select the mark manually.";
    render();
  }
};

const beginAdventure = () => {
  if (!state.seekerMark) return;
  const target = `${getPretestUrl()}?sid=${encodeURIComponent(state.seekerMark)}`;
  window.location.assign(target);
};

const wrapLines = (context, text, maxWidth) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const drawCenteredLines = (context, lines, centerX, startY, lineHeight) => {
  lines.forEach((line, index) => {
    context.fillText(line, centerX, startY + index * lineHeight);
  });
};

const downloadSeekerCard = async () => {
  if (!state.seekerMark || state.downloading) return;

  state.downloading = true;
  state.error = "";
  render();

  try {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1080;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Your browser cannot create the Seeker Card image.");
    }

    context.scale(scale, scale);

    const width = canvas.width / scale;
    const height = canvas.height / scale;
    const centerX = width / 2;

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0c1220");
    gradient.addColorStop(0.5, "#10192c");
    gradient.addColorStop(1, "#070a11");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(centerX, height * 0.22, 30, centerX, height * 0.22, 460);
    glow.addColorStop(0, "rgba(111, 140, 255, 0.28)");
    glow.addColorStop(1, "rgba(111, 140, 255, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    const frameX = 160;
    const frameY = 120;
    const frameW = width - 320;
    const frameH = height - 240;

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.35)";
    context.shadowBlur = 40;
    context.shadowOffsetY = 18;
    context.fillStyle = "#111827";
    context.strokeStyle = "rgba(132, 154, 255, 0.24)";
    context.lineWidth = 2;
    roundRect(context, frameX, frameY, frameW, frameH, 26);
    context.fill();
    context.stroke();
    context.restore();

    const innerX = frameX + 20;
    const innerY = frameY + 20;
    const innerW = frameW - 40;
    const innerH = frameH - 40;

    context.strokeStyle = "rgba(132, 154, 255, 0.12)";
    context.setLineDash([10, 12]);
    context.lineWidth = 1.5;
    roundRect(context, innerX, innerY, innerW, innerH, 22);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    context.font = "700 26px Georgia, 'Times New Roman', serif";
    context.fillText("The crystal resonates...", centerX, frameY + 100);

    context.font = "600 20px Georgia, 'Times New Roman', serif";
    const subtitleLines = wrapLines(
      context,
      "You have been recognized by the Guild of Seekers.",
      760
    );
    drawCenteredLines(context, subtitleLines, centerX, frameY + 146, 28);

    context.strokeStyle = "rgba(255, 255, 255, 0.34)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(frameX + 110, frameY + 54);
    context.lineTo(width - frameX - 110, frameY + 54);
    context.stroke();

    context.beginPath();
    context.moveTo(frameX + 110, height - frameY - 54);
    context.lineTo(width - frameX - 110, height - frameY - 54);
    context.stroke();

    context.font = "700 17px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillStyle = "rgba(198, 207, 223, 0.92)";
    context.fillText("Your Seeker Mark", centerX, 500);

    const badgeW = 540;
    const badgeH = 120;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 538;
    const badgeRadius = 24;

    const badgeGradient = context.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
    badgeGradient.addColorStop(0, "rgba(111, 140, 255, 0.24)");
    badgeGradient.addColorStop(1, "rgba(138, 93, 255, 0.18)");
    context.fillStyle = badgeGradient;
    context.strokeStyle = "rgba(132, 154, 255, 0.35)";
    context.lineWidth = 2;
    roundRect(context, badgeX, badgeY, badgeW, badgeH, badgeRadius);
    context.fill();
    context.stroke();

    const runeGlow = context.createRadialGradient(centerX, badgeY + badgeH / 2, 8, centerX, badgeY + badgeH / 2, 160);
    runeGlow.addColorStop(0, "rgba(255, 255, 255, 0.96)");
    runeGlow.addColorStop(1, "rgba(122, 164, 255, 0)");
    context.fillStyle = runeGlow;
    context.beginPath();
    context.arc(centerX - 208, badgeY + badgeH / 2, 10, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ffffff";
    context.font = "800 50px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillText(state.seekerMark, centerX + 10, badgeY + 78);
    context.shadowColor = "rgba(111, 140, 255, 0.45)";
    context.shadowBlur = 18;
    context.fillStyle = "rgba(255, 255, 255, 0.95)";
    context.beginPath();
    context.arc(centerX - 208, badgeY + badgeH / 2, 10, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    const note = "Keep this mark safe. It is how the Guild will recognize your journey.";
    context.fillStyle = "rgba(198, 207, 223, 0.94)";
    context.font = "500 21px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const lines = wrapLines(context, note, 660);
    drawCenteredLines(context, lines, centerX, 736, 30);

    context.font = "600 16px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.fillStyle = "rgba(151, 245, 214, 0.86)";
    context.fillText("Guild of Seekers", centerX, height - frameY - 66);

    const link = document.createElement("a");
    link.download = `${state.seekerMark}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  } catch (error) {
    state.error = error?.message || "Unable to create the JPG card.";
  } finally {
    state.downloading = false;
    render();
  }
};

const roundRect = (context, x, y, w, h, r) => {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

const renderWelcome = () => `
  <div class="card seeker-panel seeker-welcome">
    <div class="seeker-copy">
      <p class="kicker">The Caverns Stir</p>
      <p>Welcome, Traveler.</p>
      <p>You have awakened within the Caverns.</p>
      <p>Before your journey begins, the Guild of Seekers must recognize your presence.</p>
    </div>

    <div class="seeker-cta-row">
      <button type="button" class="primary seeker-action" data-become ${state.issuing ? "disabled" : ""}>
        ${state.issuing ? "Summoning..." : "Become a Seeker"}
      </button>
    </div>

    <p class="seeker-hint">A unique Seeker Mark will be issued and kept in this browser for the session.</p>
    ${state.error ? `<p class="seeker-status seeker-status--error">${escapeHTML(state.error)}</p>` : ""}
  </div>
`;

const renderCard = () => `
  <div class="card seeker-panel seeker-card">
    <div class="seeker-frame">
      <div class="seeker-lines" aria-hidden="true">
        <span>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
        <span>The crystal resonates...</span>
        <span>You have been recognized by the Guild of Seekers.</span>
        <span>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
      </div>

      <div class="seeker-rune">
        <span class="seeker-rune__label">Your Seeker Mark</span>
        <div class="seeker-mark" role="status" aria-live="polite">
          <span class="seeker-mark__glow" aria-hidden="true"></span>
          <span class="seeker-mark__value">${escapeHTML(state.seekerMark)}</span>
        </div>
        <p class="seeker-note">
          Keep this mark safe. It is how the Guild will recognize your journey.
        </p>
      </div>

      <div class="seeker-actions">
        <button type="button" class="secondary seeker-copy-button" data-copy>
          ${state.copied ? "Seeker Mark copied!" : "Copy Seeker Mark"}
        </button>
        <button type="button" class="secondary seeker-copy-button" data-download ${state.downloading ? "disabled" : ""}>
          ${state.downloading ? "Preparing JPG..." : "Download JPG"}
        </button>
        <button type="button" class="primary seeker-action" data-begin>
          Begin Adventure
        </button>
      </div>

      <p class="seeker-status ${state.error ? "seeker-status--error" : ""}">
        ${escapeHTML(state.error || (state.copied ? "Seeker Mark copied!" : ""))}
      </p>
    </div>
  </div>
`;

const render = () => {
  if (state.seekerMark) {
    elements.stage.innerHTML = renderCard();
    elements.stage.querySelector("[data-copy]")?.addEventListener("click", copySeekerMark);
    elements.stage.querySelector("[data-download]")?.addEventListener("click", downloadSeekerCard);
    elements.stage.querySelector("[data-begin]")?.addEventListener("click", beginAdventure);
    return;
  }

  elements.stage.innerHTML = renderWelcome();
  elements.stage.querySelector("[data-become]")?.addEventListener("click", issueSeekerMark);
};

const boot = () => {
  loadSeekerMark();
  render();
};

boot();
