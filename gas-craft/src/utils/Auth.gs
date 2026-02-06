/**
 * @fileoverview Simplified OAuth2 wrapper for Google Apps Script.
 *
 * Wraps the popular OAuth2 for Apps Script library so students can
 * connect to external APIs in a few lines instead of 40+.
 *
 * Prerequisites:
 *   Add the OAuth2 library to your Apps Script project:
 *     Script ID: 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF
 *
 * Usage:
 *   // 1. Connect once (stores tokens automatically)
 *   const spotify = Auth.connect("spotify", {
 *     authUrl:      "https://accounts.spotify.com/authorize",
 *     tokenUrl:     "https://accounts.spotify.com/api/token",
 *     clientId:     "YOUR_CLIENT_ID",
 *     clientSecret: "YOUR_CLIENT_SECRET",
 *     scopes:       ["user-read-email", "playlist-read-private"]
 *   });
 *
 *   // 2. Use with Http
 *   const me = Http.getJson("https://api.spotify.com/v1/me", { auth: spotify });
 *
 *   // 3. Simple API-key auth (no OAuth needed)
 *   const weather = Http.getJson(url, { auth: Auth.apiKey("YOUR_KEY") });
 */
var Auth = (function () {
  'use strict';

  /**
   * Build a callback URL for this script so the OAuth flow can redirect back.
   * @return {string}
   * @private
   */
  function callbackUrl_() {
    return ScriptApp.getService().getUrl();
  }

  /**
   * Connect to an OAuth2 provider.
   *
   * Returns a service object you can pass to Http options as `auth`.
   * On the first call the user is prompted to authorize via a dialog.
   * After that, tokens are cached in User Properties automatically.
   *
   * @param {string} name - A short name for this service (e.g. "spotify", "github").
   * @param {Object} config
   * @param {string} config.authUrl      - The provider's authorization endpoint.
   * @param {string} config.tokenUrl     - The provider's token endpoint.
   * @param {string} config.clientId     - Your OAuth client ID.
   * @param {string} config.clientSecret - Your OAuth client secret.
   * @param {string[]} [config.scopes]   - Array of scope strings.
   * @return {OAuth2Service} A service object with .getAccessToken().
   */
  function connect(name, config) {
    if (!config.authUrl || !config.tokenUrl || !config.clientId || !config.clientSecret) {
      throw new Error('Auth.connect requires authUrl, tokenUrl, clientId, and clientSecret.');
    }

    var service = OAuth2.createService(name)
      .setAuthorizationBaseUrl(config.authUrl)
      .setTokenUrl(config.tokenUrl)
      .setClientId(config.clientId)
      .setClientSecret(config.clientSecret)
      .setCallbackFunction('authCallback')
      .setPropertyStore(PropertiesService.getUserProperties())
      .setCache(CacheService.getUserCache());

    if (config.scopes && config.scopes.length > 0) {
      service.setScope(config.scopes.join(' '));
    }

    // If not yet authorized, prompt the user
    if (!service.hasAccess()) {
      var authUrl = service.getAuthorizationUrl();
      try {
        var ui = SpreadsheetApp.getUi();
        var html = HtmlService.createHtmlOutput(
          '<p>Please authorize <b>' + name + '</b>:</p>' +
          '<p><a href="' + authUrl + '" target="_blank">Click here to authorize</a></p>' +
          '<p>Then close this dialog and re-run your script.</p>'
        ).setWidth(400).setHeight(200);
        ui.showModalDialog(html, 'Authorize ' + name);
      } catch (e) {
        // No UI — log the URL so it can be opened manually
        Log.info('Auth: Open this URL to authorize "' + name + '": ' + authUrl);
      }
    }

    return service;
  }

  /**
   * Disconnect / revoke an OAuth2 service by name.
   * @param {string} name
   */
  function disconnect(name) {
    var service = OAuth2.createService(name)
      .setPropertyStore(PropertiesService.getUserProperties());
    service.reset();
    Log.info('Auth: disconnected "' + name + '".');
  }

  /**
   * Check whether a named service is currently authorized.
   * @param {string} name
   * @return {boolean}
   */
  function isConnected(name) {
    var service = OAuth2.createService(name)
      .setPropertyStore(PropertiesService.getUserProperties());
    return service.hasAccess();
  }

  /**
   * Simple API-key helper — returns a string token that Http.get() etc.
   * will attach as a Bearer header. For services that just need a static key.
   *
   * @param {string} key
   * @return {string}
   */
  function apiKey(key) {
    return key;
  }

  return {
    connect: connect,
    disconnect: disconnect,
    isConnected: isConnected,
    apiKey: apiKey
  };
})();

/**
 * Global OAuth2 callback handler.
 * The OAuth2 library redirects back to this function after user authorization.
 * @param {Object} request - The callback request from the OAuth2 provider.
 * @return {HtmlOutput}
 */
function authCallback(request) {
  var serviceName = request.parameter.serviceName;
  var service = OAuth2.createService(serviceName)
    .setPropertyStore(PropertiesService.getUserProperties());
  var authorized = service.handleCallback(request);

  if (authorized) {
    return HtmlService.createHtmlOutput('Authorization successful! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Authorization denied. Please try again.');
  }
}
