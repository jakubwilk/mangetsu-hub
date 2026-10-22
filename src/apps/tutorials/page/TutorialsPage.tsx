import { readFile } from 'fs/promises'
import path from 'path'
import type { ReactNode } from 'react'
import { getSession } from 'server/auth'

import { AddSourceModal, ChatSidebar, ChatView, DocsPanel, TutorialsShell } from '../components'

interface HeaderSlots {
  actions: ReactNode
  menuItems: ReactNode
}

interface TutorialsPageProps {
  // The hub header composes other modules, so src/app renders it and the app only fills its slots.
  header: (slots: HeaderSlots) => ReactNode
}

const TutorialsPage = async ({ header }: TutorialsPageProps) => {
  const [session, docsContent] = await Promise.all([
    getSession(),
    readFile(path.join(process.cwd(), 'docs', 'tutorials', 'documents-info.md'), 'utf-8'),
  ])
  const canEdit = session?.user.isRoot || session?.user.apps.tutorials === 'EDITOR'

  return (
    <div className="flex h-full flex-col">
      {header({
        actions: canEdit && <AddSourceModal />,
        menuItems: canEdit && <AddSourceModal asMenuItem />,
      })}
      <TutorialsShell
        sidebar={<ChatSidebar />}
        sidebarDrawer={<ChatSidebar fluid />}
        docsPanel={<DocsPanel content={docsContent} />}
        docsPanelDrawer={<DocsPanel content={docsContent} fluid />}
      >
        <ChatView />
      </TutorialsShell>
    </div>
  )
}

export default TutorialsPage
