const CDP = require("chrome-remote-interface");
const chromeLauncher = require("chrome-launcher");
const { VM } = require("vm2");

const vm = new VM();

function launchChrome(headless = true) {
  return chromeLauncher.launch({
    port: 9222,
    chromeFlags: [headless ? "--headless" : ""],
  });
}

const url = "http://localhost:3000/";

exports.connectChrome = async (socket, debugPath) => {
  const chrome = await launchChrome();
  let protocol;

  try {
    protocol = await CDP({ port: chrome.port });

    const { Page, Runtime, Debugger, Network } = protocol;
    console.log("디버거 연결 attach");

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

    socket.on("eval", async (data) => {
      const { callFrameId, expressions } = JSON.parse(data);
      console.log("eval callFrameId", callFrameId);
      const result = await Promise.all(
        expressions.map(async (expression) => {
          const ret = await Debugger.evaluateOnCallFrame({
            callFrameId,
            expression,
            silent: true,
            returnByValue: true,
          });

          return { name: expression, result: ret.result };
        }),
      );

      socket.emit("Debugger.evalResult", JSON.stringify({ result }));
    });

    Debugger.paused(async ({ callFrames }) => {
      if (callFrames.length <= 1) {
        stop();
      } else {
        const frame = callFrames[0];
        const { callFrameId, url } = frame;

        console.log("frame", frame);
        console.log("url", url);
        console.log("callFrameId", callFrameId);
        if (url) {
          const { location } = frame;
          const scope = frame.scopeChain.find(
            (scope) => scope.type === "local",
          );
          console.log("scope", scope);
          const variables = await Runtime.getProperties({
            objectId: scope.object.objectId,
          });

          socket.emit(
            "Debugger.paused",
            JSON.stringify({ callFrameId, location, scope, variables }),
          );
        } else {
          await Debugger.stepOver();
        }
      }
    });

    const stop = async () => {
      if (socket) {
        socket.emit("Debugger.stop");
        console.log("여기도 들어오나?");
        const events = socket.eventNames();
        console.log("events", events);
        events.forEach((event) => {
          if (event !== "beginDebug") {
            const eventFunctions = socket.listeners(event);
            eventFunctions.forEach((eventFunction) => {
              socket.removeListener(event, eventFunction);
            });
          }
        });

        if (protocol) {
          await protocol.close();
        }
      }
    };

    socket.on("stopDebug", async () => {
      await stop();
    });

    socket.on("disconnect", async () => {
      await stop();
    });
    // await Network.enable();
    // Network.requestWillBeSent(async (params) => {
    //   //없어도 되나? 후이꺼엔 없었음
    //   console.log("params.request.url", params.request.url);
    //   // console.log("params", params);

    //   const { requestId } = params;
    //   console.log("requestId", requestId);

    //   const { breakpointId } = await Debugger.setBreakpoint({
    //     location: {
    //       scriptId: scriptId,
    //       lineNumber: 1, // (zero-based)
    //     },
    //   });
    // });

    // await Runtime.consoleAPICalled(({ type, args }) => {//프론트랑 안맞춰서 일단 지워놓음&프론트에서 콘솔용으로 사용한 것 같음
    //   console.log("type", type);
    //   console.log("args", args);
    //   const message = args.map((arg) => arg.value || arg.description).join(" ");
    //   socket.emit("Debugger.console", JSON.stringify({ type, message }));
    // });

    // await Page.navigate({ url });

    // socket.on("paused", (data) => {
    //   console.log("paused", data);
    //   Debugger.paused(async ({ callFrames }) => {
    //     const frame = callFrames[0];
    //     const { callFrameId, url } = frame;

    //     console.log("callFrameId", callFrameId);
    //     console.log("url", url);
    //   });
    // });

    await Runtime.enable();
    await Runtime.runIfWaitingForDebugger();
    // await Page.enable();
    // await Page.loadEventFired();

    await Debugger.enable();
    console.log("enabled??");

    // Debugger.scriptParsed(async (params) => {
    //   const { scriptId } = params;
    //   console.log("scriptId", scriptId);

    //   const { breakpointId } = await Debugger.setBreakpoint({
    //     location: {
    //       scriptId: scriptId,
    //       lineNumber: 1, // (zero-based)
    //     },
    //   });
    // });

    // await Debugger.setPauseOnExceptions({
    //   state: "all",
    // });
  } catch (err) {
    console.error(err);
  }
  // finally {
  //   if (protocol) {
  //     await protocol.close();
  //   }
  // }
};

exports.handleSocket = async (socket) => {
  socket.on("codeRun", async (data) => {
    const code = JSON.parse(data);
    const result = vm.run(code);

    socket.emit("result", result);
  });

  // try {
  //   await this.connectChrome(socket, codeRunning);
  // } catch (err) {
  //   console.error(err);
  // }
};
