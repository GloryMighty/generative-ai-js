import { config } from "dotenv";
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { v4 as uuidv4 } from "uuid"; // For generating unique file names

config(); // Load environment variables (e.g., API_KEY)

const app = express();
app.use(cors()); // Allow frontend to connect
app.use(express.json()); // Parse JSON requests

// Set up multer for file uploads
const upload = multer({ dest: "uploads/" });

// Initialize the Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Initialize search model with configuration
const searchModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.3,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 4046
  },
  tools: [{
    googleSearch: {}
  }]
});

// In-memory store for chat histories
const chatHistories = new Map(); // sessionId -> chat history

// API endpoint to generate text from a prompt with session management and image support
app.post("/generate", upload.single("image"), async (req, res) => {
  console.log("[Request received]", {
    sessionId: req.body.sessionId,
    hasPrompt: !!req.body.prompt,
    hasImage: !!req.file
  });

  const prompt = req.body.prompt;
  const sessionId = req.body.sessionId;
  const imageFile = req.file;

  console.log("[Request body]", { prompt, sessionId });

  if (!prompt || !sessionId) {
    console.warn("[Validation failed]", { prompt: !!prompt, sessionId: !!sessionId });
    return res.status(400).json({ error: "Prompt and sessionId are required" });
  }

  let chat;
  if (chatHistories.has(sessionId)) {
    console.log(`[Chat history found] SessionID: ${sessionId}`);
    chat = model.startChat({ history: chatHistories.get(sessionId) });
  } else {
    console.log(`[New chat session] SessionID: ${sessionId}`);
    chat = model.startChat();
  }

  try {
    const currentDate = new Date().toISOString();
    const promptWithDate = `[Date: ${currentDate}] ${prompt}`;
    let messageParts = [{ text: promptWithDate }];
    if (imageFile) {
      console.log(`[Processing image] File: ${imageFile.originalname}, Size: ${imageFile.size} bytes, Type: ${imageFile.mimetype}`);
      try {
        // Read and encode the image file
        const imageData = fs.readFileSync(imageFile.path);
        const imageBase64 = Buffer.from(imageData).toString("base64");
        console.log("[Image encoded] Successfully converted to base64");
        
        messageParts.push({
          inlineData: {
            data: imageBase64,
            mimeType: imageFile.mimetype,
          },
        });
        // Clean up the uploaded file
        fs.unlinkSync(imageFile.path);
        console.log("[Cleanup] Temporary image file removed");
      } catch (imageError) {
        console.error("[Image processing error]", imageError);
        throw imageError;
      }
    }

    // Set up streaming response
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");

    console.log("[Sending message] Message parts:", messageParts.length);
    const result = await chat.sendMessageStream(messageParts);
    console.log("[Stream started] Beginning response streaming");
    
    let fullText = "";
    let chunkCount = 0;
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      res.write(JSON.stringify({ text: chunkText }) + "\n");
      chunkCount++;
    }
    console.log(`[Stream complete] Sent ${chunkCount} chunks`);
    res.end();

    // Update history after streaming is complete
    const history = await chat.getHistory();
    chatHistories.set(sessionId, history);
    console.log(`[History updated] SessionID: ${sessionId}, Messages in history: ${history.length}`);
  } catch (error) {
    console.error("[Error] Failed to process request:", {
      sessionId,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
// Unified search endpoint
app.post("/search", upload.single("image"), async (req, res) => {
  const prompt = req.body.prompt;
  const sessionId = req.body.sessionId;

  if (!prompt || !sessionId) {
    return res.status(400).json({ error: "Prompt and sessionId are required" });
  }

  try {
    console.log("[Search Request]", { prompt, sessionId });
    
    // Set up streaming response
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");

    const result = await searchModel.generateContentStream(prompt);
    console.log("[Stream started] Beginning search response streaming");
    
    let fullText = "";
    let chunkCount = 0;
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      res.write(JSON.stringify({ text: chunkText }) + "\n");
      chunkCount++;
    }
    console.log(`[Stream complete] Sent ${chunkCount} chunks`);
    res.end();
  } catch (error) {
    console.error("[Search Error]", {
      sessionId,
      errorName: error.name,
      errorMessage: error.message
    });
    res.status(500).json({ 
      error: "Failed to process search request",
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});