import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client.js";
import LectureList from "../components/LectureList.jsx";
import ProfileMenu from "../components/ProfileMenu.jsx";
import QuestionFeed from "../components/QuestionFeed.jsx";
import SessionCreator from "../components/SessionCreator.jsx";
import { TeacherScoreboardTable } from "../components/ScoreboardPanel.jsx";
import ToastStack from "../components/ToastStack.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLectureSocket } from "../hooks/useLectureSocket.js";

const getRecognitionConstructor = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
const INTERVAL_OPTIONS = [1, 2, 3, 4, 5];
const TABS = [
  { id: "upcoming", label: "Create Session" },
  { id: "start", label: "Start Session" },
  { id: "completed", label: "Completed Sessions" },
  { id: "scores", label: "Scoreboard" },
  { id: "profile", label: "Profile" }
];

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("upcoming");
  const [lectures, setLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [scoreboards, setScoreboards] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState(1);
  const [recordingLabel, setRecordingLabel] = useState("");
  const [toasts, setToasts] = useState([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const transcriptBufferRef = useRef("");
  const interimTranscriptRef = useRef("");
  const flushTimerRef = useRef(null);
  const isFlushingRef = useRef(false);
  const windowStartedAtRef = useRef(null);
  const selectedLectureRef = useRef(null);
  const selectedIntervalRef = useRef(1);

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
    setSelectedLecture((current) => {
      if (current) {
        return data.lectures.find((lecture) => lecture._id === current._id) || data.lectures?.[0] || null;
      }
      return data.lectures?.[0] || null;
    });
  };

  const loadQuestions = async (lectureId) => {
    if (!lectureId) {
      setQuestions([]);
      return;
    }

    const data = await apiRequest(`/questions?lectureId=${lectureId}`);
    setQuestions(data.questions || []);
  };

  const loadScoreboards = async () => {
    const data = await apiRequest("/questions/teacher-scoreboards");
    setScoreboards(data.scoreboards || []);
  };

  useEffect(() => {
    loadLectures();
    loadScoreboards();
  }, []);

  useEffect(() => {
    selectedLectureRef.current = selectedLecture;
    setSelectedInterval(selectedLecture?.intervalMinutes || 1);
    selectedIntervalRef.current = selectedLecture?.intervalMinutes || 1;
    loadQuestions(selectedLecture?._id);
  }, [selectedLecture]);

  useEffect(() => {
    selectedIntervalRef.current = selectedInterval;
  }, [selectedInterval]);

  useLectureSocket(selectedLecture?._id, {
    onQuestion: ({ question }) => {
      setQuestions((current) => [question, ...current.filter((item) => item._id !== question._id)]);
      loadScoreboards();
      loadLectures();
      pushToast("A new interval question is live.");
    },
    onScoreboardUpdated: () => {
      loadScoreboards();
    },
    onSessionUpdated: ({ lectureId, status: nextStatus, intervalMinutes }) => {
      setLectures((current) =>
        current.map((lecture) =>
          lecture._id === lectureId
            ? {
                ...lecture,
                status: nextStatus || lecture.status,
                intervalMinutes: intervalMinutes || lecture.intervalMinutes
              }
            : lecture
        )
      );
      if (selectedLectureRef.current?._id === lectureId && nextStatus === "completed") {
        isRecordingRef.current = false;
        setIsRecording(false);
        setRecordingLabel("");
        if (flushTimerRef.current) {
          window.clearInterval(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        recognitionRef.current?.stop();
      }
    }
  });

  const recentWindows = selectedLecture?.recentWindows || [];
  const startLectures = lectures.filter((lecture) => ["ready", "ingesting", "active"].includes(lecture.status));
  const upcomingLectures = lectures.filter((lecture) => lecture.status === "ready" || lecture.status === "ingesting");
  const completedLectures = lectures.filter((lecture) => lecture.status === "completed");
  const selectedStartLecture = startLectures.find((lecture) => lecture._id === selectedLecture?._id) || startLectures[0] || null;
  const selectedCompletedLecture = completedLectures.find((lecture) => lecture._id === selectedLecture?._id) || completedLectures[0] || null;
  const startQuestions = selectedStartLecture?._id === selectedLecture?._id ? questions : [];
  const completedQuestions = selectedCompletedLecture?._id === selectedLecture?._id ? questions : [];
  const completedRecentWindows = selectedCompletedLecture?._id === selectedLecture?._id ? recentWindows : [];

  const scheduleNextFlush = () => {
    if (!isRecordingRef.current || flushTimerRef.current) {
      return;
    }

    flushTimerRef.current = window.setInterval(async () => {
      if (isFlushingRef.current) {
        return;
      }

      isFlushingRef.current = true;
      try {
        await flushCurrentWindow();
      } finally {
        isFlushingRef.current = false;
      }
    }, selectedIntervalRef.current * 60 * 1000);
  };

  const flushCurrentWindow = async () => {
    const transcript = `${transcriptBufferRef.current} ${interimTranscriptRef.current}`.trim();
    if (!selectedLectureRef.current?._id || !transcript) {
      transcriptBufferRef.current = "";
      interimTranscriptRef.current = "";
      windowStartedAtRef.current = new Date().toISOString();
      pushToast(`No transcript captured for the last ${selectedIntervalRef.current}-minute interval.`, "error");
      return;
    }

    try {
      const data = await apiRequest(`/lecture/${selectedLectureRef.current._id}/interval`, {
        method: "POST",
        body: JSON.stringify({
          transcript,
          startedAt: windowStartedAtRef.current || new Date().toISOString(),
          endedAt: new Date().toISOString()
        })
      });
      if (data.lecture) {
        setLectures((current) => current.map((lecture) => (lecture._id === data.lecture._id ? data.lecture : lecture)));
        setSelectedLecture(data.lecture);
      }
      if (data.question) {
        setQuestions((current) => [data.question, ...current.filter((item) => item._id !== data.question._id)]);
      }
      if (data.pendingWindow) {
        pushToast("Interval transcript is ready for retrieval and generation.");
      }
      if (data.question) {
        pushToast(data.message || "Question generated directly from the interval transcript.");
      }
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      transcriptBufferRef.current = "";
      interimTranscriptRef.current = "";
      windowStartedAtRef.current = new Date().toISOString();
      setLiveTranscript("");
    }
  };

  const startRecognition = () => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      pushToast("Web Speech API is not available in this browser. Chrome or Edge is recommended.", "error");
      return false;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          finalText += ` ${event.results[index][0].transcript}`;
        } else {
          interimText += ` ${event.results[index][0].transcript}`;
        }
      }

      if (finalText.trim()) {
        transcriptBufferRef.current = `${transcriptBufferRef.current} ${finalText}`.trim();
      }
      interimTranscriptRef.current = interimText.trim();
      setLiveTranscript(`${transcriptBufferRef.current} ${interimTranscriptRef.current}`.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "network" && isRecordingRef.current) {
        pushToast("Speech recognition network error. Retrying automatically.", "error");
        window.setTimeout(() => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (error) {
              pushToast("Speech recognition is waiting for the browser service to recover.", "error");
            }
          }
        }, 1500);
        return;
      }

      pushToast(`Speech recognition error: ${event.error}`, "error");
    };
    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (error) {
          pushToast("Speech recognition restarted automatically.");
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  };

  const handleStartSession = async () => {
    if (!selectedStartLecture?._id) {
      pushToast("Select a session first.", "error");
      return;
    }

    const started = startRecognition();
    if (!started) {
      return;
    }

    try {
      const data = await apiRequest(`/lecture/${selectedStartLecture._id}/start`, {
        method: "POST",
        body: JSON.stringify({ intervalMinutes: selectedInterval })
      });

      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingLabel("Recording in progress");
      transcriptBufferRef.current = "";
      interimTranscriptRef.current = "";
      windowStartedAtRef.current = new Date().toISOString();
      setLiveTranscript("");
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      setLectures((current) => current.map((lecture) => (lecture._id === data.lecture._id ? data.lecture : lecture)));
      setSelectedLecture(data.lecture);
      scheduleNextFlush();
      pushToast("Session started.");
    } catch (error) {
      recognitionRef.current?.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      pushToast(error.message, "error");
    }
  };

  const handleEndSession = async () => {
    if (!selectedStartLecture?._id) {
      return;
    }

    isRecordingRef.current = false;
    setIsRecording(false);
    setRecordingLabel("");
    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    transcriptBufferRef.current = "";
    interimTranscriptRef.current = "";
    windowStartedAtRef.current = null;
    setLiveTranscript("");

    try {
      const data = await apiRequest(`/lecture/${selectedStartLecture._id}/end`, {
        method: "POST"
      });
      setLectures((current) => current.map((lecture) => (lecture._id === data.lecture._id ? data.lecture : lecture)));
      setSelectedLecture(data.lecture);
      pushToast("Session completed.");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const handleDeleteLecture = async (lecture) => {
    try {
      await apiRequest(`/lecture/${lecture._id}`, { method: "DELETE" });
      const nextLectures = lectures.filter((item) => item._id !== lecture._id);
      setLectures(nextLectures);
      if (selectedLecture?._id === lecture._id) {
        setSelectedLecture(nextLectures[0] || null);
        setQuestions([]);
      }
      loadScoreboards();
      pushToast("Session deleted.");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const renderCreateTab = () => (
    <section className="dashboard-grid">
      <SessionCreator
        onCreated={(lecture) => {
          setLectures((current) => [lecture, ...current]);
          setSelectedLecture(lecture);
          setTab("start");
          loadScoreboards();
          pushToast("Session created successfully.");
        }}
      />
      <LectureList
        lectures={upcomingLectures}
        selectedLectureId={selectedLecture?._id}
        onSelect={setSelectedLecture}
        onDelete={handleDeleteLecture}
        showJoinCode
        title="Upcoming Sessions"
        subtitle="Create or review sessions that are ready to be started."
      />
    </section>
  );

  const renderTranscriptHistory = ({ title, subtitle, windows }) => (
    <section className="card stack">
      <div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      {windows.length ? (
        windows.map((window) => (
          <div key={window.windowId} className="question-item">
            <div className="question-meta">
              <span>Interval Window</span>
              <span>{new Date(window.processedAt || Date.now()).toLocaleTimeString()}</span>
            </div>
            <p>{window.transcript}</p>
            <p className="muted">{window.status === "generated" ? "MCQ generated for this interval." : "No MCQ was generated for this interval."}</p>
          </div>
        ))
      ) : (
        <p className="muted">No processed interval transcripts yet.</p>
      )}
    </section>
  );

  const renderStartTab = () => (
    <div className="stack">
      <section className="dashboard-grid">
        <LectureList
          lectures={startLectures}
          selectedLectureId={selectedStartLecture?._id}
          onSelect={setSelectedLecture}
          onDelete={handleDeleteLecture}
          showJoinCode
          title="Start Session"
          subtitle="Select a ready or active session to run the live recording workflow."
        />
        <div className="card stack">
          <div>
            <h2>Start Session</h2>
            <p className="muted">Choose a ready session, select the interval, and start the live recording workflow.</p>
          </div>
          <div className="session-summary">
            <strong>{selectedStartLecture?.title || "No session selected"}</strong>
            <span className="muted">{selectedStartLecture?.joinCode ? `Join code: ${selectedStartLecture.joinCode}` : "Create a session first."}</span>
            {selectedStartLecture?.material?.chunksCount ? (
              <span className="muted">{selectedStartLecture.material.chunksCount} knowledge chunks indexed in Chroma</span>
            ) : null}
            <span className="status-pill">{selectedStartLecture?.status || "none"}</span>
          </div>
          <select value={selectedInterval} onChange={(e) => setSelectedInterval(Number(e.target.value))} disabled={isRecording || selectedStartLecture?.status === "completed"}>
            {INTERVAL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Generate one question every {option} minute{option > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <div className="button-row">
            <button
              onClick={handleStartSession}
              disabled={isRecording || !selectedStartLecture || selectedStartLecture?.status === "completed" || selectedStartLecture?.status === "active"}
            >
              Start Session
            </button>
            <button className="secondary-button" onClick={handleEndSession} disabled={selectedStartLecture?.status !== "active"}>
              End Session
            </button>
          </div>
          {recordingLabel ? <p className="success-text">{recordingLabel}</p> : null}
        </div>
      </section>
      {selectedStartLecture?.status === "active" ? (
        <section className="card stack">
          <div>
            <h2>Live Transcript</h2>
            <p className="muted">Visible transcript for the current interval. It updates while you speak and resets only when the interval is processed.</p>
          </div>
          <textarea readOnly rows="6" value={liveTranscript} placeholder="Transcript will appear here while recording is active." />
        </section>
      ) : null}
    </div>
  );

  const renderCompletedTab = () => (
    <div className="stack">
      <section className="dashboard-grid">
        <LectureList
          lectures={completedLectures}
          selectedLectureId={selectedCompletedLecture?._id}
          onSelect={setSelectedLecture}
          showJoinCode
          title="Completed Sessions"
          subtitle="These sessions have already been started and stopped once."
        />
        <section className="card stack">
          <div>
            <h2>Completed Session Details</h2>
            <p className="muted">{selectedCompletedLecture?.status === "completed" ? selectedCompletedLecture.title : "Select a completed session."}</p>
          </div>
          {selectedCompletedLecture?.status === "completed" ? (
            <>
              <p><strong>Join Code:</strong> {selectedCompletedLecture.joinCode}</p>
              <p><strong>Questions Generated:</strong> {completedQuestions.length}</p>
            </>
          ) : (
            <p className="muted">No completed session selected.</p>
          )}
        </section>
      </section>
      {selectedCompletedLecture?.status === "completed"
        ? renderTranscriptHistory({
            title: "Processed Transcripts",
            subtitle: "These are the processed transcript windows for the selected completed session.",
            windows: completedRecentWindows
          })
        : null}
      {selectedCompletedLecture?.status === "completed" ? <QuestionFeed questions={completedQuestions} /> : null}
    </div>
  );

  const renderScoresTab = () => (
    <div className="stack">
      {scoreboards.length ? (
        scoreboards.map((scoreboard) => (
          <section key={scoreboard.lectureId} className="card stack">
            <div className="question-meta">
              <div>
                <h2>{scoreboard.lectureTitle}</h2>
                <p className="muted">Join code: {scoreboard.joinCode}</p>
              </div>
              <span className="status-pill">{scoreboard.status}</span>
            </div>
            <TeacherScoreboardTable leaderboard={scoreboard.leaderboard} />
          </section>
        ))
      ) : (
        <section className="card">
          <p className="muted">Create a session first to see scoreboards.</p>
        </section>
      )}
    </div>
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
          <p className="eyebrow">Teacher Console</p>
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

      {tab === "upcoming" ? renderCreateTab() : null}
      {tab === "start" ? renderStartTab() : null}
      {tab === "completed" ? renderCompletedTab() : null}
      {tab === "scores" ? renderScoresTab() : null}
      {tab === "profile" ? renderProfileTab() : null}
      <ToastStack toasts={toasts} />
    </div>
  );
}
