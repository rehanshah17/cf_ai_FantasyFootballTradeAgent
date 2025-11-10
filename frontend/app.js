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
    renderLeagueInitStatus(result, status);
    scoreboard.set("LEAGUE READY", "success");
  } catch (err) {
    setStatus(status, err.message, true);
    scoreboard.set("INIT ERROR", "error");
  }
}

async function handleTradeEvaluation() {
  const tradeInput = document.getElementById("tradeInput");
  const personaSelect = document.getElementById("personaSelect");
  const resultBox = document.getElementById("tradeResult");
  try {
    scoreboard.set("PLAY CALL SENT", "waiting");
    const proposal = unsafeParseJson(tradeInput.value, "Trade payload");
    const body = { proposal, persona: personaSelect.value || "Analytics Bot" };
    showEvaluatingState(resultBox);
    const enqueue = await apiRequest("/api/trade/evaluate", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!enqueue?.id) {
      throw new Error("Workflow did not return an id");
    }
    const evaluation = await awaitWorkflowResult(enqueue.id, resultBox);
    renderEvaluation(evaluation, resultBox);
    scoreboard.set("DRIVE COMPLETE", "success");
    await refreshMemory();
  } catch (err) {
    setStatus(resultBox, err.message, true);
    scoreboard.set("TURNOVER", "error");
  }
}

async function awaitWorkflowResult(id, resultBox) {
  try {
    return await streamWorkflowResult(id, resultBox);
  } catch (err) {
    console.warn("SSE stream unavailable, falling back to polling", err);
    scoreboard.set("STREAM FALLBACK", "waiting");
    return await pollWorkflowResult(id, resultBox);
  }
}

function streamWorkflowResult(id, resultBox) {
  return new Promise((resolve, reject) => {
    const streamUrl = `${API_BASE}/api/stream?id=${encodeURIComponent(id)}`;
    const source = new EventSource(streamUrl);

    const cleanup = () => {
      source.close();
    };

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data || "{}");
        setStatus(
          resultBox,
          `Workflow ${id}\nstate: ${data.status}\n${data.error ? `error: ${data.error}` : ""}`
        );

        if (data.status === "errored" || data.status === "terminated") {
          cleanup();
          reject(new Error(data.error || "Workflow errored"));
          return;
        }

        if (data.status === "complete" && data.output) {
          scoreboard.set("STREAM COMPLETE", "success");
          cleanup();
          const evaluation = data.output.evaluation || data.output;
          resolve(evaluation);
          return;
        }

        scoreboard.set(`STREAM ${data.status || "WAIT"}`, "waiting");
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    source.onerror = () => {
      scoreboard.set("STREAM LOST", "error");
      cleanup();
      reject(new Error("Stream connection lost"));
    };
  });
}

async function pollWorkflowResult(id, resultBox) {
  const maxAttempts = 120;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    scoreboard.set(`POLL ${attempt + 1}`, "waiting");
    const status = await apiRequest(`/api/trade/status?id=${encodeURIComponent(id)}`);
    setStatus(
      resultBox,
      `Workflow ${id}\nstate: ${status.status}\n${status.error ? `error: ${status.error}` : ""}`
    );

    if (status.status === "errored" || status.status === "terminated") {
      throw new Error(status.error || "Workflow ended without output");
    }

    if (status.status === "complete" && status.output) {
      const output = status.output;
      if (output.evaluation) {
        return output.evaluation;
      }
      return output;
    }
  }
  throw new Error("Workflow timed out before completion");
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
    renderMemory(memory, memoryBox);
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
  const personaSelect = document.getElementById("personaSelect");
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

  personaSelect.value = "Analytics Bot";
}

document.addEventListener("DOMContentLoaded", () => {
  wireUi();
  const memoryLeagueId = document.getElementById("memoryLeagueId");
  memoryLeagueId.value = "demo";
  scoreboard.lamp = document.getElementById("scoreLamp");
  scoreboard.text = document.getElementById("scoreText");
  scoreboard.set("Idle", "idle");
});

function renderLeagueInitStatus(result, statusEl) {
  if (!result || typeof result !== "object") {
    setStatus(statusEl, "League initialized.");
    return;
  }
  const message = result.ok
    ? `League ${result.leagueId || ""} initialized successfully.`
    : JSON.stringify(result);
  setStatus(statusEl, message.trim());
}

function showEvaluatingState(resultBox) {
  setStatus(resultBox, "Evaluating trade...");
  scoreboard.set("STREAM WAIT", "waiting");
}

function renderEvaluation(evaluation, resultBox) {
  const grade = evaluation?.grade ?? "N/A";
  const deltaFrom = typeof evaluation?.deltaValueFrom === "number" ? evaluation.deltaValueFrom.toFixed(1) : "0";
  const deltaTo = typeof evaluation?.deltaValueTo === "number" ? evaluation.deltaValueTo.toFixed(1) : "0";
  const personaWriteup = evaluation?.personaWriteup ?? "No persona writeup available.";

  resultBox.innerHTML = `
    <div class="evaluation-card">
      <div class="evaluation-grade">${grade}</div>
      <div class="evaluation-deltas">
        <span>From Team Δ: ${deltaFrom}</span>
        <span>To Team Δ: ${deltaTo}</span>
      </div>
      <p class="evaluation-writeup">${personaWriteup}</p>
    </div>
  `;
}

function renderMemory(memory, memoryBox) {
  if (!memory) {
    memoryBox.textContent = "No memory data available.";
    return;
  }

  const lines = [
    memory.lastUpdated ? `Last Updated: ${new Date(memory.lastUpdated).toLocaleString()}` : null,
    memory.tradeCount != null ? `Total Trades Tracked: ${memory.tradeCount}` : null,
    memory.personaNotes ? `Notes: ${memory.personaNotes}` : null,
  ].filter(Boolean);

  memoryBox.textContent = lines.length ? lines.join("\n\n") : "No memory summary yet.";
}
