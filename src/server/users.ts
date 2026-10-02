import { db } from 'server/db'

export const findUserWithDiscordId = async (id: string) => {
  const user = await db.user.findUnique({
    where: { id },
    include: { accounts: { where: { provider: 'discord' }, select: { providerAccountId: true } } },
  })
  if (!user) return null

  const { accounts, ...rest } = user
  return { ...rest, discordId: accounts[0]?.providerAccountId ?? null }
}
