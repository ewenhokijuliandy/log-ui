import { CompareView } from '../components/compare.tsx'
import { ExportMenuContent } from '../components/export.tsx'
import { GraphqlView } from '../components/graphql.tsx'
import { Sprite } from '../components/icons.tsx'
import { MergeView } from '../components/merge-view.tsx'
import { PrettyView } from '../components/prettify.tsx'
import { EmptyState } from '../components/quick.tsx'
import { SavedView } from '../components/saved-view.tsx'
import { Rail, Statusbar, TopBar } from '../components/shell.tsx'
import { StreamView } from '../components/stream-view.tsx'
import { StreamTabs } from '../components/tabs.tsx'
import { WorkspaceSheets } from '../components/workspace-sheets.tsx'
import { useWorkspace } from '../components/workspace-state.ts'

export function App() {
  const workspace = useWorkspace()
  const view = workspace.rail.workspaceView
  return (
    <>
      <Sprite />
      <div className="shell">
        <Rail {...workspace.rail} />
        <div className="main">
          <TopBar
            {...workspace.topBar}
            exportDisabled={view === 'compare' || view === 'prettify'}
            onExport={
              <ExportMenuContent
                count={workspace.exportMenu.count}
                cap={workspace.bufferCap}
                onTxt={workspace.exportMenu.onTxt}
                onPdf={workspace.exportMenu.onPdf}
              />
            }
          />
          <StreamTabs {...workspace.tabs} />
          <div className="workspace">
            <div hidden={view !== 'stream'} className="view-slot">
              {workspace.zeroStreams ? (
                <EmptyState {...workspace.empty} />
              ) : (
                <StreamView {...workspace.stream} />
              )}
            </div>
            <div hidden={view !== 'compare'} className="view-slot">
              <CompareView />
            </div>
            <div hidden={view !== 'prettify'} className="view-slot">
              <PrettyView />
            </div>
            <div hidden={view !== 'graphql'} className="view-slot">
              <GraphqlView />
            </div>
            <div hidden={view !== 'saved'} className="view-slot">
              <SavedView
                active={view === 'saved'}
                onOpenStream={() => workspace.rail.onStreams()}
              />
            </div>
            <div hidden={view !== 'merge'} className="view-slot">
              <MergeView {...workspace.merge} />
            </div>
          </div>
          <Statusbar {...workspace.statusbar} />
        </div>
      </div>

      <WorkspaceSheets sheets={workspace.sheets} />
    </>
  )
}
