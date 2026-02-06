/*
*
* Author: John McSwain
* Created: 2/6/26
* Updated: 2/6/26
* Version: 0.1.0
* Purpose: Created to simplify Google App Script syntax for programming courses I lead
* Source Code: https://github.com/johnmcswain/gas-craft
* Script ID: 1pXigysst-qyh4xUfH6wZFXLv9PpltRWLNvU76mhSwIbmYGRwgwPysBqr
* Feel free to fork, make PRs, or otherwise incorporate into programming classes
*/


/**
 * @fileoverview Main entry point for the GasCraft framework.
 *
 * Quick start:
 *   function onOpen() { GasCraft.init(); }
 *
 * Then use the utilities anywhere in your project:
 *   const rows  = Sheet.readAll("Contacts");
 *   const data  = Http.getJson("https://api.example.com/items");
 *   const auth  = Auth.connect("github", { ... });
 *   Log.info("All done!");
 *
 * Available modules:
 *   Sheet  - read/write spreadsheet data
 *   Http   - simplified API calls (get, post, getJson, etc.)
 *   Auth   - OAuth2 and API-key authentication
 *   Log    - structured logging (info, warn, error, debug)
 *   Errors - centralized error handling with wrap() decorator
 */
const GasCraft = (function () {
  'use strict';

  /**
   * Initializes the GasCraft environment in the current project.
   * Sets up the menu and shows a ready message.
   * @param {Object} [options] - Optional configuration settings.
   */
  function init(options) {
    createMenu_();

    var ui = getUi_();
    if (ui) {
      ui.alert('GasCraft Initialized!');
    } else {
      console.log('GasCraft Initialized (No UI available)');
    }
  }

  /**
   * Internal: create the GasCraft add-on menu.
   * @private
   */
  function createMenu_() {
    var ui = getUi_();
    if (!ui) return;

    ui.createMenu('GasCraft')
      .addItem('Settings', 'GasCraft.showSettings')
      .addItem('Help', 'GasCraft.showHelp')
      .addToUi();
  }

  /**
   * Internal: get the UI for the current app context.
   * @private
   */
  function getUi_() {
    try { if (SpreadsheetApp) return SpreadsheetApp.getUi(); } catch (e) {}
    try { if (DocumentApp)    return DocumentApp.getUi();    } catch (e) {}
    try { if (SlidesApp)      return SlidesApp.getUi();      } catch (e) {}
    try { if (FormApp)        return FormApp.getUi();        } catch (e) {}
    return null;
  }

  function showSettings() {
    var ui = getUi_();
    if (ui) ui.alert('Settings feature coming soon.');
  }

  function showHelp() {
    var ui = getUi_();
    if (ui) ui.alert('Visit the documentation at: https://github.com/johnmcswain/gas-craft');
  }

  function onOpen() {
    createMenu_();
  }

  return {
    init: init,
    onOpen: onOpen,
    showSettings: showSettings,
    showHelp: showHelp
  };
})();

/**
 * Global onOpen trigger. Attach this in your project's triggers.
 */
function onOpen() {
  GasCraft.onOpen();
}
