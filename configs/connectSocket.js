const { Server } = require("socket.io");
const { connectChrome } = require("./chromeDevtools");
// const { connectChrome } = require("./test");
const path = require("path");
const fs = require("fs");
// const { VM } = require("vm2");

// const vm = new VM();

const writeCode = (src) => {
  const session = path.join(__dirname, "/playground");

  if (!fs.existsSync(session)) {
    fs.mkdirSync(session);
  }

  fs.writeFileSync(path.join(session, "code.js"), src);

  return session;
};

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

    socket.on("beginDebug", async (data) => {
      console.log("재생버튼 클릭 beginDebug");
      const code = JSON.parse(data);
      const debugPath = writeCode(code);
      const result = vm.run(code);
      //console.log("code", code);
      //console.log("result", result);
    });

    socket.on("disconnect", (reason) => {
      console.log(`socket ${socket.id} disconnected due to ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`Socket connect failed because ${error}`);
    });
  });
};
