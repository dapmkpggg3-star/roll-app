# Roll history migration

The historical roll workbook remains the source for the paired stand sheets. Do not rebuild these sheets from the current-state `Roles` table because that would drop vendor, size, material, hardness, usage tonnage, formulas, and past rolling cycles.

## Safety rules

- Keep `Roles`, master sheets, and the existing application views unchanged.
- Convert the source workbook to a private native Google Sheet before migration.
- Store the source spreadsheet ID in Apps Script properties, not in this repository.
- Copy only the eight paired stand sheets.
- Never overwrite an existing paired stand sheet automatically.

## One-time migration

1. Convert the approved source workbook to a native Google Sheet.
2. In Apps Script, run:

```js
setRollHistorySourceSpreadsheetId('SOURCE_SPREADSHEET_ID');
```

3. Run `previewRollHistoryMigration()` and confirm:

- `missingSheets` is empty.
- `existingDestinationSheets` is empty.
- `readyToImport` is `true`.

4. Run `importRollHistorySheetsFromSource()`.
   This also runs `initializeRollHistoryStatusSync()` and adds a linked status band above each recognized roll block.
5. Run `installRolesSheetEditTrigger()` once and confirm that the `handleRolesSheetEdit` installable edit trigger exists.
6. Verify the eight paired stand tabs, formulas, merged cells, colors, usage-tonnage summaries, and status dropdowns.
7. Change one non-online status from a paired stand sheet and confirm the same role changes in `Roles` and the application.

The migration copies whole sheets so the original history layout and formulas are retained. `Roles` remains the shared application data source. Status edits from either the application or a paired stand sheet use `updatedAt` conflict resolution; the newest edit wins and both history logs are retained. Assigning a new `オンライン` roll from a paired stand sheet also retires the old online roll in the same locked update.

If the sheets already exist, running `initializeRollHistoryStatusSync()` again is safe: it only reconfigures bands owned by the status integration and skips rows containing unrelated data.
