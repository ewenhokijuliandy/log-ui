import { CompareDialog } from './compare.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { DetailSheet } from './detail-sheet.tsx'
import { HelpSheet } from './help-sheet.tsx'
import { ManualDialog } from './manual-dialog.tsx'
import { ParseRulesDialog } from './parse-rules.tsx'
import { PrettifyDialog } from './prettify.tsx'
import { PrintSheet } from './print-sheet.tsx'
import { QuickStart } from './quick.tsx'
import { SettingsSheet } from './settings-sheet.tsx'
import type { SheetsModel } from './sheets-model.ts'

export type { SheetsModel }

export function WorkspaceSheets({ sheets }: { sheets: SheetsModel }) {
  return (
    <>
      {sheets.detail === null ? null : (
        <DetailSheet
          record={sheets.detail.record}
          zone={sheets.detail.zone}
          onClose={sheets.detail.onClose}
        />
      )}

      <QuickStart {...sheets.quick} />

      <ConfirmDialog {...sheets.clear} />

      <ConfirmDialog {...sheets.close} />

      <SettingsSheet {...sheets.settings} />

      <HelpSheet {...sheets.help} />

      <ManualDialog {...sheets.manual} />

      <ParseRulesDialog {...sheets.rules} />

      <CompareDialog {...sheets.compare} />

      <PrettifyDialog {...sheets.prettify} />

      <PrintSheet {...sheets.print} />
    </>
  )
}
