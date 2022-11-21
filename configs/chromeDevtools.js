const CDP = require("chrome-remote-interface");
const chromeLauncher = require("chrome-launcher");

function launchChrome(headless = true) {
  return chromeLauncher.launch({
    port: 9222,
    chromeFlags: [headless ? "--headless" : ""],
  });
}

const url = "http://localhost:3000/";

exports.connectChrome = async (socket) => {
  const chrome = await launchChrome();
  let protocol;

  try {
    protocol = await CDP({ port: chrome.port });
    const { Page, Runtime, Debugger, Network } = protocol;

    await Page.enable();
    await Runtime.enable();
    await Debugger.enable();
    await Network.enable();

    Network.requestWillBeSent((params) => {
      console.log("params.request.url", params.request.url);
      console.log("params", params);
    });

    // await Runtime.consoleAPICalled(({ type, args }) => {//프론트랑 안맞춰서 일단 지워놓음&프론트에서 콘솔용으로 사용한 것 같음
    //   console.log("type", type);
    //   console.log("args", args);
    //   const message = args.map((arg) => arg.value || arg.description).join(" ");
    //   socket.emit("Debugger.console", JSON.stringify({ type, message }));
    // });

    // await Page.navigate({ url });

    socket.on("paused", (data) => {
      console.log("paused", data);
      Debugger.paused(async ({ callFrames }) => {
        const frame = callFrames[0];
        const { callFrameId, url } = frame;

        console.log("callFrameId", callFrameId);
        console.log("url", url);
      });
    });

    socket.on("stepInto", (data) => {
      Debugger.stepInto();
      console.log("stepInto", data);
    });

    socket.on("stepOut", (data) => {
      Debugger.stepInto();
      console.log("stepOut", data);
    });

    socket.on("stepOver", (data) => {
      Debugger.stepInto();
      console.log("stepOver", data);
    });

    await Runtime.runIfWaitingForDebugger();
    await Page.loadEventFired();
  } catch (err) {
    console.error(err);
  } finally {
    if (protocol) {
      await protocol.close();
    }
  }
};
