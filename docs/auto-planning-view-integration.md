# Automatic planning view integration

The review panel is intentionally split into independent files so it can be reviewed before it is connected to the existing application.

## Assets

- `js/planning-rules.js`
- `js/planning-schedule.js`
- `js/planning-calibers.js`
- `js/planning-view.js`
- `js/planning-import.js`
- `css/planning-view.css`

Load the stylesheet after the existing application stylesheet. Load the five scripts in the order above before the existing application entry script.

## Local Excel import

`planning-import.js` reads `.xlsx` and `.xlsm` files entirely in the browser. It does not send the workbook or production amounts to GitHub, GAS, Google Sheets, or another server. Imported values remain in memory and are cleared by reloading the page or pressing the clear button.

The importer finds month sheets whose names contain `生産予定`, reads the consecutive day table, converts it to the generic schedule shape, and passes size-change recommendations to the planning view. It also reads matching `ロールカリバ替予定` sheets only to identify companion work in the candidate window. Caliber recommendations are shown as unconnected until their separate runtime settings are connected.

## Required element IDs

The host page supplies a collapsible section containing these IDs:

- `auto-planning-panel`
- `auto-planning-toggle`
- `auto-planning-body`
- `auto-planning-size-count`
- `auto-planning-caliber-count`
- `auto-planning-risk-count`
- `auto-planning-empty`
- `auto-planning-list`

## Data handoff

After the private production-plan adapter calculates results, pass only the result needed for display:

```js
RollPlanningView.setData({
  sizeChanges: sizeChangeResults,
  caliberChanges: caliberChangeResults
});
```

The view does not upload data. Company-specific values and rules remain in the private adapter or runtime configuration.
