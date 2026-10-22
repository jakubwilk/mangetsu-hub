import { requireAppRole } from 'server/authorize'

export const TUTORIALS_APP = 'tutorials'

export const requireTutorialsUser = () => requireAppRole(TUTORIALS_APP, ['USER', 'EDITOR'])

export const requireTutorialsEditor = () => requireAppRole(TUTORIALS_APP, ['EDITOR'])
