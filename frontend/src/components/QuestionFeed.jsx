export default function QuestionFeed({ questions }) {
  return (
    <div className="card stack">
      <div>
        <h2>Generated MCQs</h2>
        <p className="muted">Each question is generated from the last successful speech interval only.</p>
      </div>
      <div className="question-list">
        {questions.length ? (
          questions.map((item) => (
            <article key={item._id || `${item.question}-${item.answer}`} className="question-item">
              <div className="question-meta">
                <span>QUESTION</span>
                <span>{new Date(item.createdAt || item.generatedAt || Date.now()).toLocaleString()}</span>
              </div>
              <h3>{item.question}</h3>
              <ul>
                {item.options?.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
              <p className="answer-text">Answer: {item.answer}</p>
            </article>
          ))
        ) : (
          <p className="muted">No questions yet.</p>
        )}
      </div>
    </div>
  );
}
