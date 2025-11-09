const API_BASE = "https://cf-fantasy-trade-gm-agent.rehans0906.workers.dev";
const jsonHeaders = { "Content-Type": "application/json" };

const scoreboard = {
  lamp: null,
  text: null,
  set(message, state = "idle") {
    if (this.text) {
      this.text.textContent = message.toUpperCase();
    }
    if (this.lamp) {
      this.lamp.dataset.state = state;
    }
  },
};

async function apiRequest(path, init = {}) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: { ...jsonHeaders, ...(init.headers || {}) },
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error(`Invalid JSON from server: ${text}`);
  }

  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.dataset.state = isError ? "error" : "ok";
}

function unsafeParseJson(value, label) {
  if (!value?.trim()) throw new Error(`${label} cannot be empty.`);
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new Error(`${label} must be valid JSON. ${err.message}`);
  }
}

async function handleLeagueInit() {
  const input = document.getElementById("leagueInput");
  const status = document.getElementById("leagueStatus");
  try {
    scoreboard.set("INIT KICKOFF", "waiting");
    const payload = unsafeParseJson(input.value, "League payload");
    setStatus(status, "Submitting league...");
    const result = await apiRequest("/api/league/init", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(status, JSON.stringify(result, null, 2));
    scoreboard.set("LEAGUE READY", "success");
  } catch (err) {
    setStatus(status, err.message, true);
    scoreboard.set("INIT ERROR", "error");
  }
}

async function handleTradeEvaluation() {
  const tradeInput = document.getElementById("tradeInput");
  const personaInput = document.getElementById("personaInput");
  const resultBox = document.getElementById("tradeResult");
  try {
    scoreboard.set("PLAY CALL SENT", "waiting");
    const proposal = unsafeParseJson(tradeInput.value, "Trade payload");
    const body = { proposal, persona: personaInput.value || "Default" };
    setStatus(resultBox, "Evaluating trade...");
    const result = await apiRequest("/api/trade/evaluate", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setStatus(resultBox, JSON.stringify(result, null, 2));
    scoreboard.set("DRIVE COMPLETE", "success");
    await refreshMemory();
  } catch (err) {
    setStatus(resultBox, err.message, true);
    scoreboard.set("TURNOVER", "error");
  }
}

async function refreshMemory() {
  const leagueIdField = document.getElementById("memoryLeagueId");
  const memoryBox = document.getElementById("memoryOutput");
  const leagueId = leagueIdField.value.trim();
  if (!leagueId) {
    setStatus(memoryBox, "Enter a league ID to fetch memory.", true);
    scoreboard.set("NO LEAGUE", "error");
    return;
  }
  try {
    scoreboard.set("FILM ROOM SYNC", "waiting");
    setStatus(memoryBox, "Loading memory...");
    const memory = await apiRequest(`/api/memory/get?leagueId=${encodeURIComponent(leagueId)}`);
    setStatus(memoryBox, JSON.stringify(memory, null, 2));
    scoreboard.set("MEMORY UPDATED", "success");
  } catch (err) {
    setStatus(memoryBox, err.message, true);
    scoreboard.set("FILM ROOM ERROR", "error");
  }
}

function wireUi() {
  document.getElementById("initLeague")?.addEventListener("click", (evt) => {
    evt.preventDefault();
    handleLeagueInit();
  });

  document.getElementById("evaluateTrade")?.addEventListener("click", (evt) => {
    evt.preventDefault();
    handleTradeEvaluation();
  });

  document.getElementById("refreshMemory")?.addEventListener("click", (evt) => {
    evt.preventDefault();
    refreshMemory();
  });

  // Pre-fill memory league ID from trade payload if present
  const tradeInput = document.getElementById("tradeInput");
  const memoryLeagueId = document.getElementById("memoryLeagueId");
  tradeInput?.addEventListener("input", () => {
    try {
      const proposal = JSON.parse(tradeInput.value || "{}");
      if (proposal?.leagueId) {
        memoryLeagueId.value = proposal.leagueId;
      }
    } catch (_) {
      // ignore typing errors
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireUi();
  const memoryLeagueId = document.getElementById("memoryLeagueId");
  memoryLeagueId.value = "demo";
  scoreboard.lamp = document.getElementById("scoreLamp");
  scoreboard.text = document.getElementById("scoreText");
  scoreboard.set("Idle", "idle");
});
