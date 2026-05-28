import { useState } from "react";
import { uploadFormRequest } from "../api/client.js";

export default function LectureUploader({ lectureId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!lectureId || !file) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await uploadFormRequest(`/lecture/${lectureId}/material`, formData);
      onUploaded(data.lecture);
      setFile(null);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card stack compact-card" onSubmit={handleSubmit}>
      <div>
        <h2>Upload Lecture Material</h2>
        <p className="muted">Attach the PDF that will act as the RAG knowledge base for the selected session.</p>
      </div>
      <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={!lectureId} />
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" disabled={loading || !file || !lectureId}>
        {loading ? "Uploading..." : "Index PDF Material"}
      </button>
    </form>
  );
}
