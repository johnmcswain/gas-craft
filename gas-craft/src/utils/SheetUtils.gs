/**
 * @fileoverview Utility functions for common Spreadsheet operations.
 *
 * Usage:
 *   const rows = Sheet.readAll("Contacts");         // array of objects
 *   Sheet.appendRow("Contacts", ["Ada", "ada@x.com"]);
 *   Sheet.write("Output", [["Name","Score"],["Ada",100]]);
 *   const val = Sheet.getValue("Settings", "B2");   // single cell
 */
var Sheet = (function () {
  'use strict';

  /**
   * Reads all data from a sheet as an array of objects (if header row exists).
   * @param {string} sheetName - The name of the sheet to read.
   * @param {boolean} [hasHeader=true] - Whether the first row is a header.
   * @return {Array<Object>|Array<Array<any>>} The data from the sheet.
   */
  function readAll(sheetName, hasHeader) {
    if (hasHeader === undefined) hasHeader = true;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow < 1 || lastCol < 1) return [];

    if (hasHeader) {
      if (lastRow === 1) return []; // Only header row exists
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      return data.map(function (row) {
        var obj = {};
        row.forEach(function (cell, i) {
          obj[headers[i]] = cell;
        });
        return obj;
      });
    } else {
      return sheet.getRange(1, 1, lastRow, lastCol).getValues();
    }
  }

  /**
   * Appends a row of data to a sheet.
   * @param {string} sheetName
   * @param {Array<any>} rowData
   */
  function appendRow(sheetName, rowData) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }
    sheet.appendRow(rowData);
  }

  /**
   * Writes a 2D array to a sheet, starting at A1 (overwrites existing data).
   * Creates the sheet if it doesn't exist.
   * @param {string} sheetName
   * @param {Array<Array<any>>} data
   */
  function write(sheetName, data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }

    if (data.length > 0 && data[0].length > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }
  }

  /**
   * Read a single cell value.
   * @param {string} sheetName
   * @param {string} cellRef - A1 notation, e.g. "B2".
   * @return {*}
   */
  function getValue(sheetName, cellRef) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }
    return sheet.getRange(cellRef).getValue();
  }

  /**
   * Write a single cell value.
   * @param {string} sheetName
   * @param {string} cellRef - A1 notation, e.g. "B2".
   * @param {*} value
   */
  function setValue(sheetName, cellRef, value) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }
    sheet.getRange(cellRef).setValue(value);
  }

  return {
    readAll: readAll,
    appendRow: appendRow,
    write: write,
    getValue: getValue,
    setValue: setValue
  };
})();

// Backward-compatible alias
var SheetUtils = Sheet;
