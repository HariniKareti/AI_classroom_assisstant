export function TeacherScoreboardTable({ leaderboard = [] }) {
  if (!leaderboard.length) {
    return <p className="muted">No joined students yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="score-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Score</th>
            <th>Correct</th>
            <th>Wrong</th>
            <th>Unattempted</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry) => (
            <tr key={entry.studentId}>
              <td>{entry.studentName}</td>
              <td>{entry.studentEmail}</td>
              <td>{entry.score}</td>
              <td>{entry.correct}</td>
              <td>{entry.wrong}</td>
              <td>{entry.unattempted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StudentScoreboardTable({ rows = [] }) {
  if (!rows.length) {
    return <p className="muted">Join a session to start seeing your scoreboard.</p>;
  }

  return (
    <div className="table-wrap table-scroll">
      <table className="score-table">
        <thead>
          <tr>
            <th>Session Name</th>
            <th>Correctly Answered</th>
            <th>Wrongly Answered</th>
            <th>Unattempted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.lectureId}>
              <td>{entry.sessionName}</td>
              <td>{entry.correctlyAnswered}</td>
              <td>{entry.wronglyAnswered}</td>
              <td>{entry.unattempted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
