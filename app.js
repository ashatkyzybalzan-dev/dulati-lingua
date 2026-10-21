const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#chat-messages");
const statusLabel = document.querySelector("#chat-status");
const suggestions = document.querySelector("#suggestions");
const history = [];
let isSending = false;

document.querySelector("#year").textContent = new Date().getFullYear();

async function loadVisitorCount() {
  const countEl = document.querySelector("#visitor-count");
  try {
    const response = await fetch("/api/visitors");
    if (!response.ok) throw new Error("counter unavailable");
    const data = await response.json();
    countEl.textContent = Number.isFinite(data.count) ? data.count.toLocaleString() : "—";
  } catch {
    countEl.textContent = "—";
  }
}
loadVisitorCount();

function addMessage(role, content, extraClass = "") {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role === "user" ? "user-message" : "assistant-message"} ${extraClass}`.trim();

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "YOU" : "DL";

  const body = document.createElement("div");
  body.className = "message-content";

  const author = document.createElement("span");
  author.className = "message-author";
  author.textContent = role === "user" ? "YOU" : "DULATI AI";

  const paragraph = document.createElement("p");
  paragraph.textContent = content;

  body.append(author, paragraph);
  wrapper.append(avatar, body);
  messages.append(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return { wrapper, paragraph };
}

function setBusy(busy) {
  isSending = busy;
  sendButton.disabled = busy;
  chatInput.disabled = busy;
  sendButton.innerHTML = busy ? '<span class="spinner" aria-hidden="true">…</span>' : "<span>↑</span>";
  statusLabel.textContent = busy ? "Жауап дайындалып жатыр…" : "AI дайын";
}

async function sendMessage(text) {
  const message = text.trim();
  if (!message || isSending) return;

  addMessage("user", message);
  chatInput.value = "";
  chatInput.style.height = "auto";
  suggestions.hidden = true;
  setBusy(true);
  const typing = addMessage("assistant", "Ойланып жатырмын…", "typing");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Серверден дұрыс жауап келмеді. Кейінірек қайталап көріңіз.");
    }

    typing.wrapper.remove();

    if (!response.ok) {
      addMessage("assistant", data.error || "Жауап алу мүмкін болмады. Қайталап көріңіз.");
      statusLabel.textContent = `Қате: ${response.status}`;
      return;
    }

    addMessage("assistant", data.answer);
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: data.answer });
    if (history.length > 12) history.splice(0, history.length - 12);
    statusLabel.textContent = "Жауап дайын";
  } catch (error) {
    typing.wrapper.remove();
    addMessage("assistant", error.message || "Жауап алу мүмкін болмады. Қайталап көріңіз.");
    statusLabel.textContent = "Қосылым қатесі";
  } finally {
    setBusy(false);
    chatInput.focus();
  }
}

chatForm.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(chatInput.value);
});

chatInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 110)}px`;
});

suggestions.addEventListener("click", event => {
  const button = event.target.closest("button[data-prompt]");
  if (!button || isSending) return;
  sendMessage(button.dataset.prompt);
});

document.querySelector("#quiz-options").addEventListener("click", event => {
  const button = event.target.closest("button[data-answer]");
  if (!button) return;
  const allButtons = [...document.querySelectorAll("#quiz-options button")];
  allButtons.forEach(item => {
    item.disabled = true;
    if (item.dataset.answer === "study") item.classList.add("correct");
  });
  const feedback = document.querySelector("#quiz-feedback");
  if (button.dataset.answer === "study") {
    feedback.textContent = "Дұрыс! “Usually” тұрақты әдетті білдіреді, сондықтан Present Simple қолданылады.";
    feedback.style.color = "#137c54";
  } else {
    button.classList.add("incorrect");
    feedback.textContent = "Бұл жолы дұрыс емес. “Usually” тұрақты әдетті білдіреді: “I usually study…”.";
    feedback.style.color = "#bd4b43";
  }
});
