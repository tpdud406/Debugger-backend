const CDP = require("chrome-remote-interface");
const axios = require("axios");

const url = "http://localhost:3000/";

exports.connectChrome = async (socket) => {
  const res = await axios.get("http://localhost:9222/json/list");
  let protocol;

  try {
    protocol = await CDP({ port: 9222, target: res.data.webSocketDebuggerUrl });

    const { Runtime, Debugger, Network } = protocol;
    console.log("디버거 연결 attach");

    await Debugger.paused((obj) => {
      console.log("obj callFrames", obj.callFrames[0]);
    });

    await Debugger.enable();
    let obj = await Debugger.setBreakpointByUrl({
      lineNumber: 3,
      urlRegex: "[a-z]+",
    });
    console.log("obj", obj);

    console.log("enabled");

    socket.on("stepInto", () => {
      Debugger.stepInto();
      console.log("stepInto");
    });

    socket.on("stepOut", async () => {
      Debugger.stepOut();

      console.log("stepOut");
    });

    socket.on("stepOver", () => {
      Debugger.stepOver();

      console.log("stepOver");
    });
  } catch (err) {
    //console.error(err);
  }
  // finally {
  //   if (protocol) {
  //     await protocol.close();
  //   }
  // }
};
