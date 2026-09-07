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
- Return warnings instead of silently accepting exceptions.

## Private configuration responsibilities

- Actual equipment identifiers and groups.
- Shift times and staffing rules.
- Production amounts and operating calendar.
- Work duration, workload, and capacity values.
- Caliber limits and roll replacement thresholds.
- Prices, vendors, roll identifiers, and maintenance history.

The first application phase should present recommendations with reasons and require a human to approve them. It should not automatically publish or confirm a production plan.
