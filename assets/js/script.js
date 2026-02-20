const STORAGE_KEY = "voiceTranscriptStudioRecordings";
const MANUAL_SOURCES_KEY = "voiceTranscriptStudioManualSources";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  mediaRecorder: null,
  recognition: null,
  audioChunks: [],
  currentTranscript: "",
  recordingStartTs: null,
  selectedId: null,
  timer: null,
};

const el = {
  title: document.querySelector("#recording-title"),
  startBtn: document.querySelector("#start-btn"),
  stopBtn: document.querySelector("#stop-btn"),
  clearLiveBtn: document.querySelector("#clear-live-btn"),
  status: document.querySelector("#recording-status"),
  duration: document.querySelector("#recording-duration"),
  liveWordCount: document.querySelector("#live-word-count"),
  liveTranscript: document.querySelector("#live-transcript"),
  list: document.querySelector("#recording-list"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailPanel: document.querySelector("#detail-panel"),
  detailName: document.querySelector("#detail-name"),
  detailCreated: document.querySelector("#detail-created"),
  detailDuration: document.querySelector("#detail-duration"),
  detailWords: document.querySelector("#detail-words"),
  detailAudio: document.querySelector("#detail-audio"),
  detailTranscript: document.querySelector("#detail-transcript"),
  copyTranscriptBtn: document.querySelector("#copy-transcript-btn"),
  transcriptChips: document.querySelector("#transcript-chips"),
  chatLog: document.querySelector("#chat-log"),
  chatInput: document.querySelector("#chat-input"),
  chatSendBtn: document.querySelector("#chat-send-btn"),
  manualSourceText: document.querySelector("#manual-source-text"),
  manualSourceName: document.querySelector("#manual-source-name"),
  saveManualSourceBtn: document.querySelector("#save-manual-source-btn"),
};

function getRecordings() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveRecordings(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getManualSources() {
  return JSON.parse(localStorage.getItem(MANUAL_SOURCES_KEY) || "[]");
}

function saveManualSources(data) {
  localStorage.setItem(MANUAL_SOURCES_KEY, JSON.stringify(data));
}

function formatDuration(totalSeconds) {
  const min = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const sec = String(totalSeconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function countWords(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

function setStatus(text) {
  el.status.textContent = text;
}

function renderRecordings() {
  const recordings = getRecordings().sort((a, b) => b.createdAt - a.createdAt);
  if (!recordings.length) {
    el.list.innerHTML = `<li class="muted">No recordings yet.</li>`;
    return;
  }

  el.list.innerHTML = recordings
    .map(
      (item) => `
      <li class="recording-item ${state.selectedId === item.id ? "active" : ""}" data-id="${item.id}">
        <strong>${item.title}</strong><br/>
        <small>${new Date(item.createdAt).toLocaleString()} • ${item.durationLabel} • ${item.wordCount} words</small>
      </li>
    `
    )
    .join("");

  [...el.list.querySelectorAll(".recording-item")].forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedId = node.dataset.id;
      renderRecordings();
      renderDetail();
    });
  });
}

function renderDetail() {
  const recordings = getRecordings();
  const recording = recordings.find((entry) => entry.id === state.selectedId);
  if (!recording) {
    el.detailEmpty.hidden = false;
    el.detailPanel.hidden = true;
    return;
  }

  el.detailEmpty.hidden = true;
  el.detailPanel.hidden = false;
  el.detailName.textContent = recording.title;
  el.detailCreated.textContent = new Date(recording.createdAt).toLocaleString();
  el.detailDuration.textContent = recording.durationLabel;
  el.detailWords.textContent = String(recording.wordCount);
  el.detailAudio.src = recording.audioDataUrl;
  el.detailTranscript.value = recording.transcript;

  const sentences = recording.transcript
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 30);

  el.transcriptChips.innerHTML = sentences
    .map((sentence, idx) => `<button class="chip" data-chip="${idx}">${idx + 1}</button>`)
    .join("");

  [...el.transcriptChips.querySelectorAll(".chip")].forEach((chip) => {
    chip.addEventListener("click", () => {
      const sentence = sentences[Number(chip.dataset.chip)] || "";
      const start = el.detailTranscript.value.indexOf(sentence);
      if (start >= 0) {
        el.detailTranscript.focus();
        el.detailTranscript.setSelectionRange(start, start + sentence.length);
      }
    });
  });
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Your browser does not support microphone recording.");
    return;
  }

  if (!SpeechRecognition) {
    alert("Speech recognition is not supported in this browser. Try Chrome/Edge.");
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  state.mediaRecorder = new MediaRecorder(stream);
  state.audioChunks = [];
  state.currentTranscript = el.liveTranscript.value.trim();
  state.recordingStartTs = Date.now();
  el.startBtn.disabled = true;
  el.stopBtn.disabled = false;
  setStatus("Recording");

  state.mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) state.audioChunks.push(event.data);
  };

  state.mediaRecorder.onstop = async () => {
    clearInterval(state.timer);
    stream.getTracks().forEach((track) => track.stop());

    const audioBlob = new Blob(state.audioChunks, { type: "audio/webm" });
    const audioDataUrl = await blobToDataURL(audioBlob);
    const durationSec = Math.max(1, Math.round((Date.now() - state.recordingStartTs) / 1000));
    const transcript = el.liveTranscript.value.trim();
    const wordCount = countWords(transcript);

    const recording = {
      id: crypto.randomUUID(),
      title: el.title.value.trim() || `Recording ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      durationSec,
      durationLabel: formatDuration(durationSec),
      wordCount,
      transcript,
      audioDataUrl,
    };

    saveRecordings([...getRecordings(), recording]);
    state.selectedId = recording.id;
    renderRecordings();
    renderDetail();
    appendChatMessage("bot", `Saved recording \"${recording.title}\" with ${wordCount} words.`);

    setStatus("Idle");
    el.startBtn.disabled = false;
    el.stopBtn.disabled = true;
    el.duration.textContent = "00:00";
  };

  state.mediaRecorder.start();
  setupRecognition();

  state.timer = setInterval(() => {
    const seconds = Math.floor((Date.now() - state.recordingStartTs) / 1000);
    el.duration.textContent = formatDuration(seconds);
  }, 400);
}

function stopRecording() {
  if (state.mediaRecorder?.state === "recording") state.mediaRecorder.stop();
  if (state.recognition) state.recognition.stop();
}

function setupRecognition() {
  state.recognition = new SpeechRecognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = "en-US";

  state.recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        state.currentTranscript += `${text.trim()} `;
      } else {
        interim += text;
      }
    }

    el.liveTranscript.value = `${state.currentTranscript}${interim}`.trim();
    el.liveWordCount.textContent = String(countWords(el.liveTranscript.value));
  };

  state.recognition.onerror = () => setStatus("Speech recognition error");
  state.recognition.onend = () => {
    if (state.mediaRecorder?.state === "recording") state.recognition.start();
  };

  state.recognition.start();
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function appendChatMessage(role, text) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.textContent = role === "user" ? `You: ${text}` : `Assistant: ${text}`;
  el.chatLog.appendChild(div);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function queryKnowledgeBase(question) {
  const normalizedQ = question.toLowerCase();
  const qTokens = normalizedQ.split(/\W+/).filter((t) => t.length > 2);

  const recordingSources = getRecordings().map((item) => ({
    sourceId: item.id,
    sourceName: item.title,
    createdAt: item.createdAt,
    text: item.transcript,
    sourceType: "recording",
  }));

  const manualSources = getManualSources().map((item) => ({
    sourceId: item.id,
    sourceName: item.name,
    createdAt: item.createdAt,
    text: item.text,
    sourceType: "manual",
  }));

  const sources = [...recordingSources, ...manualSources];
  if (!sources.length) {
    return "No transcript sources found yet. Save a recording or add a manual source first.";
  }

  const scored = sources
    .map((source) => {
      const lowered = source.text.toLowerCase();
      const score = qTokens.reduce((acc, token) => acc + (lowered.includes(token) ? 1 : 0), 0);
      return { ...source, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (!scored.length) {
    return "I couldn't find relevant lines in your transcript sources. Try a more specific question.";
  }

  const parts = scored.map((match) => {
    const snippet = match.text.split(/(?<=[.!?])\s+/).find((line) =>
      qTokens.some((token) => line.toLowerCase().includes(token))
    ) || match.text.slice(0, 180);

    return `Source: ${match.sourceName} (${match.sourceType}, ${new Date(match.createdAt).toLocaleString()})\nRelevant text: ${snippet}`;
  });

  return parts.join("\n\n");
}

el.startBtn.addEventListener("click", () => startRecording().catch((err) => {
  console.error(err);
  setStatus("Unable to start recording");
}));

el.stopBtn.addEventListener("click", stopRecording);

el.clearLiveBtn.addEventListener("click", () => {
  state.currentTranscript = "";
  el.liveTranscript.value = "";
  el.liveWordCount.textContent = "0";
});

el.copyTranscriptBtn.addEventListener("click", async () => {
  if (!el.detailTranscript.value) return;
  await navigator.clipboard.writeText(el.detailTranscript.value);
  appendChatMessage("bot", "Transcript copied to clipboard.");
});

el.chatSendBtn.addEventListener("click", () => {
  const question = el.chatInput.value.trim();
  if (!question) return;

  appendChatMessage("user", question);
  const answer = queryKnowledgeBase(question);
  appendChatMessage("bot", answer);
  el.chatInput.value = "";
});

el.saveManualSourceBtn.addEventListener("click", () => {
  const text = el.manualSourceText.value.trim();
  if (!text) return;

  const source = {
    id: crypto.randomUUID(),
    name: el.manualSourceName.value.trim() || `Manual Source ${new Date().toLocaleString()}`,
    text,
    createdAt: Date.now(),
  };

  saveManualSources([...getManualSources(), source]);
  appendChatMessage("bot", `Manual source \"${source.name}\" saved for chatbot context.`);
  el.manualSourceName.value = "";
  el.manualSourceText.value = "";
});

renderRecordings();
renderDetail();
appendChatMessage("bot", "Ready. Start recording or ask a question about saved transcripts.");
