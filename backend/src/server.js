import http from "http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { registerSocketServer } from "./services/socketService.js";

const bootstrap = async () => {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true
    }
  });

  registerSocketServer(io);

  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error("Server failed to start", error);
  process.exit(1);
});
