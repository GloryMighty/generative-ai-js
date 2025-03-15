import React, { useState } from "react";

function App() {
  const [prompt, setPrompt] = useState(""); // User input
  const [response, setResponse] = useState(""); // Generated text
  const [loading, setLoading] = useState(false); // Loading state

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResponse(""); // Clear previous response

    try {
      const res = await fetch("http://localhost:3000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      setResponse(data.text);
    } catch (error) {
      console.error("Error:", error);
      setResponse("Sorry, something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Read the response aloud using Web Speech API
  const speak = () => {
    if (response) {
      const utterance = new SpeechSynthesisUtterance(response);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Crypto Education Assistant</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask about crypto (e.g., What is Bitcoin?)"
          style={{ width: "70%", padding: "8px", marginRight: "10px" }}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Generating..." : "Send"}
        </button>
      </form>
      {response && (
        <div style={{ marginTop: "20px" }}>
          <h2>Response:</h2>
          <p>{response}</p>
          <button onClick={speak} style={{ marginTop: "10px" }}>
            Read Aloud
          </button>
        </div>
      )}
    </div>
  );
}

export default App;