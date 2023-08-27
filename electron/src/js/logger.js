class logger {
  hlsjsLog = (logFn, level, message) => {
    if (!window.jwplayer.debug) {
      return;
    }
    logFn.call(console, `[Hls.js ${level}] -> ${message}`);
  };

  debug = (message) => {
    hlsjsLog(console.debug, "debug", message);
  };

  log = (message) => {
    hlsjsLog(console.log, "log", message);
  };

  info = (message) => {
    hlsjsLog(console.info, "info", message);
  };

  warn = (message) => {
    hlsjsLog(console.warn, "warn", message);
  };

  error = (message) => {
    hlsjsLog(console.error, "error", message);
  };
}
