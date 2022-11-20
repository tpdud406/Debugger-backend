const { Server } = require("socket.io");
const { connectChrome } = require("./chromeDevtools");

module.exports = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`socket ${socket.id} connected`);
    connectChrome(socket);

    socket.on("bb", (data) => {
      console.log("받았다", data);
    });

    socket.emit("aa", "hi 아임 빼껜, 이 메세지를 받아라!");
    socket.on("disconnect", (reason) => {
      console.log(`socket ${socket.id} disconnected due to ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`Socket connect failed because ${error}`);
    });
  });
};
