
// ========================================
// NEXORA AI - BACKEND SERVER
// ========================================

require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// CHECK API KEY
// ========================================

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "ERROR: GEMINI_API_KEY is missing from your .env file."
  );

  process.exit(1);
}

// ========================================
// INITIALIZE GEMINI AI
// ========================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json({ limit: "20kb" }));

// Serve HTML, CSS, JavaScript and other frontend files
app.use(express.static(__dirname));

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Nexora AI server is running.",
  });
});

// ========================================
// CHAT API WITH STREAMING
// ========================================

app.post("/api/chat", async (req, res) => {
  const startTime = Date.now();

  try {
    const { message } = req.body || {};

    // Validate user message
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please enter a message before sending.",
      });
    }

    const userMessage = message.trim();

    if (userMessage.length > 10000) {
      return res.status(413).json({
        success: false,
        error: "Your message is too long. Please shorten it.",
      });
    }

    console.log(
      `[${new Date().toLocaleTimeString()}] Chat request received.`
    );

    // Request a streaming response from Gemini
    const stream = await ai.models.generateContentStream({
      model: "gemini-3.6-flash",
      contents: userMessage,
    });

    // Configure the response for streaming
    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );

    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");

    res.flushHeaders();

    let fullReply = "";
    let firstChunkReceived = false;

    // Send each piece as soon as it arrives
    for await (const chunk of stream) {
      const text = chunk.text;

      if (text) {
        if (!firstChunkReceived) {
          firstChunkReceived = true;

          const firstTokenTime = (
            (Date.now() - startTime) /
            1000
          ).toFixed(2);

          console.log(
            `First response content received in ${firstTokenTime} seconds.`
          );
        }

        fullReply += text;

        res.write(text);
      }
    }

    if (!fullReply.trim()) {
      console.warn("Gemini returned an empty response.");
    }

    const elapsedTime = (
      (Date.now() - startTime) /
      1000
    ).toFixed(2);

    console.log(
      `AI response completed in ${elapsedTime} seconds.`
    );

    res.end();
  } catch (error) {
    const elapsedTime = (
      (Date.now() - startTime) /
      1000
    ).toFixed(2);

    console.error(
      `AI request failed after ${elapsedTime} seconds.`
    );

    console.error(
      "Error status:",
      error.status || error.code || "Unknown"
    );

    console.error(
      "Error message:",
      error.message || "Unknown error"
    );

    // If streaming has already started, end the connection safely
    if (res.headersSent) {
      res.destroy();
      return;
    }

    const status = Number(error.status || error.code);

    if (status === 429) {
      return res.status(429).json({
        success: false,
        error:
          "AI request limit reached. Please wait a little and try again.",
      });
    }

    if (status === 502 || status === 503) {
      return res.status(503).json({
        success: false,
        error:
          "The AI service is temporarily busy. Please try again shortly.",
      });
    }

    if (status === 401 || status === 403) {
      return res.status(502).json({
        success: false,
        error:
          "AI authorization failed. Please check your API configuration.",
      });
    }

    return res.status(500).json({
      success: false,
      error:
        "Something went wrong while generating the reply. Please try again.",
    });
  }
});

// ========================================
// INVALID JSON ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      success: false,
      error: "Invalid request format. Please try again.",
    });
  }

  next(error);
});

// ========================================
// START SERVER
// ========================================

const server = app.listen(PORT, () => {
  console.log(
    `Nexora AI is running at http://localhost:${PORT}`
  );
});

// Handle port conflicts
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the existing server first.`
    );
  } else {
    console.error(
      "Server startup error:",
      error.message
    );
  }
});

