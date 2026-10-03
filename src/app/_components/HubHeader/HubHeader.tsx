import { UserMenu } from 'auth'
import { AppHeader } from 'common'
import { type AppId, getApp, ROOT_LABEL } from 'common/apps'
import { Button } from 'common/components/ui'
import { ExternalLink } from 'lucide-react'
import { NoticesPopover } from 'notices'
import { getSession } from 'server/auth'
import { loadNotices } from 'server/notices'

import packageJson from '../../../../package.json'

const FORUM_URL = process.env.NEXT_PUBLIC_FORUM_URL || undefined

interface HubHeaderProps {
  appId?: AppId
  title?: string
  actions?: React.ReactNode
  menuItems?: React.ReactNode
}

// Shared top bar of the hub: composes domain modules, which is why it lives in src/app.
const HubHeader = async ({ appId, title, actions, menuItems }: HubHeaderProps) => {
  const [notices, session] = await Promise.all([loadNotices(), getSession()])
  const app = appId ? getApp(appId) : undefined

  const roleLabel = app?.roles.find((r) => r.id === session?.user.apps[app.id])?.label
  const subtitle = session?.user.isRoot ? ROOT_LABEL : roleLabel

  return (
    <AppHeader title={title ?? app?.name}>
      {actions}
      <NoticesPopover notices={notices} version={packageJson.version} />
      {FORUM_URL && (
        <Button asChild variant="ghost" size="icon-lg" className="hidden md:inline-flex">
          <a
            href={FORUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Przejdź na forum"
            title="Przejdź na forum"
          >
            <ExternalLink className="size-5" />
          </a>
        </Button>
      )}
      {session && (
        <UserMenu
          name={session.user.name ?? null}
          image={session.user.image ?? null}
          subtitle={subtitle}
          isRoot={session.user.isRoot}
          forumUrl={FORUM_URL}
        >
          {menuItems}
        </UserMenu>
      )}
    </AppHeader>
  )
}

export default HubHeader
