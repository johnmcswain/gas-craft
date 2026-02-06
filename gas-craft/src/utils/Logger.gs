/**
 * @fileoverview Structured logging utility.
 *
 * Usage:
 *   Log.info("User logged in", { email: "ada@example.com" });
 *   Log.warn("Rate limit approaching");
 *   Log.error("Failed to fetch", { url: url, status: 500 });
 */
var Log = (function () {
  'use strict';

  /**
   * Logs a message to the console (Stackdriver / Cloud Logging).
   * @param {string} level - "INFO", "WARN", "ERROR", "DEBUG"
   * @param {string} message - The main log message.
   * @param {Object} [context] - Optional object with extra details.
   */
  function log(level, message, context) {
    var fullMessage = '[' + level + '] ' + message;
    if (context) {
      fullMessage += ' ' + JSON.stringify(context);
    }
    console.log(fullMessage);
  }

  function info(message, context)  { log('INFO',  message, context); }
  function warn(message, context)  { log('WARN',  message, context); }
  function error(message, context) { log('ERROR', message, context); }
  function debug(message, context) { log('DEBUG', message, context); }

  return {
    log: log,
    info: info,
    warn: warn,
    error: error,
    debug: debug
  };
})();

// Backward-compatible alias (GAS built-in Logger is still available as console)
var Logger_ = Log;
