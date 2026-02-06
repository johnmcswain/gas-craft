/**
 * @fileoverview Recipe for simple Mail Merge from Sheet to Email.
 *
 * Usage:
 *   MailMerge.run("Contacts", "1abc...templateDocId", { subject: "Welcome!" });
 */
var MailMerge = (function () {
  'use strict';

  /**
   * Runs the mail merge.
   * @param {string} sheetName - Name of the sheet with data (must have an 'Email' column).
   * @param {string} templateId - Google Doc ID of the template.
   * @param {Object} [options] - Optional settings.
   * @param {string} [options.subject] - Email subject line.
   */
  function run(sheetName, templateId, options) {
    options = options || {};
    var subjectLine = options.subject || 'GasCraft Mail Merge';

    try {
      var data = Sheet.readAll(sheetName, true);
      if (data.length === 0) {
        Log.warn('No data found in sheet: ' + sheetName);
        return;
      }

      var templateFile = DriveApp.getFileById(templateId);

      data.forEach(function (row, index) {
        if (!row.Email) {
          Log.warn('Skipping row ' + (index + 2) + ': No Email column or value.');
          return;
        }

        try {
          var docCopy = templateFile.makeCopy('Merge: ' + row.Email);
          var doc = DocumentApp.openById(docCopy.getId());
          var body = doc.getBody();

          for (var key in row) {
            body.replaceText('{{' + key + '}}', row[key]);
          }

          doc.saveAndClose();

          var pdf = docCopy.getAs(MimeType.PDF);
          MailApp.sendEmail({
            to: row.Email,
            subject: subjectLine,
            body: 'Please find your document attached.',
            attachments: [pdf]
          });

          docCopy.setTrashed(true);
          Log.info('Sent email to: ' + row.Email);
        } catch (rowError) {
          Errors.handle(rowError, 'Failed processing row for: ' + row.Email, false);
        }
      });

      SpreadsheetApp.getUi().alert('Mail Merge Complete!');
    } catch (e) {
      Errors.handle(e, 'Mail Merge Failed');
    }
  }

  return {
    run: run
  };
})();
