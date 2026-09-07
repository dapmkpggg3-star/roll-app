# Automatic planning view integration

The review panel is intentionally split into independent files so it can be reviewed before it is connected to the existing application.

## Assets

- `js/planning-rules.js`
- `js/planning-schedule.js`
- `js/planning-calibers.js`
- `js/planning-view.js`
- `css/planning-view.css`

Load the stylesheet after the existing application stylesheet. Load the four scripts in the order above before the existing application entry script.

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
