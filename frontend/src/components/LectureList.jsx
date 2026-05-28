export default function LectureList({
  lectures,
  selectedLectureId,
  onSelect,
  onDelete,
  showJoinCode = true,
  title = "Sessions",
  subtitle = "Select a session to view details."
}) {
  return (
    <div className="card stack">
      <div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      <div className="lecture-list session-scroll">
        {lectures.length ? (
          lectures.map((lecture) => (
            <div key={lecture._id} className={`lecture-row ${selectedLectureId === lecture._id ? "active-row" : ""}`}>
              <button
                className={`lecture-item ${selectedLectureId === lecture._id ? "active" : ""}`}
                onClick={() => onSelect?.(lecture)}
              >
                <span>{lecture.title}</span>
                {showJoinCode && lecture.joinCode ? <small>Join code: {lecture.joinCode}</small> : null}
                <small>{lecture.status === "active" ? "Active" : lecture.status === "completed" ? "Completed" : "Upcoming"}</small>
                {lecture.material?.chunksCount ? <small>Knowledge base ready</small> : null}
              </button>
              {onDelete ? (
                <button className="danger-button" onClick={() => onDelete(lecture)}>
                  Delete
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="muted">No sessions yet.</p>
        )}
      </div>
    </div>
  );
}
