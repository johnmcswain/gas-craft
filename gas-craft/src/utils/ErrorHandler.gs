/**
 * @fileoverview Centralized error handling with wrap() decorator.
 *
 * Usage:
 *   // Direct handling
 *   try { ... } catch (e) { Errors.handle(e, "Could not load data"); }
 *
 *   // Wrap any function with automatic try/catch + logging
 *   const safeFetch = Errors.wrap(myFetchFunction);
 *   safeFetch(); // errors are caught, logged, and shown to user
 *
 *   // Wrap with a custom message
 *   const safeLoad = Errors.wrap(loadData, "Failed to load your spreadsheet data");
 */
const Errors = (function () {
  'use strict';

  // ── Friendly translations for common GAS errors ───────────────────
  var FRIENDLY_MAP = [
    { pattern: /You do not have permission/i,                  message: "You don't have permission to access that resource. Ask the owner to share it with you." },
    { pattern: /Service invoked too many times/i,              message: "Google rate limit hit \u2014 wait a minute and try again." },
    { pattern: /Limit Exceeded/i,                              message: "A Google quota was exceeded. Wait a bit and retry." },
    { pattern: /Document .* is missing/i,                      message: "The document couldn't be found. Double-check the URL or ID." },
    { pattern: /is not a function/i,                           message: "A coding error occurred \u2014 a function name may be misspelled." },
    { pattern: /Cannot read propert/i,                         message: "A coding error occurred \u2014 a variable is empty when it shouldn't be." },
    { pattern: /Sheet not found/i,                             message: "That sheet name doesn't exist in your spreadsheet. Check for typos." },
    { pattern: /Invalid argument/i,                            message: "One of the values passed in is invalid. Check your inputs." },
    { pattern: /Authorization is required/i,                   message: "This script needs permission to run. Please authorize it from the menu." },
    { pattern: /Unexpected error while getting the method/i,   message: "Google couldn't run that function \u2014 check the function name and try again." }
  ];

  /**
   * Look up a friendly message for a technical error string.
   * @param {string} technicalMessage
   * @return {string|null}
   * @private
   */
  function findFriendly_(technicalMessage) {
    for (var i = 0; i < FRIENDLY_MAP.length; i++) {
      if (FRIENDLY_MAP[i].pattern.test(technicalMessage)) {
        return FRIENDLY_MAP[i].message;
      }
    }
    return null;
  }

  /**
   * Standard error handler that logs and optionally shows a UI alert.
   *
   * @param {Error} error - The error object.
   * @param {string} [userMessage] - Friendly message to show the user.
   *   If omitted, the handler tries to auto-translate the error.
   * @param {boolean} [showAlert=true] - Whether to show a UI alert.
   */
  function handle(error, userMessage, showAlert) {
    if (showAlert === undefined) showAlert = true;

    // Log the full technical error
    Log.error(error.message, { stack: error.stack });

    if (showAlert) {
      try {
        var ui = SpreadsheetApp.getUi();
        var msg = userMessage
          || findFriendly_(error.message)
          || "An unexpected error occurred. Check View \u2192 Executions for details.";
        ui.alert('Error', msg + '\n\nTechnical: ' + error.message, ui.ButtonSet.OK);
      } catch (e) {
        // UI not available (time-driven trigger, etc.)
        console.warn('Could not show UI alert: ' + e.message);
      }
    }
  }

  /**
   * Wrap a function with automatic error handling.
   *
   * Returns a new function that calls the original inside a try/catch.
   * Errors are logged and shown to the user via handle().
   *
   * @param {Function} fn - The function to wrap.
   * @param {string} [userMessage] - Friendly message on failure.
   * @return {Function} A safe version of fn.
   */
  function wrap(fn, userMessage) {
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        handle(e, userMessage);
        return undefined;
      }
    };
  }

  return {
    handle: handle,
    wrap: wrap
  };
})();

// Backward-compatible alias
var ErrorHandler = Errors;
