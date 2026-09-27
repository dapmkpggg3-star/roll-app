# Monthly planning sheet output

The application reads the production workbook locally, calculates candidates locally, and sends only the monthly calendar fields and recommendations to the managed Google Sheet.

## Assets

- `js/planning-rules.js`
- `js/planning-schedule.js`
- `js/planning-calibers.js`
- `js/planning-view.js`
- `js/planning-sheet-output.js`
- `js/planning-import.js`
- `css/planning-view.css`

Load the stylesheet after the existing application stylesheet. Load the scripts in the order used by `index.html` before the existing application entry script.

## Local Excel import

`planning-import.js` reads `.xlsx` and `.xlsm` files entirely in the browser. It does not send the workbook or production amounts to GitHub, GAS, Google Sheets, or another server. Imported values remain in memory and are cleared by reloading the page or pressing the clear button. Only date, size, assigned shift, and calculated recommendation fields are sent to Apps Script when the user presses the export button.

The importer finds month sheets whose names contain `生産予定`, reads the consecutive day table, and selects the latest month that has active production. Past-month export is blocked in the browser. Matching `ロールカリバ替予定` sheets are used only to identify companion work in the candidate window.

Apps Script copies the latest prior `ロールカリバ替予定` sheet as a visual template, carries the prior sheet's lower next-month work into the new top month, and updates the imported calendar. The generated sheet is marked as owned by the exporter. Re-exporting the same month updates that sheet and restores only cells previously written by the exporter; a same-name unowned sheet is never overwritten.

## Required element IDs

The host page supplies a collapsible section containing these IDs:

- `auto-planning-panel`
- `auto-planning-toggle`
- `auto-planning-body`
- `auto-planning-file`
- `auto-planning-file-button`
- `auto-planning-export`
- `auto-planning-import-status`
- `auto-planning-source-summary`

## Data handoff

After the private production-plan adapter calculates results, build the sanitized monthly payload:

```js
const payload = RollPlanningSheetOutput.buildExportPayload(parsedWorkbook);
await RollSheetGateway.exportPlanningDraft(payload);
```

The application does not render plan cards. Review and editing happen in the generated Google Sheets month tab. Caliber recommendations remain explicitly unconnected until their trusted state and limits are supplied.
