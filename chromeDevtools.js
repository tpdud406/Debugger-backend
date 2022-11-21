const CDP = require("chrome-remote-interface");
const chromeLauncher = require("chrome-launcher");

function launchChrome(headless = false) {
  return chromeLauncher.launch({
    port: 9222,
    chromeFlags: [
      "--window-size=712,732",
      "--disable-gpu",
      headless ? "--headless" : "",
    ],
  });
}

// const url = "http://localhost:3000/debugging";

async function connectChrome() {
  const chrome = await launchChrome();
  let protocol;

  try {
    protocol = await CDP({ port: chrome.port });
    const { Page, Runtime, Debugger, Network } = protocol;

    Network.requestWillBeSent((params) => {
      console.log("params.request.url", params.request.url);
      console.log("params", params);
    });

    await Debugger.enable();
    await Network.enable();
    await Runtime.enable();
    await Page.enable();
    // await Page.navigate({ url });
    await Page.navigate({ url: "http://localhost:8080" });
    await Page.loadEventFired();
  } catch (err) {
    console.error(err);
  } finally {
    if (protocol) {
      await protocol.close();
    }
  }
}

connectChrome();
