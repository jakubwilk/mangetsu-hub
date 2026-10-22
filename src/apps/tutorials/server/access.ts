import { requireAppRole } from 'server/authorize'

import { tutorialsManifest } from '../manifest'

export const TUTORIALS_APP = tutorialsManifest.id

export const requireTutorialsEditor = () => requireAppRole(TUTORIALS_APP, ['EDITOR'])
