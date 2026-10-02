import { type AdminUser, UsersTable } from 'admin'
import { toAppRoles } from 'common/apps'
import { notFound } from 'next/navigation'
import { getSession } from 'server/auth'
import { db } from 'server/db'

import { HubHeader } from '../_components/HubHeader'

const AdminPage = async () => {
  const session = await getSession()
  if (!session?.user.isRoot) notFound()

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { appRoles: { select: { app: true, role: true } } },
  })
  const adminUsers: AdminUser[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    isRoot: u.isRoot,
    apps: toAppRoles(u.appRoles),
    createdAt: u.createdAt.toISOString(),
  }))

  return (
    <div className="flex h-full flex-col">
      <HubHeader title="Panel administracyjny" />
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4 md:p-8">
        <div>
          <h1 className="text-xl font-bold text-white">Użytkownicy</h1>
          <p className="text-muted-foreground text-sm">
            Dostęp i role nadawane są osobno w każdej aplikacji. Rola administratora nadawana jest
            wyłącznie bezpośrednio w bazie danych.
          </p>
        </div>
        <UsersTable users={adminUsers} />
      </main>
    </div>
  )
}

export default AdminPage
