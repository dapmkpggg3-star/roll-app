# Automatic planning foundation

This module provides a generic rule engine for planning maintenance work around production.

Company-specific production amounts, equipment identifiers, thresholds, dates, prices, work times, and operating rules must not be stored in this public repository. Supply them at runtime from an access-controlled data source.

## Public module responsibilities

- Reject work in a production-active slot.
- Apply configurable work-type and equipment restrictions.
- Apply configurable single-crew and joint-maintenance limits.
- Detect a change between consecutive production sizes.
- Rank eligible maintenance slots.
- Prefer the same team as the next production run when configured.
- Consider configurable benefits from combining required work in a joint-maintenance slot.
- Count production runs by assigned team and shift.
- Split production into size-specific campaigns; a return to a size starts a new campaign when configured by the caller.
- Detect additional caliber work only when a same-size campaign exceeds its configured limit.
- Forecast the first production run that would exceed a configurable caliber limit.
- Return the latest safe maintenance slot before that run.
- Consider an explicitly allowed after-production slot before the next shift.
- Accept a configurable caliber sequence or an explicit next-caliber override.
- Return warnings instead of silently accepting exceptions.
- Render size-change, caliber-change, and no-safe-slot results in a collapsible review panel.

## Private configuration responsibilities

- Actual equipment identifiers and groups.
- Shift times and staffing rules.
- Production amounts and operating calendar.
- Work duration, workload, and capacity values.
- Ranking weights used to compare eligible work slots.
- Caliber limits and roll replacement thresholds.
- Prices, vendors, roll identifiers, and maintenance history.

The first application phase should present recommendations with reasons and require a human to approve them. It should not automatically publish or confirm a production plan.

Caliber state is supplied at runtime with generic fields such as `maxRuns`, `maxRunsBySize`, `usedRuns`, `currentCaliber`, and `caliberSequence`. Actual equipment names, limits, current positions, and production figures stay outside these public modules.

`js/planning-view.js` is display-only. The application can pass a calculated result with `RollPlanningView.setData(result)`. The panel stores only the result supplied by the application and does not upload source production data.
