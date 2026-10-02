import { AuthErrorNotice, DiscordSignInButton } from 'auth'
import { Logo } from 'common'
import { getAccessibleApps } from 'common/apps'
import { AppTiles } from 'hub'
import { redirect } from 'next/navigation'
import { getSession } from 'server/auth'

import { HubHeader } from './_components/HubHeader'

interface HomePageProps {
  searchParams: Promise<{ error?: string }>
}

const HomePage = async ({ searchParams }: HomePageProps) => {
  const session = await getSession()

  if (!session) {
    const { error } = await searchParams

    return (
      <div className="flex h-full items-center justify-center p-4">
        {error && <AuthErrorNotice error={error} />}
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo />
          <p className="text-muted-foreground max-w-80 text-sm">
            Zaloguj się przez Discord, aby korzystać z aplikacji Mangetsu.
          </p>
          <DiscordSignInButton />
        </div>
      </div>
    )
  }

  const apps = getAccessibleApps(session.user)
  if (apps.length === 0) redirect('/pending')

  return (
    <div className="flex h-full flex-col">
      <HubHeader />
      <main className="min-h-0 flex-1">
        <AppTiles apps={apps} />
      </main>
    </div>
  )
}

export default HomePage
