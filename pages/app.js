const API_BASE = "http://127.0.0.1:8787";
const api = (path) => `${API_BASE}${path}`;

async function safeFetch(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Is the worker running?");
    }
    if (error.message.includes("Failed to fetch")) {
      throw new Error("Network error: verify wrangler dev is running on port 8787.");
    }
    throw error;
  }
}

function showLoading() {
  document.getElementById("loadingOverlay")?.classList.add("active");
}

function hideLoading() {
  document.getElementById("loadingOverlay")?.classList.remove("active");
}

function displayGradeBadge(grade) {
  const badge = document.getElementById("gradeBadge");
  if (!badge) return;

  badge.className = "grade-badge";
  if (typeof grade === "string" && grade.trim()) {
    const normalized = grade.trim().toUpperCase();
    badge.textContent = normalized;
    badge.classList.add(`grade-${normalized.toLowerCase()}`);
    badge.classList.add("visible");
  } else {
    badge.textContent = "";
  }
}

function getRequiredElement(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing required element: ${id}`);
  }
  return el;
}

function parseJsonInput(element, label) {
  const rawValue = element.value || "{}";
  if (!rawValue.trim()) {
    throw new Error(`${label} cannot be empty`);
  }
  return JSON.parse(rawValue);
}

async function handleLeagueInit(button, input) {
  button.disabled = true;
  const originalText = button.textContent || "Initialize League";
  button.textContent = "Initializing...";

  try {
    const body = parseJsonInput(input, "League configuration");
    console.debug("[league:init] parsed body", {
      leagueId: body?.leagueId,
      teams: Array.isArray(body?.teams) ? body.teams.length : undefined,
      players: Array.isArray(body?.players) ? body.players.length : undefined,
    });
    if (!body.leagueId || typeof body.leagueId !== "string" || !body.leagueId.trim()) {
      throw new Error("leagueId is required and must be a non-empty string");
    }

    console.debug("[league:init] sending request");
    const response = await safeFetch(api("/api/league/init"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.debug("[league:init] response status", response.status);
    if (!response.ok) {
      const text = await response.text();
      console.warn("[league:init] non-ok response body", text);
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    alert("League initialized successfully");
  } catch (error) {
    console.error("[league:init] failed", error);
    alert(`League initialization failed: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function handleTradeEvaluation(button, tradeInput, personaSelect, output) {
  button.disabled = true;
  const originalText = button.textContent || "Evaluate Trade";
  button.textContent = "Evaluating...";
  output.textContent = "";
  displayGradeBadge(null);
  showLoading();

  try {
    const proposal = parseJsonInput(tradeInput, "Trade proposal");
    if (!proposal.leagueId || typeof proposal.leagueId !== "string" || !proposal.leagueId.trim()) {
      throw new Error("proposal.leagueId is required");
    }

    const payload = {
      proposal,
      persona: personaSelect.value || "Default",
    };

    console.debug("[trade] Submitting evaluation payload", {
      leagueId: proposal.leagueId,
      from: proposal.fromTeamId,
      to: proposal.toTeamId,
      persona: payload.persona,
    });

    const response = await safeFetch(api("/api/trade/evaluate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.debug("[trade] Response status", response.status);

    if (!response.ok) {
      const text = await response.text();
       console.warn("[trade] Evaluation request failed", text);
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.debug("[trade] Evaluation result keys", Object.keys(data || {}));

    if (data.grade) {
      displayGradeBadge(data.grade);
    }
    output.textContent = data.personaWriteup || JSON.stringify(data, null, 2);
    await updateMemoryDisplay(proposal.leagueId);

  } catch (error) {
        console.error("[trade] Evaluation error", error);
        output.textContent = `Error: ${error.message}\n\n• Ensure the worker is running\n• Confirm the league is initialized`;
        displayGradeBadge(null);
  } finally {
    hideLoading();
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function updateMemoryDisplay(leagueId = "demo-nfl") {
  const memoryBox = document.getElementById("memory");
  if (!memoryBox) {
    console.error("❌ Memory element not found");
    return;
  }

  try {
    const res = await fetch(api(`/api/memory/get?leagueId=${leagueId}`));
    if (!res.ok) {
      memoryBox.textContent = `Error fetching memory: ${res.status}`;
      return;
    }

    const data = await res.json();
    console.log("🧠 Memory fetched:", data);

    memoryBox.textContent = data.personaNotes
      ? `Last Updated: ${data.lastUpdated}\n\n${data.personaNotes}`
      : "No memory summary yet. Run a few trades to build context.";
  } catch (err) {
    console.error("❌ Error fetching memory:", err);
    memoryBox.textContent = `Error fetching memory: ${err.message}`;
  }
}

// Hook up Refresh button
document.getElementById("refreshMemory").onclick = () => updateMemoryDisplay();

// Call it once on page load
updateMemoryDisplay();


window.addEventListener("DOMContentLoaded", () => {
  try {
    const initButton = getRequiredElement("init");
    const leagueInput = getRequiredElement("league");
    const evalButton = getRequiredElement("eval");
    const tradeInput = getRequiredElement("trade");
    const personaSelect = getRequiredElement("persona");
    const output = getRequiredElement("out");

    initButton.addEventListener("click", () => handleLeagueInit(initButton, leagueInput));
    evalButton.addEventListener("click", () =>
      handleTradeEvaluation(evalButton, tradeInput, personaSelect, output)
    );
  } catch (error) {
    console.error(error);
  }
});
