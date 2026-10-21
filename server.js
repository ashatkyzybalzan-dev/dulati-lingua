const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 12;

let visitorCount = 0;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Сұраныс тым үлкен."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      body += chunk.toString("utf8");
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(Object.assign(new Error("JSON форматы дұрыс емес."), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!safePath.startsWith(PUBLIC_DIR + path.sep) && safePath !== path.join(PUBLIC_DIR, "index.html")) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(safePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(safePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      aiConfigured: Boolean(GROQ_API_KEY),
      provider: GROQ_API_KEY ? "Groq" : null,
      model: GROQ_API_KEY ? GROQ_MODEL : null
    });
  }

  if (req.method === "GET" && pathname === "/api/visitors") {
    visitorCount += 1;
    return sendJson(res, 200, { count: visitorCount, note: "Санау сервер қайта іске қосылғанда нөлден басталады." });
  }

  if (req.method === "POST" && pathname === "/api/chat") {
    if (!GROQ_API_KEY) {
      return sendJson(res, 503, {
        error: "AI әлі қосылмаған. Render Environment бөліміне GROQ_API_KEY енгізіңіз."
      });
    }

    let payload;
    try {
      payload = await readJson(req);
    } catch (err) {
      return sendJson(res, err.statusCode || 400, { error: err.message || "Сұранысты оқу мүмкін болмады." });
    }

    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message) return sendJson(res, 400, { error: "Алдымен хабарлама жазыңыз." });
    if (message.length > MAX_MESSAGE_CHARS) {
      return sendJson(res, 413, { error: `Хабарлама ${MAX_MESSAGE_CHARS} таңбадан аспауы керек.` });
    }

    const allowedRoles = new Set(["user", "assistant"]);
    const history = Array.isArray(payload.history)
      ? payload.history.slice(-MAX_HISTORY_MESSAGES)
          .filter(item => item && allowedRoles.has(item.role) && typeof item.content === "string")
          .map(item => ({ role: item.role, content: item.content.slice(0, MAX_MESSAGE_CHARS) }))
      : [];

    const systemPrompt = [
      "You are Dulati Lingua AI, a friendly, patient language-learning tutor for university and school learners.",
      "Help users practice Kazakh, Russian, and English. Reply in the language the user uses unless they ask otherwise.",
      "Explain grammar clearly, correct mistakes gently, give examples, vocabulary, translations, and short practice exercises.",
      "If the user asks for speaking practice, simulate a conversation and give concise feedback on their wording.",
      "Do not claim to hear audio: this chat currently accepts text only.",
      "Keep answers well-structured and appropriate for students. If a request is unrelated to language learning, still help briefly and respectfully."
    ].join(" ");

    let response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message }
          ],
          temperature: 0.5,
          max_tokens: 900
        }),
        signal: AbortSignal.timeout(45000)
      });
    } catch (err) {
      console.error("Groq network error:", err.name || "Error", err.message || "");
      return sendJson(res, 502, { error: "AI серверіне қосыла алмадық. Бір минуттан кейін қайталап көріңіз." });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const code = data?.error?.code || "";
      const messageFromProvider = data?.error?.message || "";
      // Keep secrets out of logs and responses.
      console.error("Groq API error:", response.status, code, messageFromProvider.slice(0, 300));

      if (response.status === 401 || response.status === 403) {
        return sendJson(res, 502, { error: "Groq API кілті жарамсыз немесе бұл модельге рұқсат жоқ. Render Environment параметрлерін тексеріңіз." });
      }
      if (response.status === 429) {
        return sendJson(res, 429, { error: "AI сұраныстарының лимиті уақытша таусылды. Біраздан соң қайталап көріңіз." });
      }
      if (response.status === 404 || code === "model_not_found") {
        return sendJson(res, 502, { error: `Groq моделін таба алмады: ${GROQ_MODEL}. Render-дегі GROQ_MODEL мәнін тексеріңіз.` });
      }
      return sendJson(res, 502, { error: "AI провайдері сұранысты қабылдамады. Render Logs бөлімін тексеріңіз." });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      console.error("Groq returned an empty or unexpected response.");
      return sendJson(res, 502, { error: "AI бос жауап қайтарды. Қайта сұранып көріңіз." });
    }

    return sendJson(res, 200, { answer: answer.trim(), model: GROQ_MODEL });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(req, res, pathname);
  }

  return sendJson(res, 405, { error: "Бұл HTTP әдісі қолдау таппайды." });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Dulati Lingua AI running on port ${PORT}`);
  console.log(`AI configured: ${Boolean(GROQ_API_KEY)}; model: ${GROQ_MODEL}`);
});
