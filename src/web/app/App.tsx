import { ExportMenuContent } from '../components/export.tsx'
import { Sprite } from '../components/icons.tsx'
import { EmptyState } from '../components/quick.tsx'
import { Rail, Statusbar, TopBar } from '../components/shell.tsx'
import { StreamView } from '../components/stream-view.tsx'
import { StreamTabs } from '../components/tabs.tsx'
import { WorkspaceSheets } from '../components/workspace-sheets.tsx'
import { useWorkspace } from '../components/workspace-state.ts'
import { BUFFER_CAP } from './store.ts'

export function App() {
  const workspace = useWorkspace()
  return (
    <>
      <Sprite />
      <div className="shell">
        <Rail {...workspace.rail} />
        <div className="main">
          <TopBar
            {...workspace.topBar}
            onExport={
              <ExportMenuContent
                count={workspace.exportMenu.count}
                cap={BUFFER_CAP}
                onTxt={workspace.exportMenu.onTxt}
                onPdf={workspace.exportMenu.onPdf}
              />
            }
          />
          <StreamTabs {...workspace.tabs} />
          <div className="workspace">
            {workspace.zeroStreams ? (
              <EmptyState {...workspace.empty} />
            ) : (
              <StreamView {...workspace.stream} />
            )}
          </div>
          <Statusbar {...workspace.statusbar} />
        </div>
      </div>

      <WorkspaceSheets sheets={workspace.sheets} />
    </>
  )
}
