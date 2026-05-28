let ioInstance = null;

export const registerSocketServer = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    socket.on("lecture:join", (lectureId) => {
      if (lectureId) {
        socket.join(`lecture:${lectureId}`);
      }
    });
  });
};

export const emitQuestionGenerated = (lectureId, payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(`lecture:${lectureId}`).emit("question:new", payload);
};

export const emitScoreboardUpdated = (lectureId, payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(`lecture:${lectureId}`).emit("scoreboard:updated", payload);
};

export const emitSessionUpdated = (lectureId, payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(`lecture:${lectureId}`).emit("session:updated", payload);
};
