import { useEffect, useMemo, useState } from "react";

export default function LiveQuestionCard({ question, onSubmit, disabled, selectedAnswer }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!question?.expiresAt) {
      return undefined;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [question?._id, question?.expiresAt]);

  const remainingSeconds = useMemo(() => {
    if (!question?.expiresAt) {
      return 0;
    }

    return Math.max(0, Math.floor((new Date(question.expiresAt).getTime() - now) / 1000));
  }, [now, question?.expiresAt]);

  if (!question) {
    return (
      <div className="card stack">
        <h2>Live MCQ</h2>
        <p className="muted">Waiting for the next interval question.</p>
      </div>
    );
  }

  return (
    <div className="card stack">
      <div className="question-meta">
        <span>Live MCQ</span>
        <span>{remainingSeconds}s left</span>
      </div>
      <h2>{question.question}</h2>
      <div className="quiz-options">
        {question.options.map((option) => (
          <button
            key={option}
            className={`quiz-option ${selectedAnswer === option ? "active-option" : ""}`}
            disabled={disabled || Boolean(question.userAttempt) || remainingSeconds <= 0}
            onClick={() => onSubmit?.(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {question.userAttempt ? <p className="muted">You have already used your single attempt for this question.</p> : null}
      {remainingSeconds <= 0 ? <p className="error-text">This question has expired.</p> : null}
    </div>
  );
}
