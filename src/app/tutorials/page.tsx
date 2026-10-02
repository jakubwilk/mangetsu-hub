import { readFile } from 'fs/promises'
import path from 'path'
import { getSession } from 'server/auth'
import { AddSourceModal, ChatSidebar, ChatView, DocsPanel, TutorialsShell } from 'tutorials'

import { HubHeader } from '../_components/HubHeader'

const TutorialsPage = async () => {
  const [session, docsContent] = await Promise.all([
    getSession(),
    readFile(path.join(process.cwd(), 'docs', 'tutorials', 'documents-info.md'), 'utf-8'),
  ])
  const canEdit = session?.user.isRoot || session?.user.apps.tutorials === 'EDITOR'

  return (
    <div className="flex h-full flex-col">
      <HubHeader
        appId="tutorials"
        actions={canEdit && <AddSourceModal />}
        menuItems={canEdit && <AddSourceModal asMenuItem />}
      />
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
