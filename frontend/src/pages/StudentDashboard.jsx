import { useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";
import LectureList from "../components/LectureList.jsx";
import LiveQuestionCard from "../components/LiveQuestionCard.jsx";
import ProfileMenu from "../components/ProfileMenu.jsx";
import { StudentScoreboardTable } from "../components/ScoreboardPanel.jsx";
import ToastStack from "../components/ToastStack.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLectureSocket } from "../hooks/useLectureSocket.js";

const TABS = [
  { id: "upcoming", label: "Upcoming Sessions" },
  { id: "joined", label: "Joined Sessions" },
  { id: "active", label: "Active Sessions" },
  { id: "completed", label: "Completed Sessions" },
  { id: "scores", label: "Scoreboard" },
  { id: "profile", label: "Profile" }
];

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("upcoming");
  const [lectures, setLectures] = useState([]);
  const [selectedLectureId, setSelectedLectureId] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [scoreRows, setScoreRows] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [toasts, setToasts] = useState([]);

  const pushToast = (message, kind = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const loadLectures = async () => {
    const data = await apiRequest("/lecture");
    setLectures(data.lectures || []);
    setSelectedLectureId((current) => {
      if (current && data.lectures.some((lecture) => lecture._id === current)) {
        return current;
      }
      return data.lectures?.[0]?._id || "";
    });
  };

  const loadQuestions = async (lectureId) => {
    if (!lectureId) {
      setCurrentQuestion(null);
      return;
    }

    const data = await apiRequest(`/questions?lectureId=${lectureId}`);
    setCurrentQuestion(data.questions.find((question) => question.status === "active") || null);
  };

  const loadScoreboard = async () => {
    const data = await apiRequest("/questions/scoreboard");
    setScoreRows(data.sessionRows || []);
  };

  useEffect(() => {
    loadLectures();
    loadScoreboard();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadLectures();
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

  const upcomingLectures = lectures.filter((lecture) => lecture.status === "ready" || lecture.status === "ingesting");
  const joinedLectures = lectures.filter((lecture) => lecture.joined && lecture.status !== "completed");
  const activeLectures = lectures.filter((lecture) => lecture.status === "active");
  const completedLectures = lectures.filter((lecture) => lecture.status === "completed");

  const pickSelectedLecture = (items) => items.find((lecture) => lecture._id === selectedLectureId) || items[0] || null;

  const selectedUpcomingLecture = pickSelectedLecture(upcomingLectures);
  const selectedJoinedLecture = pickSelectedLecture(joinedLectures);
  const selectedActiveLecture = pickSelectedLecture(activeLectures);
  const selectedCompletedLecture = pickSelectedLecture(completedLectures);
  const selectedJoinedActiveLecture = selectedActiveLecture?.joined ? selectedActiveLecture : null;
  const socketLectureId = selectedJoinedActiveLecture?._id || null;

  useEffect(() => {
    setSelectedAnswer("");
    loadQuestions(socketLectureId);
  }, [socketLectureId]);

  useLectureSocket(socketLectureId, {
    onQuestion: ({ question }) => {
      setCurrentQuestion(question);
      setSelectedAnswer("");
      pushToast("A new question is live for the selected active session.");
    },
    onScoreboardUpdated: () => {
      loadScoreboard();
    },
    onSessionUpdated: ({ lectureId, status: nextStatus }) => {
      setLectures((current) =>
        current.map((lecture) => (lecture._id === lectureId ? { ...lecture, status: nextStatus || lecture.status } : lecture))
      );

      if (socketLectureId === lectureId && nextStatus !== "active") {
        setCurrentQuestion(null);
      }
    }
  });

  const handleJoin = async () => {
    try {
      const data = await apiRequest("/lecture/join", {
        method: "POST",
        body: JSON.stringify({ joinCode })
      });
      setSelectedLectureId(data.lecture?._id || "");
      setJoinCode("");
      pushToast("Joined session successfully.");
      loadLectures();
      loadScoreboard();
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const handleSubmit = async (option) => {
    if (!currentQuestion) {
      return;
    }

    setSelectedAnswer(option);
    try {
      const data = await apiRequest("/questions/submit", {
        method: "POST",
        body: JSON.stringify({
          questionId: currentQuestion._id,
          selectedOption: option
        })
      });
      pushToast(data.result.isCorrect ? "Correct answer." : `Wrong answer. Correct answer: ${data.result.correctAnswer}`);
      loadScoreboard();
      loadQuestions(socketLectureId);
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const handleSelectLecture = (lecture) => {
    setSelectedLectureId(lecture._id);
    if (lecture.status === "active" && !lecture.joined) {
      pushToast("Join with the session code first to attempt live MCQs.", "error");
    }
  };

  const renderSessionList = ({ items, title, subtitle, selectedLecture, rightPanel }) => (
    <div className="dashboard-grid">
      <LectureList
        lectures={items}
        selectedLectureId={selectedLecture?._id}
        onSelect={handleSelectLecture}
        showJoinCode={false}
        title={title}
        subtitle={subtitle}
      />
      {rightPanel(selectedLecture)}
    </div>
  );

  const renderUpcomingTab = () =>
    renderSessionList({
      items: upcomingLectures,
      title: "Upcoming Sessions",
      subtitle: "Students can browse upcoming sessions here, then join them using the teacher-shared code.",
      selectedLecture: selectedUpcomingLecture,
      rightPanel: (lecture) => (
        <section className="card stack">
          <div>
            <h2>Join Session</h2>
            <p className="muted">Enter the teacher-shared join code to add a session to your joined list.</p>
          </div>
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="Enter join code"
          />
          <button onClick={handleJoin} disabled={!joinCode.trim()}>
            Join Session
          </button>
          <div className="session-summary">
            <strong>{lecture?.title || "No session selected"}</strong>
            <span className="muted">{lecture ? `Status: ${lecture.status}` : "Choose a session to see details."}</span>
          </div>
        </section>
      )
    });

  const renderJoinedTab = () =>
    renderSessionList({
      items: joinedLectures,
      title: "Joined Sessions",
      subtitle: "These sessions were joined using a valid join code.",
      selectedLecture: selectedJoinedLecture,
      rightPanel: (lecture) => (
        <section className="card stack">
          <h2>Joined Session Details</h2>
          {lecture ? (
            <>
              <p><strong>Session:</strong> {lecture.title}</p>
              <p><strong>Status:</strong> {lecture.status}</p>
              <p className="muted">
                {lecture.status === "active"
                  ? "This joined session is currently live."
                  : lecture.status === "completed"
                    ? "This joined session has ended."
                    : "This joined session has not started yet."}
              </p>
            </>
          ) : (
            <p className="muted">No joined sessions yet.</p>
          )}
        </section>
      )
    });

  const renderActiveTab = () => (
    <div className="dashboard-grid">
      <LectureList
        lectures={activeLectures}
        selectedLectureId={selectedActiveLecture?._id}
        onSelect={handleSelectLecture}
        showJoinCode={false}
        title="Active Sessions"
        subtitle="Select an active session to attempt the live MCQ."
      />
      {!activeLectures.length ? (
        <section className="card stack">
          <h2>Active Session</h2>
          <p className="muted">No active sessions going on.</p>
        </section>
      ) : !selectedActiveLecture?.joined ? (
        <section className="card stack">
          <h2>{selectedActiveLecture?.title || "Active Session"}</h2>
          <p className="muted">Join with join code first.</p>
        </section>
      ) : (
        <LiveQuestionCard
          question={currentQuestion}
          onSubmit={handleSubmit}
          disabled={!currentQuestion || Boolean(selectedAnswer)}
          selectedAnswer={selectedAnswer}
        />
      )}
    </div>
  );

  const renderCompletedTab = () =>
    renderSessionList({
      items: completedLectures,
      title: "Completed Sessions",
      subtitle: "These sessions have already ended.",
      selectedLecture: selectedCompletedLecture,
      rightPanel: (lecture) => (
        <section className="card stack">
          <h2>Completed Session</h2>
          {lecture ? (
            <>
              <p><strong>Session:</strong> {lecture.title}</p>
              <p><strong>Status:</strong> {lecture.status}</p>
            </>
          ) : (
            <p className="muted">Select a completed session to view its details.</p>
          )}
        </section>
      )
    });

  const renderScoreTab = () => (
    <section className="card stack">
      <div>
        <h2>Your Scoreboard</h2>
        <p className="muted">Each row shows your progress for one joined session.</p>
      </div>
      <StudentScoreboardTable rows={scoreRows} />
    </section>
  );

  const renderProfileTab = () => (
    <section className="card stack">
      <h2>Profile</h2>
      <p><strong>Name:</strong> {user?.name}</p>
      <p><strong>Email:</strong> {user?.email}</p>
      <p><strong>Role:</strong> {user?.role}</p>
    </section>
  );

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Student Console</p>
          <h1 className="console-title">Welcome, {user?.name}</h1>
        </div>
        <ProfileMenu user={user} onLogout={logout} />
      </header>

      <nav className="top-nav">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`nav-button ${tab === item.id ? "active-nav-button" : "secondary-button"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "upcoming" ? renderUpcomingTab() : null}
      {tab === "joined" ? renderJoinedTab() : null}
      {tab === "active" ? renderActiveTab() : null}
      {tab === "completed" ? renderCompletedTab() : null}
      {tab === "scores" ? renderScoreTab() : null}
      {tab === "profile" ? renderProfileTab() : null}
      <ToastStack toasts={toasts} />
    </div>
  );
}
