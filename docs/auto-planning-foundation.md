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
- Forecast the first production run that would exceed a configurable caliber limit.
- Return the latest safe maintenance slot before that run.
- Accept a configurable caliber sequence or an explicit next-caliber override.
- Return warnings instead of silently accepting exceptions.

## Private configuration responsibilities

- Actual equipment identifiers and groups.
- Shift times and staffing rules.
- Production amounts and operating calendar.
- Work duration, workload, and capacity values.
- Ranking weights used to compare eligible work slots.
- Caliber limits and roll replacement thresholds.
- Prices, vendors, roll identifiers, and maintenance history.

The first application phase should present recommendations with reasons and require a human to approve them. It should not automatically publish or confirm a production plan.

Caliber state is supplied at runtime with generic fields such as `maxRuns`, `usedRuns`, `currentCaliber`, and `caliberSequence`. Actual equipment names, limits, current positions, and production figures stay outside these public modules.
