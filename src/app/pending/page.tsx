import { SignOutButton } from 'auth'
import { Logo } from 'common'
import { getAccessibleApps } from 'common/apps'
import { redirect } from 'next/navigation'
import { getSession } from 'server/auth'

const PendingPage = async () => {
  const session = await getSession()
  if (!session) redirect('/')
  if (getAccessibleApps(session.user).length > 0) redirect('/')

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex max-w-105 flex-col items-center gap-4 text-center">
        <Logo />
        <p className="text-xl font-medium text-white">Konto oczekuje na aktywację</p>
        <p className="text-muted-foreground text-sm">
          Twoje konto zostało utworzone, ale nie ma jeszcze dostępu do żadnej aplikacji. Poczekaj,
          aż administrator je aktywuje.
        </p>
        <SignOutButton variant="destructive" className="mt-3" />
      </div>
    </div>
  )
}

export default PendingPage
