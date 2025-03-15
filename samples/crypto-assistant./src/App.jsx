import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";

function App() {
  const [sessionId] = useState(uuidv4()); // Unique session ID per user
  const [prompt, setPrompt] = useState(""); // User input
  const [conversation, setConversation] = useState([]); // Array of { role, text }
  const [loading, setLoading] = useState(false); // Loading state
  const [streamedText, setStreamedText] = useState(""); // For streaming display
  const [image, setImage] = useState(null); // Selected image file
  const [isResearchMode, setIsResearchMode] = useState(false); // Research mode toggle

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      console.warn("Empty prompt");
      return;
    }

    setLoading(true);
    setStreamedText(""); // Clear previous response
    const currentPrompt = trimmedPrompt; // Store current prompt
    setPrompt(""); // Clear input after sending

    try {
      const formData = new FormData();
      if (!sessionId) {
        console.error("Session ID is missing");
        throw new Error("Session ID is required");
      }
      formData.append("prompt", currentPrompt);
      formData.append("sessionId", sessionId);
      if (image) {
        formData.append("image", image);
      }

      const endpoint = isResearchMode ? "/search" : "/generate";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Network response was not ok");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Add user message to conversation only when we start receiving a response
      setConversation((prev) => [...prev, { role: "user", text: currentPrompt }]);

      let accumulatedText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value);
        const lines = chunkText.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const parsedData = JSON.parse(line);
            // Handle both direct text and nested text property
            const responseText = typeof parsedData === 'string' ? parsedData : parsedData.text || parsedData.content || '';
            if (responseText) {
              accumulatedText += responseText;
              setStreamedText(accumulatedText);
            }
          } catch (e) {
            // If the line is not valid JSON, try to use it directly
            if (line.trim()) {
              accumulatedText += line.trim();
              setStreamedText(accumulatedText);
            }
            console.debug("Parsing chunk:", e);
          }
        }
      }

      // Add final response to conversation
      if (accumulatedText.trim()) {
        setConversation((prev) => [...prev, { role: "assistant", text: accumulatedText }]);
      }
    } catch (error) {
      console.error("Error:", error);
      setConversation((prev) => [
        ...prev,
        { role: "user", text: currentPrompt },
        { role: "assistant", text: "Sorry, something went wrong." },
      ]);
      setStreamedText("Sorry, something went wrong.");
    } finally {
      setLoading(false);
      setStreamedText(""); // Clear streamed text after completion
      setImage(null); // Clear image after submission
    }
  };

  // Read the response aloud using Web Speech API
  const speak = (text) => {
    if (text) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ color: "#2563eb", marginBottom: "1.5rem" }}>Crypto Education Assistant</h1>
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        height: "600px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}>
          {conversation.length === 0 && !loading && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#94a3b8",
              fontSize: "1.1rem",
            }}>
              Ask me anything about cryptocurrency!
            </div>
          )}
          {(conversation.length > 0 || loading) && (
            <>
              {conversation.map((msg, index) => (
                <React.Fragment key={index}>
                  <div style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    backgroundColor: msg.role === "user" ? "#2563eb" : "#f8fafc",
                    color: msg.role === "user" ? "white" : "inherit",
                    border: msg.role === "user" ? "none" : "1px solid #e2e8f0",
                    padding: "12px 16px",
                    borderRadius: msg.role === "user" ? "12px 12px 0 12px" : "12px 12px 12px 0",
                    maxWidth: "80%",
                    wordBreak: "break-word",
                    marginBottom: "8px",
                  }}>
                    {msg.text}
                  </div>
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => speak(msg.text)}
                      style={{
                        alignSelf: "flex-start",
                        backgroundColor: "#475569",
                        color: "white",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                        marginTop: "0",
                        marginBottom: "16px",
                      }}
                    >
                      Read Aloud
                    </button>
                  )}
                </React.Fragment>
              ))}
              {loading && streamedText && (
                <div style={{
                  alignSelf: "flex-start",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "12px 16px",
                  borderRadius: "12px 12px 12px 0",
                  maxWidth: "80%",
                  wordBreak: "break-word",
                  opacity: 0.7,
                  transition: "opacity 0.2s",
                }}>
                  {streamedText}
                  <div style={{ marginTop: "8px", color: "#94a3b8" }}>Generating...</div>
                </div>
              )}
            </>
          )}
        </div>
        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: "1px solid #e2e8f0",
            padding: "16px",
            backgroundColor: "#ffffff",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "0.875rem", color: "#475569" }}>
              Research Mode
              <input
                type="checkbox"
                checked={isResearchMode}
                onChange={(e) => setIsResearchMode(e.target.checked)}
                style={{ marginLeft: "4px" }}
              />
            </label>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
            style={{
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              fontSize: "1rem",
              backgroundColor: "#f8fafc",
            }}
          />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about crypto (e.g., What is Bitcoin?)"
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              fontSize: "1rem",
              backgroundColor: "#f8fafc",
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: loading ? "#94a3b8" : "#2563eb",
              color: "white",
              padding: "12px 24px",
              borderRadius: "6px",
              border: "none",
              fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Generating..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;