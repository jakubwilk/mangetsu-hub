import { readdirSync } from 'node:fs'

import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettierConfig from 'eslint-config-prettier'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import unusedImports from 'eslint-plugin-unused-imports'

// Module boundaries (see CLAUDE.md, "Frontend — kanon"): modules and apps meet only in src/app.
const HUB_MODULES = ['hub', 'auth', 'admin', 'notices']
const APP_IDS = readdirSync('src/apps', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

// Anchored regexes: gitignore-style groups would also match `server/auth` or `./auth`.
const aliasOf = (names) => `^(${names.join('|')})(/.*)?$`

const restrictImports = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
})

const NO_HUB_MODULES = {
  regex: aliasOf(HUB_MODULES),
  message: 'Apka nie importuje modułów huba — spotykają się w src/app.',
}
const NO_APP_INTERNALS = {
  regex: '^apps/',
  message: 'Z apki wolno importować tylko rejestr `apps` — apki spotykają się w src/app.',
}
const NO_SERVER = {
  regex: '^server/',
  message: 'Kod serwerowy apki żyje w server/, routes/ i page/.',
}

const boundaries = [
  ...APP_IDS.flatMap((id) => {
    const noOtherApps = {
      regex: `^apps/(?!${id}(/|$))`,
      message: 'Apka nie importuje innych apek.',
    }
    // The later block wins for server-side folders, so only they may reach `server/*`.
    return [
      restrictImports([`src/apps/${id}/**`], [NO_HUB_MODULES, noOtherApps, NO_SERVER]),
      restrictImports([`src/apps/${id}/{server,routes,page}/**`], [NO_HUB_MODULES, noOtherApps]),
    ]
  }),
  ...HUB_MODULES.map((name) =>
    restrictImports(
      [`src/modules/${name}/**`],
      [
        {
          regex: aliasOf(HUB_MODULES.filter((other) => other !== name)),
          message: 'Moduł importuje wyłącznie z `common` albo z samego siebie.',
        },
        NO_APP_INTERNALS,
      ],
    ),
  ),
  restrictImports(
    ['src/modules/common/**'],
    [
      {
        regex: aliasOf([...HUB_MODULES, 'apps']),
        message: '`common` nie zależy od żadnego innego modułu.',
      },
    ],
  ),
  restrictImports(
    ['src/server/**'],
    [
      {
        regex: aliasOf(HUB_MODULES),
        allowTypeImports: true,
        message: 'Platforma serwerowa nie importuje kodu modułów UI (typy są dozwolone).',
      },
      {
        regex: '^apps/',
        message: 'Platforma serwerowa nie zna apek — tylko rejestr `apps`.',
      },
    ],
  ),
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  ...boundaries,
  prettierConfig,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
