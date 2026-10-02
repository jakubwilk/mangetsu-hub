'use server'

import { signIn } from 'server/auth'

export const signInWithDiscord = async (): Promise<void> => {
  await signIn('discord', { redirectTo: '/' })
}
