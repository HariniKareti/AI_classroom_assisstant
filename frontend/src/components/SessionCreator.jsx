import { useState } from "react";
import { uploadFormRequest } from "../api/client.js";

export default function SessionCreator({ onCreated }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [wantsKnowledgeBase, setWantsKnowledgeBase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      if (file) {
        formData.append("file", file);
      }

      const data = await uploadFormRequest("/lecture", formData);
      onCreated?.(data.lecture);
      setTitle("");
      setFile(null);
      setWantsKnowledgeBase(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <div>
        <h2>Create Session</h2>
        <p className="muted">Add the session name, then choose whether you want to attach a PDF knowledge base for RAG-based generation.</p>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session name" required />
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={wantsKnowledgeBase}
          onChange={(e) => {
            setWantsKnowledgeBase(e.target.checked);
            if (!e.target.checked) {
              setFile(null);
            }
          }}
        />
        <span>Prefer to add knowledge base</span>
      </label>
      {wantsKnowledgeBase ? (
        <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      ) : null}
      {loading && wantsKnowledgeBase && file ? (
        <div className="loading-state">
          <span className="spinner" />
          <span>Knowledge base creation in progress.</span>
        </div>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" disabled={loading || !title.trim() || (wantsKnowledgeBase && !file)}>
        {loading ? "Creating Session..." : "Create Session"}
      </button>
    </form>
  );
}
