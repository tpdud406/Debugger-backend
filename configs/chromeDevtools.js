const CDP = require("chrome-remote-interface");
const chromeLauncher = require("chrome-launcher");
const { fork } = require("child_process");

function launchChrome(headless = true) {
  return chromeLauncher.launch({
    port: 9222,
    chromeFlags: [headless ? "--headless" : ""],
  });
}

const url = "http://localhost:3000/";
let isNeed = false;
flag_req = 0;
old = "";
frame_current = "";

exports.connectChrome = async (socket) => {
  const chrome = await launchChrome();
  let protocol;
  // const child = fork(__dirname + "/playground/code.js", [], {
  //   execArgv: ["--inspect-brk=9229"],
  // });
  const child = fork(__dirname + "/playground/code.js", {
    execArgv: [],
  });
  console.log(child.connected && "fork child");

  try {
    protocol = await CDP({ port: chrome.port });

    const { Page, Runtime, Debugger, Network } = protocol;
    console.log("디버거 연결 attach");
    Debugger.enable();
    await Runtime.runIfWaitingForDebugger();
    // Debugger.pause();
    const req_ids = new Set();

    let parames = await Debugger.paused((params) => {
      old = frame_current;
      frame_current = JSON.stringify(params.callFrames);
      console.log("내부 params", params);
      Network.requestWillBeSentExtraInfo(({ headers, requestId }) => {
        isNeed = false;
        host = headers["Host"];
        auth = headers[":authority"];
        isNeed = host == real_url || auth == real_url;

        if (isNeed && flag_req == 0) {
          flag_req = 1;
          req_ids.add(requestId);
        }
      });

      Network.requestWillBeSent(({ requestId, request }) => {
        if (req_ids.has(requestId) && flag_req == 1) {
          console.log(frame_current);
          flag_req += 1;
          console.log("!#!"); //separator
          console.log(JSON.stringify(request));
          console.log("!#!");
        }
      });

      Network.responseReceived(({ requestId, response }) => {
        if (req_ids.has(requestId) && flag_req == 2) {
          flag_req += 1;
          console.log("response", JSON.stringify(response));
        }
      });

      Debugger.resume();
    });
    console.log("외부 parames", parames);
    //여기까지 씨알아이

    // //여기부터 깃헙
    // let { scriptId } = Network.requestWillBeSent(async (params) => {
    //   //없어도 되나? 후이꺼엔 없었음
    //   console.log("params.request.url", params.request.url);
    //   console.log("params", params);

    //   const { requestId } = params;
    //   console.log("requestId", requestId);

    //   const { breakpointId } = await Debugger.setBreakpoint({
    //     location: {
    //       scriptId: 443,
    //       lineNumber: 1, // (zero-based)
    //     },
    //   });
    // });

    // console.log("scriptId", scriptId);
    // pending at here
    Debugger.enable();
    // console.log("enabled");
    Debugger.pause();
    console.log("pause");

    Debugger.scriptParsed(async (params) => {
      // const { scriptId } = params;
      console.log("params", params);
      const { breakpointId } = await Debugger.setBreakpoint({
        location: {
          scriptId: 443,
          lineNumber: 1, // (zero-based)
        },
      });
    });

    Debugger.paused((p) => {
      let { callFrames } = p;
      if (callFrames[0].url.endsWith("code.js")) {
        console.log(
          `PAUSED at line ${
            callFrames[0].location.lineNumber + 1
          } : filename -> ${callFrames[0].url}`,
        ); // (zero-based)
      }
      setTimeout(Debugger.resume, 1000);
    });

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

      // if (callFrames[0].url.endsWith("code.js")) {
      //   console.log(
      //     `PAUSED at line ${
      //       callFrames[0].location.lineNumber + 1
      //     } : filename -> ${callFrames[0].url}`,
      //   ); // (zero-based)
      // }
      setTimeout(Debugger.resume, 1000);

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
      console.log("ㅇ여기 들ㅓㅗ나?");
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

        Debugger.resume();
      }
    });

    const stop = async () => {
      if (socket) {
        socket.emit("Debugger.stop");
        console.log("여기도 들어오나?");
        const events = socket.eventNames();

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

    // await Runtime.consoleAPICalled(({ type, args }) => {
    //   //프론트랑 안맞춰서 일단 지워놓음&프론트에서 콘솔용으로 사용한 것 같음
    //   console.log("type", type);
    //   console.log("args", args);
    //   const message = args.map((arg) => arg.value || arg.description).join(" ");
    //   console.log("message", message);
    //   // socket.emit("Debugger.console", JSON.stringify({ type, message }));
    // });

    // await Page.navigate({ url });

    // Debugger.scriptParsed(async (params) => {//구문 분석된 스크립트
    //   const { scriptId } = params;
    //   console.log("scriptId", scriptId);

    //   const { breakpointId } = await Debugger.setBreakpoint({
    //     location: {
    //       scriptId: scriptId,
    //       lineNumber: 1, // (zero-based)
    //     },
    //   });
    // });
  } catch (err) {
    //console.error(err);
  }
  // finally {
  //   if (protocol) {
  //     await protocol.close();
  //   }
  // }
};

// exports.handleSocket = async (socket) => {
//   socket.on("codeRun", async (data) => {
//     const code = JSON.parse(data);
//     const result = vm.run(code);

//     socket.emit("result", result);
//   });

// try {
//   await this.connectChrome(socket, codeRunning);
// } catch (err) {
//   //console.error(err);
// }
// };
