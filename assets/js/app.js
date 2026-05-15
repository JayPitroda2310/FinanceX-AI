const tickerData = [
  { s: "NIFTY 50", v: "24,832", c: "+0.42%", u: 1 },
  { s: "SENSEX", v: "81,640", c: "+0.38%", u: 1 },
  { s: "BTC/USD", v: "$103,420", c: "+2.1%", u: 1 },
  { s: "ETH/USD", v: "$3,840", c: "+1.7%", u: 1 },
  { s: "GOLD", v: "$2,380", c: "-0.12%", u: 0 },
  { s: "USD/INR", v: "83.72", c: "+0.05%", u: 1 },
  { s: "CRUDE OIL", v: "$78.4", c: "+0.9%", u: 1 },
  { s: "NIKKEI", v: "38,950", c: "+0.25%", u: 1 },
  { s: "DOW JONES", v: "39,760", c: "-0.1%", u: 0 },
  { s: "RELIANCE", v: "Rs2,890", c: "+1.2%", u: 1 },
  { s: "TCS", v: "Rs4,120", c: "-0.5%", u: 0 },
  { s: "HDFC BANK", v: "Rs1,780", c: "+0.8%", u: 1 }
];

const welcomeCards = [
  {
    icon: "&#128640;",
    title: "Start Investing",
    subtitle: "Beginner's first steps",
    question: "How do I start investing with Rs5000 per month in India?"
  },
  {
    icon: "&#128161;",
    title: "50-30-20 Rule",
    subtitle: "Budget smarter",
    question: "What is the 50-30-20 budgeting rule and how do I apply it?"
  },
  {
    icon: "&#9888;",
    title: "Common Mistakes",
    subtitle: "What to avoid",
    question: "What are the top 5 financial mistakes young Indians make and how to avoid them?"
  },
  {
    icon: "&#128202;",
    title: "Nifty vs Sensex",
    subtitle: "Know the indices",
    question: "What is the difference between Nifty 50 and Sensex?"
  }
];

const SYS = `You are FinanceAI, an expert financial educator specializing in Indian and global markets.

Cover: Indian stock markets (NSE, BSE, Nifty, Sensex), mutual funds, SIP, ETFs, index funds, personal budgeting, cryptocurrency, blockchain, DeFi, options/futures, Indian tax planning (80C, 80D, LTCG, STCG, NPS, PPF, ELSS), retirement planning, insurance, inflation, RBI/Fed policy, and portfolio management.

Style rules:
- Be BRIEF and DIRECT. 3-5 bullet points max. No long paragraphs.
- Lead with the answer immediately - no preamble or filler.
- Use bullet points only. Skip headers unless absolutely needed.
- Bold only the single most important term per point.
- Default to Indian Rupee (Rs) - user is in Vadodara, Gujarat, India
- Skip the disclaimer unless specifically about personal investment decisions.`;

const state = {
  history: [],
  busy: false
};

const messagesEl = document.getElementById("msgs");
const inputEl = document.getElementById("msg");
const sendBtnEl = document.getElementById("sendbtn");
const errorEl = document.getElementById("errbar");
const tickerEl = document.getElementById("tkr");
const clearChatBtn = document.getElementById("clear-chat-btn");
const quickQuestionButtons = document.querySelectorAll("[data-question]");
let deferredInstallPrompt = null;
const API_CANDIDATES = buildApiCandidates();
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL_ID = "openrouter/auto";
const OPENROUTER_FALLBACK_MODELS = [];

init();

function init() {
  renderTicker();
  renderWelcome();
  setupPwaSupport();

  quickQuestionButtons.forEach((button) => {
    button.addEventListener("click", () => ask(button.dataset.question));
  });

  clearChatBtn.addEventListener("click", clearChat);
  sendBtnEl.addEventListener("click", send);
  inputEl.addEventListener("input", () => resize(inputEl));
  inputEl.addEventListener("keydown", onKey);
}

function setupPwaSupport() {
  const isLocalFile = window.location.protocol === "file:";
  const supportsServiceWorker = "serviceWorker" in navigator;
  const supportsInstallPrompt = "onbeforeinstallprompt" in window;

  if (isLocalFile) {
    showErr("Install requires localhost or HTTPS. For phone install, host this app on HTTPS and open that link on your mobile.");
    return;
  }

  if (!window.isSecureContext) {
    showErr("Install requires a secure context. Use HTTPS or localhost to enable app installation.");
    return;
  }

  if (!supportsServiceWorker) {
    showErr("This browser does not support app installation for this project.");
    return;
  }

  registerServiceWorker();
  setupInstallPrompt(supportsInstallPrompt);
}

function registerServiceWorker() {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      showErr("Service worker registration failed. Use localhost or HTTPS to enable install support.");
    });
  });
}

function setupInstallPrompt(supportsInstallPrompt) {
  if (!supportsInstallPrompt) {
    showErr("Use your browser menu and choose Add to Home Screen after opening this on HTTPS or localhost.");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showErr("Install available: use your browser menu or tap here to add FinanceAI to your home screen.");
    errorEl.style.cursor = "pointer";
    errorEl.onclick = promptInstall;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    errorEl.onclick = null;
    errorEl.style.cursor = "default";
    showErr("FinanceAI was installed successfully.");
  });
}

async function promptInstall() {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  errorEl.onclick = null;
  errorEl.style.cursor = "default";
}

function renderTicker() {
  tickerEl.innerHTML = [...tickerData, ...tickerData]
    .map(
      (item) =>
        `<span class="ti"><span class="ts">${item.s}</span><span class="tv">${item.v}</span><span class="${item.u ? "tu" : "td"}">${item.c}</span><span class="tp">|</span></span>`
    )
    .join("");
}

function renderWelcome() {
  messagesEl.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="orb">&#9672;</div>
      <h1>AI FINANCE<br/><em>TERMINAL</em></h1>
      <p>// Query stocks &#183; crypto &#183; budgets &#183; taxes &#183; markets<br/>Select a module or enter a command below.</p>
      <div class="qgrid">
        ${welcomeCards
          .map(
            (card) => `
              <div class="qcard" data-question="${escAttr(card.question)}">
                <span class="qi">${card.icon}</span>
                <div class="qt">${card.title}</div>
                <div class="qs">${card.subtitle}</div>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;

  messagesEl.querySelectorAll(".qcard").forEach((card) => {
    card.addEventListener("click", () => ask(card.dataset.question));
  });
}

async function send() {
  const text = inputEl.value.trim();
  if (!text || state.busy) {
    return;
  }

  hideErr();
  removeWelcome();
  addMsg("usr", text);
  state.history.push({ role: "user", content: text });
  inputEl.value = "";
  resize(inputEl);

  const typingEl = addTyping();
  state.busy = true;
  sendBtnEl.disabled = true;

  try {
    const payload = {
      messages: [
        { role: "system", content: SYS },
        ...state.history
      ]
    };
    const response = await postChatRequest(payload);

    const rawBody = await response.text();
    const data = parseJson(rawBody);
    typingEl.remove();

    if (!response.ok) {
      if (isDirectKeyError(response.status, data)) {
        clearStoredOpenRouterKey();
      }

      showErr(getApiErrorMessage(response.status, data));
      state.history.pop();
    } else {
      const reply = getReplyText(data);
      state.history.push({ role: "assistant", content: reply });
      addMsg("ai", reply);
    }
  } catch (error) {
    typingEl.remove();
    showErr(getRequestFailureMessage(error));
    state.history.pop();
  }

  state.busy = false;
  sendBtnEl.disabled = false;
  inputEl.focus();
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

function getReplyText(data) {
  const firstChoice = data.choices?.[0];
  const messageContent = firstChoice?.message?.content;
  const directText =
    firstChoice?.text ||
    data.reply ||
    data.output_text ||
    data.response?.output_text ||
    data.message?.content;

  if (typeof messageContent === "string" && messageContent.trim()) {
    return messageContent;
  }

  if (typeof directText === "string" && directText.trim()) {
    return directText;
  }

  if (Array.isArray(messageContent)) {
    const text = messageContent
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (typeof item?.text === "string") {
          return item.text;
        }

        if (typeof item?.content === "string") {
          return item.content;
        }

        return "";
      })
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  return "I did not receive readable text from the model. Please try again.";
}

function getApiErrorMessage(status, data) {
  const detailedMessage =
    data.error?.metadata?.raw ||
    data.error?.metadata?.message ||
    data.error?.message ||
    data.message;

  if (detailedMessage) {
    return detailedMessage;
  }

  if (status === 401) {
    return "Invalid API key. Update the key and try again.";
  }

  if (status === 403) {
    return "Server request was blocked. Verify the OpenRouter key and deployment settings.";
  }

  if (status === 404) {
    return "Chat API route was not found. FinanceAI can still work through the browser fallback after you enter a valid OpenRouter API key.";
  }

  if (status === 429) {
    return "Rate limit reached. Please wait a moment and try again.";
  }

  if (status === 503) {
    return "Free model providers are unavailable right now. Please try again in a moment.";
  }

  return `API error ${status}.`;
}

async function postChatRequest(payload) {
  let lastResponse = null;
  let lastError = null;

  for (const apiUrl of API_CANDIDATES) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (shouldUseBrowserFallback(response)) {
        return postDirectToOpenRouter(payload);
      }

      if (response.status !== 404 || apiUrl === API_CANDIDATES[API_CANDIDATES.length - 1]) {
        return response;
      }

      lastResponse = response;
    } catch (error) {
      lastError = error;
    }
  }

  const storedKey = getStoredOpenRouterKey(false);
  if (storedKey) {
    return postDirectToOpenRouter(payload, storedKey);
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error("No API endpoint was reachable.");
}

function shouldUseBrowserFallback(response) {
  return response.status === 404 || response.status === 500 || response.status === 502 || response.status === 503;
}

async function postDirectToOpenRouter(payload, apiKey = getStoredOpenRouterKey(true)) {
  if (!apiKey) {
    throw new Error("missing-browser-openrouter-key");
  }

  return fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.href,
      "X-Title": "FinanceAI"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL_ID,
      models: OPENROUTER_FALLBACK_MODELS,
      max_tokens: 400,
      temperature: 0.4,
      provider: {
        allow_fallbacks: true
      },
      messages: payload.messages
    })
  });
}

function getStoredOpenRouterKey(allowPrompt) {
  try {
    const configuredKey = window.FINANCEAI_CONFIG?.openRouterApiKey;
    if (configuredKey && configuredKey.trim()) {
      const normalizedConfiguredKey = configuredKey.trim();
      window.localStorage.setItem("financeai_openrouter_api_key", normalizedConfiguredKey);
      return normalizedConfiguredKey;
    }

    const savedKey = window.localStorage.getItem("financeai_openrouter_api_key");
    if (savedKey && savedKey.trim()) {
      return savedKey.trim();
    }

    if (!allowPrompt) {
      return "";
    }

    const enteredKey = window.prompt(
      "Enter your OpenRouter API key to enable FinanceAI chat in this browser. It will be stored locally on this device."
    );

    if (!enteredKey || !enteredKey.trim()) {
      return "";
    }

    const normalizedKey = enteredKey.trim();
    window.localStorage.setItem("financeai_openrouter_api_key", normalizedKey);
    return normalizedKey;
  } catch {
    return "";
  }
}

function clearStoredOpenRouterKey() {
  try {
    window.localStorage.removeItem("financeai_openrouter_api_key");
  } catch {
    // Ignore storage failures and let the user retry.
  }
}

function isDirectKeyError(status, data) {
  const rawMessage = `${data?.error?.message || data?.message || ""}`.toLowerCase();
  return status === 401 || status === 403 || rawMessage.includes("api key") || rawMessage.includes("authorization");
}

function getRequestFailureMessage(error) {
  if (error?.message === "missing-browser-openrouter-key") {
    return "Chat could not start because no OpenRouter API key was provided. Enter a valid key in the prompt and try again.";
  }

  return "Request failed. Check your internet connection, browser key, or server deployment.";
}

function buildApiCandidates() {
  const candidates = [];
  const { protocol, hostname, port, origin } = window.location;
  const isFileProtocol = protocol === "file:";
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  if (!isFileProtocol) {
    candidates.push(`${origin}/api/chat`);
  }

  if (isFileProtocol || isLocalHost) {
    candidates.push("http://127.0.0.1:8000/api/chat");
    candidates.push("http://localhost:8000/api/chat");
  }

  if (hostname && !isFileProtocol && port !== "8000") {
    candidates.push(`${protocol}//${hostname}:8000/api/chat`);
  }

  return [...new Set(candidates)];
}

function addMsg(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role === "ai" ? "" : "usr"}`;
  wrapper.innerHTML = `
    <div class="av ${role === "ai" ? "ai" : "me"}">${role === "ai" ? "&#9672;" : "///"}</div>
    <div class="bubble ${role === "ai" ? "ai" : "me"}">${role === "ai" ? fmt(text) : esc(text)}</div>
  `;
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addTyping() {
  const wrapper = document.createElement("div");
  wrapper.className = "typing-wrap";
  wrapper.innerHTML = `<div class="av ai">&#9672;</div><div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrapper;
}

function fmt(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, '<em style="color:var(--muted)">$1</em>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^#{1,3} (.+)$/gm, "<h3>$1</h3>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr/>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^[-*•] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/(\+[\d.,]+%)/g, '<span class="pos">$1</span>')
    .replace(/(-[\d.,]+%)/g, '<span class="neg">$1</span>')
    .replace(/\n{2,}/g, '</p><p style="margin-top:7px">')
    .replace(/\n/g, "<br/>");
}

function esc(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

function escAttr(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function removeWelcome() {
  const welcomeEl = document.getElementById("welcome");
  if (welcomeEl) {
    welcomeEl.remove();
  }
}

function showErr(message) {
  errorEl.textContent = `[!] ${message}`;
  errorEl.style.display = "block";
  setTimeout(() => {
    errorEl.style.display = "none";
  }, 8000);
}

function hideErr() {
  errorEl.style.display = "none";
  errorEl.onclick = null;
  errorEl.style.cursor = "default";
}

function ask(question) {
  inputEl.value = question;
  send();
}

function clearChat() {
  state.history = [];
  renderWelcome();
}

function onKey(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
}

function resize(element) {
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, 110)}px`;
}
