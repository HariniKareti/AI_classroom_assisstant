import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const resolveSocketUrl = () => {
  const configuredUrl = (import.meta.env.VITE_SOCKET_URL || "").trim();

  if (/app\.github\.dev/i.test(configuredUrl)) {
    return window.location.origin;
  }

  return configuredUrl || window.location.origin;
};

const SOCKET_URL = resolveSocketUrl();

export const useLectureSocket = (lectureId, handlers = {}) => {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!lectureId) {
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      transports: ["websocket"]
    });

    socket.emit("lecture:join", lectureId);

    socket.on("question:new", (payload) => handlersRef.current.onQuestion?.(payload));
    socket.on("scoreboard:updated", (payload) => handlersRef.current.onScoreboardUpdated?.(payload));
    socket.on("session:updated", (payload) => handlersRef.current.onSessionUpdated?.(payload));

    return () => {
      socket.disconnect();
    };
  }, [lectureId]);
};
