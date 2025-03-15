import { config } from "dotenv";
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";

config(); // Load environment variables (e.g., API_KEY)

const app = express();
app.use(cors()); // Allow frontend to connect
app.use(express.json()); // Parse JSON requests

// Initialize the Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// In-memory store for chat histories
const chatHistories = new Map(); // sessionId -> chat history

// API endpoint to generate text from a prompt with session management
app.post("/generate", async (req, res) => {
  const { prompt, sessionId } = req.body;
  if (!prompt || !sessionId) {
    return res.status(400).json({ error: "Prompt and sessionId are required" });
  }

  let chat;
  if (chatHistories.has(sessionId)) {
    chat = model.startChat({ history: chatHistories.get(sessionId) });
  } else {
    chat = model.startChat();
  }

  try {
    // Set up streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const result = await chat.sendMessageStream(prompt);
    const response = result.response;

    // Stream the response text
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(JSON.stringify({ text: chunkText }) + '\n');
    }

    // Update history after streaming is complete
    const history = await chat.getHistory();
    chatHistories.set(sessionId, history);

    res.end();
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});