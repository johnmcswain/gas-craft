/**
 * @fileoverview Simplified HTTP client wrapping UrlFetchApp.
 *
 * Usage:
 *   const res = Http.getJson("https://api.example.com/users");
 *   // res => { ok: true, status: 200, data: [...], error: null }
 *
 *   const res = Http.post("https://api.example.com/users", { name: "Ada" });
 *   // sends JSON body, returns parsed response
 */
var Http = (function () {
  'use strict';

  // ── Friendly error map ────────────────────────────────────────────
  var STATUS_MESSAGES = {
    400: "Bad request \u2014 check the data you're sending.",
    401: "Unauthorized \u2014 you may need to log in or provide an API key.",
    403: "Forbidden \u2014 you don't have permission for this resource.",
    404: "Not found \u2014 double-check the URL.",
    429: "Too many requests \u2014 slow down and try again in a moment.",
    500: "Server error \u2014 the remote service had a problem.",
    502: "Bad gateway \u2014 the remote service may be down.",
    503: "Service unavailable \u2014 try again later."
  };

  // ── Defaults ──────────────────────────────────────────────────────
  var MAX_RETRIES = 3;
  var RETRY_CODES = [429, 500, 502, 503];
  var RETRY_DELAY_MS = 1000; // doubles each attempt

  // ── Internal helpers ──────────────────────────────────────────────

  /**
   * Pause execution for a given number of milliseconds.
   * @param {number} ms
   * @private
   */
  function sleep_(ms) {
    Utilities.sleep(ms);
  }

  /**
   * Build the UrlFetchApp params object.
   * @param {string} method - HTTP method.
   * @param {*} [body] - Request body (will be JSON-stringified if object).
   * @param {Object} [options] - Extra fetch options.
   * @return {Object} UrlFetchApp params.
   * @private
   */
  function buildParams_(method, body, options) {
    options = options || {};
    var params = {
      method: method,
      muteHttpExceptions: true,
      contentType: options.contentType || 'application/json',
      headers: options.headers || {}
    };

    // Attach auth token if provided
    if (options.auth) {
      var token = typeof options.auth === 'string'
        ? options.auth
        : options.auth.getAccessToken();
      params.headers['Authorization'] = 'Bearer ' + token;
    }

    if (body !== undefined && body !== null) {
      params.payload = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return params;
  }

  /**
   * Normalise the raw UrlFetchApp response into a consistent shape.
   * @param {HTTPResponse} response
   * @return {{ ok: boolean, status: number, data: *, headers: Object, error: string|null }}
   * @private
   */
  function formatResponse_(response) {
    var code = response.getResponseCode();
    var ok = code >= 200 && code < 300;
    var text = response.getContentText();
    var data = text;

    // Try to auto-parse JSON
    try {
      data = JSON.parse(text);
    } catch (e) {
      // leave as raw text
    }

    return {
      ok: ok,
      status: code,
      data: data,
      headers: response.getAllHeaders(),
      error: ok ? null : (STATUS_MESSAGES[code] || 'Request failed with status ' + code)
    };
  }

  /**
   * Core fetch with retry logic.
   * @param {string} url
   * @param {Object} params - UrlFetchApp params.
   * @param {number} [retries] - Max retry attempts for transient errors.
   * @return {{ ok: boolean, status: number, data: *, headers: Object, error: string|null }}
   * @private
   */
  function fetchWithRetry_(url, params, retries) {
    retries = (retries !== undefined) ? retries : MAX_RETRIES;
    var delay = RETRY_DELAY_MS;

    for (var attempt = 0; attempt <= retries; attempt++) {
      var response = UrlFetchApp.fetch(url, params);
      var result = formatResponse_(response);

      if (result.ok || RETRY_CODES.indexOf(result.status) === -1) {
        return result;
      }

      // Retryable error — wait and try again
      if (attempt < retries) {
        Log.warn('Http: retrying (' + (attempt + 1) + '/' + retries + ') ' + url, { status: result.status });
        sleep_(delay);
        delay *= 2;
      }
    }

    return result; // last failed attempt
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Send a GET request.
   * @param {string} url
   * @param {Object} [options] - { headers, auth, retries }
   * @return {{ ok, status, data, headers, error }}
   */
  function get(url, options) {
    options = options || {};
    return fetchWithRetry_(url, buildParams_('get', null, options), options.retries);
  }

  /**
   * Send a POST request.
   * @param {string} url
   * @param {*} body - Will be JSON-stringified.
   * @param {Object} [options]
   * @return {{ ok, status, data, headers, error }}
   */
  function post(url, body, options) {
    options = options || {};
    return fetchWithRetry_(url, buildParams_('post', body, options), options.retries);
  }

  /**
   * Send a PUT request.
   * @param {string} url
   * @param {*} body
   * @param {Object} [options]
   * @return {{ ok, status, data, headers, error }}
   */
  function put(url, body, options) {
    options = options || {};
    return fetchWithRetry_(url, buildParams_('put', body, options), options.retries);
  }

  /**
   * Send a PATCH request.
   * @param {string} url
   * @param {*} body
   * @param {Object} [options]
   * @return {{ ok, status, data, headers, error }}
   */
  function patch(url, body, options) {
    options = options || {};
    return fetchWithRetry_(url, buildParams_('patch', body, options), options.retries);
  }

  /**
   * Send a DELETE request.
   * @param {string} url
   * @param {Object} [options]
   * @return {{ ok, status, data, headers, error }}
   */
  function del(url, options) {
    options = options || {};
    return fetchWithRetry_(url, buildParams_('delete', null, options), options.retries);
  }

  /**
   * Shorthand: GET a URL and return only the parsed JSON data.
   * Throws on non-OK responses for simpler error handling.
   *
   * @param {string} url
   * @param {Object} [options]
   * @return {*} The parsed JSON data.
   * @throws {Error} If the response is not OK.
   */
  function getJson(url, options) {
    var res = get(url, options);
    if (!res.ok) {
      throw new Error('Http.getJson failed: ' + res.error);
    }
    return res.data;
  }

  /**
   * Shorthand: POST JSON and return only the parsed response data.
   * Throws on non-OK responses.
   *
   * @param {string} url
   * @param {*} body
   * @param {Object} [options]
   * @return {*} The parsed JSON data.
   * @throws {Error} If the response is not OK.
   */
  function postJson(url, body, options) {
    var res = post(url, body, options);
    if (!res.ok) {
      throw new Error('Http.postJson failed: ' + res.error);
    }
    return res.data;
  }

  return {
    get: get,
    post: post,
    put: put,
    patch: patch,
    delete: del,
    getJson: getJson,
    postJson: postJson
  };
})();
