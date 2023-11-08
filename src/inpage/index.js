const { initializeProvider, shimWeb3 } = require('@metamask/providers');
const ObjectMultiplex = require('@metamask/object-multiplex');
const pump = require('pump');
const uuid = require('uuid');

const MobilePortStream = require('./MobilePortStream');
const ReactNativePostMessageStream = require('./ReactNativePostMessageStream');

const INPAGE = 'metamask-inpage';
const CONTENT_SCRIPT = 'metamask-contentscript';
const PROVIDER = 'metamask-provider';

// Setup stream for content script communication
const metamaskStream = new ReactNativePostMessageStream({
  name: INPAGE,
  target: CONTENT_SCRIPT,
});

// Initialize provider object (window.ethereum)
initializeProvider({
  connectionStream: metamaskStream,
  shouldSendMetadata: false,
  providerInfo: {
    icon: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODEiIGhlaWdodD0iODEiIHZpZXdCb3g9IjAgMCA4MSA4MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNy4wMDU3IDE3LjAwNjJDMTguOTMwMyAxNS4wODE2IDIxLjU0MDUgMTQuMDAwNCAyNC4yNjIyIDE0LjAwMDRMNjcuMzI5NiAxNFYyMS44NzQxQzY3LjMyOTYgMjMuODMwNSA2Ni41NTIzIDI1LjcwNjcgNjUuMTY5IDI3LjA5QzYzLjc4NTcgMjguNDczMyA2MS45MDk1IDI5LjI1MDQgNTkuOTUzMiAyOS4yNTA0SDM5LjcwNDVDMzYuOTgyOCAyOS4yNTA0IDM0LjM3MjYgMzAuMzMxNiAzMi40NDggMzIuMjU2MUMzMC41MjM1IDM0LjE4MDcgMjkuNDQyMyAzNi43OTA5IDI5LjQ0MjMgMzkuNTEyNlY0Mi4xMjQyQzI5LjQ0MjMgNDQuODQ1OSAzMC41MjM1IDQ3LjQ1NjEgMzIuNDQ4IDQ5LjM4MDZDMzQuMzcyNiA1MS4zMDUxIDM2Ljk4MjggNTIuMzg2MyAzOS43MDQ1IDUyLjM4NjNINTkuOTUzMkM2MS45MDk1IDUyLjM4NjMgNjMuNzg1NyA1My4xNjM1IDY1LjE2OSA1NC41NDY4QzY2LjU1MjMgNTUuOTMwMSA2Ny4zMjk2IDU3LjgwNjMgNjcuMzI5NiA1OS43NjI2VjY3LjMzSDI0LjI2MjJDMjEuNTQwNSA2Ny4zMyAxOC45MzAzIDY2LjI0ODggMTcuMDA1NyA2NC4zMjQzQzE1LjA4MTIgNjIuMzk5NyAxNCA1OS43ODk1IDE0IDU3LjA2NzhWMjQuMjYyNkMxNCAyMS41NDA5IDE1LjA4MTIgMTguOTMwNyAxNy4wMDU3IDE3LjAwNjJaTTQwLjE0NzkgMzMuNTQyM0g2MC45MTU3QzY0LjQ1OCAzMy41NDIzIDY3LjMyOTUgMzYuNDEzOCA2Ny4zMjk1IDM5Ljk1NjFWNDEuNjgxNkM2Ny4zMjk1IDQ1LjIyMzggNjQuNDU4IDQ4LjA5NTQgNjAuOTE1NyA0OC4wOTU0SDQwLjE0NzlDMzYuNjA1NyA0OC4wOTU0IDMzLjczNDEgNDUuMjIzOCAzMy43MzQxIDQxLjY4MTZWMzkuOTU2MUMzMy43MzQxIDM2LjQxMzggMzYuNjA1NyAzMy41NDIzIDQwLjE0NzkgMzMuNTQyM1oiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yODdfMjM1OSkiLz4KPGRlZnM+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8yODdfMjM1OSIgeDE9IjE5LjM2MDIiIHkxPSIxNCIgeDI9IjU2Ljc2OTYiIHkyPSI2OS44MDA1IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNDNTQ5RkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNjU0QkZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==`,
    name: 'MultiPay',
    rdns: 'com.multipay',
    uuid: uuid.v4(),
  },
});

// Set content script post-setup function
Object.defineProperty(window, '_metamaskSetupProvider', {
  value: () => {
    setupProviderStreams();
    delete window._metamaskSetupProvider;
  },
  configurable: true,
  enumerable: false,
  writable: false,
});

// Functions

/**
 * Setup function called from content script after the DOM is ready.
 */
function setupProviderStreams() {
  // the transport-specific streams for communication between inpage and background
  const pageStream = new ReactNativePostMessageStream({
    name: CONTENT_SCRIPT,
    target: INPAGE,
  });

  const appStream = new MobilePortStream({
    name: CONTENT_SCRIPT,
  });

  // create and connect channel muxes
  // so we can handle the channels individually
  const pageMux = new ObjectMultiplex();
  pageMux.setMaxListeners(25);
  const appMux = new ObjectMultiplex();
  appMux.setMaxListeners(25);

  pump(pageMux, pageStream, pageMux, (err) =>
    logStreamDisconnectWarning('MetaMask Inpage Multiplex', err),
  );
  pump(appMux, appStream, appMux, (err) => {
    logStreamDisconnectWarning('MetaMask Background Multiplex', err);
    notifyProviderOfStreamFailure();
  });

  // forward communication across inpage-background for these channels only
  forwardTrafficBetweenMuxes(PROVIDER, pageMux, appMux);

  // add web3 shim
  shimWeb3(window.ethereum);
}

/**
 * Set up two-way communication between muxes for a single, named channel.
 *
 * @param {string} channelName - The name of the channel.
 * @param {ObjectMultiplex} muxA - The first mux.
 * @param {ObjectMultiplex} muxB - The second mux.
 */
function forwardTrafficBetweenMuxes(channelName, muxA, muxB) {
  const channelA = muxA.createStream(channelName);
  const channelB = muxB.createStream(channelName);
  pump(channelA, channelB, channelA, (err) =>
    logStreamDisconnectWarning(
      `MetaMask muxed traffic for channel "${channelName}" failed.`,
      err,
    ),
  );
}

/**
 * Error handler for page to extension stream disconnections
 *
 * @param {string} remoteLabel - Remote stream name
 * @param {Error} err - Stream connection error
 */
function logStreamDisconnectWarning(remoteLabel, err) {
  let warningMsg = `MetamaskContentscript - lost connection to ${remoteLabel}`;
  if (err) {
    warningMsg += `\n${err.stack}`;
  }
  console.warn(warningMsg);
  console.error(err);
}

/**
 * This function must ONLY be called in pump destruction/close callbacks.
 * Notifies the inpage context that streams have failed, via window.postMessage.
 * Relies on @metamask/object-multiplex and post-message-stream implementation details.
 */
function notifyProviderOfStreamFailure() {
  window.postMessage(
    {
      target: INPAGE, // the post-message-stream "target"
      data: {
        // this object gets passed to object-multiplex
        name: PROVIDER, // the object-multiplex channel name
        data: {
          jsonrpc: '2.0',
          method: 'METAMASK_STREAM_FAILURE',
        },
      },
    },
    window.location.origin,
  );
}
