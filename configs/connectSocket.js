const { Server } = require("socket.io");

module.exports = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_CLIENT_HOST,
      methods: ["GET", "POST", "PUT"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("Method", async (data) => {
      console.log(data);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("error", (error) => {
      console.error(`Socket connect failed because ${error}`);
    });
  });
};
