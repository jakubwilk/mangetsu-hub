# Plan refaktoru — Hub mini-apek jako klocki + zaplecze w n8n

> Status: [ ] = do zrobienia, [x] = ukończone, [~] = w toku

---

## Context

Dziś mini-apka (Poradniki) jest rozsiana po ~8 miejscach: `src/app/tutorials`, `src/app/api/tutorials/*`,
`src/modules/tutorials`, `src/server/tutorials`, wpis w `common/apps/registry.ts`, `server/apps/hooks.ts`,
`content/tutorials`, `docs/tutorials`, `scripts/*`. Dodanie lub wyłączenie apki wymaga zmian w wielu
warstwach, a granica „platforma vs apka” nie jest jawna (choć `server/rag`, `rateLimit`, `conversations`,
`ai` są już w praktyce generyczne). Treść RAG żyje w gicie i jest seedowana ręcznie.

Cel: **modularny monolit z manifestami** — każda mini-apka to jeden folder, platforma daje usługi
(auth, role, limity, historia, LLM, RAG, silnik czatu), Next.js to cienka warstwa routingu. Wszystko,
co asynchroniczne (import/sync treści, dodawanie źródeł, powiadomienia), orkiestruje **n8n**, wołając
przetestowaną logikę w kodzie przez wewnętrzne API. Ścieżka czatu (auth → limit → guardrail ∥ search →
stream) zostaje w kodzie bez zmian zachowania — zero regresu wydajności i jakości.

Decyzje: planowane apki RAG, apki z własnymi danymi + AI, narzędzia bez AI; routing przez cienkie pliki
re-export; wyłączanie flagą `enabled` w manifeście; źródło prawdy treści RAG = baza; n8n = orkiestracja
zaplecza, logika chunkingu/embeddingów w kodzie.

## Docelowa struktura

```
src/
├── app/                         # tylko routing (cienkie re-eksporty) + strony huba
│   ├── tutorials/page.tsx       # <TutorialsPage header={(slots) => <HubHeader … />} /> (HubHeader zostaje w src/app)
│   ├── api/tutorials/chat/route.ts   # export { chatPost as POST } from 'apps/tutorials/routes'
│   └── api/internal/rag/…       # API dla n8n (sekret, bez sesji)
├── apps/                        # NOWE: mini-apki
│   ├── index.ts                 # rejestr (alias `apps`): APPS, getApp, isAppEnabled, typy AppId/AppRole
│   └── tutorials/
│       ├── manifest.ts          # metadane bezpieczne dla klienta/proxy: id, path, name, tile, roles, enabled
│       ├── routes/              # handlery API (składane z platformy)
│       ├── page/                # TutorialsPage — osobno, żeby barrel handlerów nie wciągał komponentów
│       ├── server/              # config czatu: prompt, synonimy, dodatkowe wyszukiwania (PD), dailyLimit
│       └── components/          # tylko to, co specyficzne: AddSourceModal, DocsPanel…
├── modules/                     # powłoka huba + moduły platformowe UI
│   ├── common/                  # bez rejestru apek (przeniesiony do `apps`)
│   ├── chat/                    # NOWE: generyczny UI czatu RAG (ChatView, Sidebar, store, sendMessage) per appId
│   └── hub/ auth/ admin/ notices/
└── server/                      # platforma serwerowa
    ├── chat/                    # NOWE: silnik czatu RAG (z server/tutorials/chat.ts + route)
    ├── rag/ingest.ts            # NOWE: ingest dokumentu (z scripts/seed.ts), hash-skip
    ├── rag/sources/forum.ts     # przeniesiony scripts/forumToMarkdown.ts
    ├── events.ts                # NOWE: zdarzenia → jeden webhook n8n (zastępuje webhooks.ts + apps/hooks.ts)
    └── internal.ts              # NOWE: requireInternal() — sekret dla wywołań z n8n
```

Reguły importów (egzekwowane przez `no-restricted-imports` w `eslint.config.mjs`, bez nowych zależności):

- `apps/<id>/**` importuje z: siebie, `apps` (rejestr), `common`, `chat`, `server/*` (tylko w `server/`, `routes/` i `page/`). Nigdy z innej apki ani z `hub/auth/admin/notices`.
- `hub/auth/admin/notices` importują z: siebie, `common`, `apps` (rejestr). Nigdy z `apps/<id>/…`.
- Spotkanie wszystkiego: `src/app`.

Dodanie apki = folder `src/apps/<id>` + 1 linia w rejestrze + cienkie pliki w `src/app`.
Wyłączenie = `enabled: false` → znika z kafelków i admina, proxy i `requireAppRole` zwracają 404, dane zostają.

Każdy etap to osobny, działający stan (testy zielone, aplikacja działa). Commity robi człowiek —
po każdym etapie proponowany podział i komunikaty.

---

## Etap 0 — Weryfikacje (read-only)

- [x] Zapis tego planu do `PLAN.md` w root (zastępuje historyczne fazy 1–11, które zostają w gicie); w CLAUDE.md wzmianka „Historyczny harmonogram… fazy 1–11 ukończone” → „Aktualny plan refaktoru: `PLAN.md`”
- [x] Re-eksport z rename (`export { chatPost as POST } from '…'`) w route handlerze — docs Next 16.3.8 pokazują `export { handler as POST }`, wariant `from` potwierdzony buildem w Etapie 1. Route segment config (`runtime`, `maxDuration`…) musi zostać w pliku trasy (dziś brak)
- [x] Prisma 7.10 — wielo-plikowa schema: `schema` w `prisma.config.ts` przyjmuje folder przeszukiwany rekurencyjnie (typy `@prisma/config@7.10.0`; webowe docs opisują już Prisma 8); `output` generatora względem pliku ze schemą
- [x] n8n: brak zapisanych preferencji; 4 workflowy — `User activation` (webhook → Switch USER/EDITOR/GUEST → Discord webhook), `Add source` (placeholder: nic nie zapisuje, gałąź URL zepsuta, szkic ≠ wersja opublikowana), `Error workflow` + `Error notification`. **Brak workflowu usunięcia konta**, choć aplikacja woła `N8N_USER_DELETION_WEBHOOK_PATH`. Credentiale: Discord (webhook), Header Auth, Mistral, SMTP

## Etap 1 — Klocki w kodzie (czysty refaktor, zero zmian zachowania)

- [x] `src/apps/index.ts` — rejestr przeniesiony z `common/apps/registry.ts` (te same helpery: `getAppByPath`, `canAccessApp`, `toAppRoles`, `isValidAppRole`…), wpisy z `apps/<id>/manifest.ts` (`as const satisfies AppManifest`, typy ról nadal wyprowadzane); nowe pole `enabled` + `getEnabledApps()`
- [x] Alias `apps` / `apps/*` w `tsconfig.json`; aktualizacja importów w `admin`, `hub`, `server/auth.ts`, `server/authorize.ts`, `scripts/contentPath.ts`
- [x] `enabled` respektowane w: `server/auth.ts` (`authorized`), `requireAppRole` (404), `getAccessibleApps`, kolumny w `UsersTable` / `UserCard`, PUT ról
- [x] Przeniesienie Poradników do `src/apps/tutorials/` (`modules/tutorials` + `server/tutorials`)
- [x] `src/app/tutorials` i `src/app/api/tutorials/*` → 1-linijkowe re-eksporty
- [x] Asset kafelka → `public/apps/tutorials/bg.png`, ścieżka w manifeście
- [x] Prisma schema → folder `prisma/schema/` (`platform.prisma`, `rag.prisma`, konwencja `apps/<app>.prisma` + tabele `<app>_*` — folder powstanie z pierwszą tabelą apki) — `prisma migrate diff` z bazą dev: pusta migracja
- [x] Reguły ESLint granic modułów (`no-restricted-imports`)
- [x] Test rejestru: unikalne id/ścieżki; dla każdej apki istnieje `src/app/<path>/page.tsx`
- [~] Weryfikacja etapu: test / lint / tsc / build zielone — smoke (w tym `enabled: false` → 404) czeka na użytkownika; propozycja commitów

## Etap 2 — Platforma czatu RAG (generyczna, Poradniki jako konfiguracja)

- [ ] `scripts/ragEval.ts` — strażnik jakości: ~10–15 pytań → oczekiwane tytuły dokumentów w kontekście; zapis wyniku bazowego **przed** zmianami
- [ ] `server/chat/` — z `server/tutorials/chat.ts` + `app/api/tutorials/chat/route.ts`: `createRagChatRoutes(config)` → `{ chatPost, sessionsGet, sessionsDelete, rateLimitGet }`; config: `app`, `roles`, `buildSystemPrompt(query)`, `expandQuery`, `extraSearches(query)` (tu `STAT_ADVANCEMENT_PATTERN` + `PD_CALC_RULES`), `dailyLimit`
- [ ] `server/rateLimit.ts` — limit z configu apki z fallbackiem do `DAILY_REQUEST_LIMIT`
- [ ] `modules/chat/` — ChatView, MessageList, MessageBubble, ChatInput, ThinkingBlock, TypingIndicator, ChatSidebar, DeleteSessionModal, `ChatShell` (z TutorialsShell), `chatStore`, `sendMessage` / `fetch*` sparametryzowane `appId` (endpointy `/api/${appId}/…`, klucze `mangetsu:${appId}:*` — identyczne jak dziś, lokalna historia przetrwa)
- [ ] `apps/tutorials/` zostaje z: manifestem, `server/prompts.ts`, `server/synonyms.ts`, configiem, `AddSourceModal`, `DocsPanel`, stroną
- [ ] Testy przeniesione razem z kodem (`chat.test.ts`, `route.test.ts`, `chatStore.test.ts`, prompts/synonyms), asercje bez zmian merytorycznych
- [ ] Weryfikacja etapu: test / lint / tsc / build + `ragEval` identyczny z bazowym + smoke + propozycja commitów

## Etap 3 — Treść RAG w bazie + API ingest dla n8n

- [ ] Migracja (a) `documents`: `slug`, `markdown`, `sourceUrl?`, `contentHash`, `updatedAt` (nullable) + `@@unique([app, slug])`; `filePath` → nullable (dokument dodany tylko do bazy nie ma pliku)
- [ ] `apps/tutorials/categories.ts` — `TUTORIAL_CATEGORIES` (`kompendium`, `mechanika`, `realia`, `inne`) + etykiety; bezpieczne dla klienta, jedno źródło prawdy dla modalu i walidacji serwerowej
- [ ] `server/rag/normalize.ts` — `normalizeMarkdown(markdown, title)`: BOM, CRLF → LF, 3+ puste linie → 1; dokładnie jeden `# Tytuł` na górze (przy kilku `#` lub `#` nie na górze — wszystkie nagłówki o poziom niżej, max `######`, i dopisany `# Tytuł`); idempotentne dla `content/` (każdy plik ma dziś jeden `#`) + testy
- [ ] `server/rag/slug.ts` — `slugify(title)` w stylu obecnych slugów (małe litery, polskie znaki zostają, spacje → `-`) + test
- [ ] Chunker: akapit dłuższy niż `TARGET_CHARS` cięty po liniach, a gdy to nie wystarcza — po zdaniach (dziś w `content/` żaden akapit nie przekracza 2600 znaków → istniejące chunki bez zmian) + test (długi akapit, tabela)
- [ ] `MAX_SOURCE_CHARS` (~100 000; największy dziś plik: 41 KB) — sprawdzany w modalu, `POST sources` i `PUT documents`
- [ ] `server/rag/ingest.ts` — `ingestDocument({ app, slug, title, category, markdown, sourceUrl })` z logiki `scripts/seed.ts` (embeddingi poza transakcją, transakcja upsert + wymiana chunków); przed hashem `normalizeMarkdown`, walidacja kategorii z listy apki, pomijanie przy niezmienionym hashu; `deleteDocument`, `listDocuments(app)` + testy
- [ ] `server/rag/sources/forum.ts` — konwerter z `scripts/forumToMarkdown.ts` (+ test, `topicHtmlToMarkdown` zwraca też `title`); `parseForumTopicUrl(url)` dla zwykłego linku (`index.php?showtopic=N`, host z `NEXT_PUBLIC_FORUM_URL`, tolerowane `&st=`, `&view=…`, `#entry…`; odrzucane obce hosty, `showforum`, `viewtopic.php`); `canonicalTopicUrl(N)` jako `sourceUrl` i klucz deduplikacji; pobieranie wersji do druku z timeoutem; testy na wszystkich linkach z `docs/tutorials/documents-info.md`; `turndown` z devDependencies → dependencies
- [ ] `server/internal.ts` — `requireInternal(request)`: sekret `INTERNAL_API_SECRET` (porównanie stałoczasowe); `/api/internal/*` wyłączone z `authorized` / matchera w `src/proxy.ts`; wpis w `.env.example`
- [ ] Endpointy: `GET /api/internal/rag/documents?app=`, `PUT /api/internal/rag/documents` (`{ app, slug, title, category, markdown | forumUrl, sourceUrl? }`), `DELETE /api/internal/rag/documents?app=&slug=`; odpowiedź `{ changed, chunks }`, `400` dla nieznanej kategorii / za dużej treści + testy integracyjne
- [ ] Backfill: `scripts/backfillDocuments.ts` — `content/` → `markdown/hash/slug`, `sourceUrl` z `scripts/forumTopics.ts`, **bez ponownego chunkowania**
- [ ] Backup bazy prod w Coolify przed migracją (b)
- [ ] Migracja (b): NOT NULL + drop `filePath`
- [ ] `DocsPanel` generowany z `listDocuments` zamiast `docs/tutorials/documents-info.md` (link do `sourceUrl`, jeśli jest — pliki `.md` go nie mają)
- [ ] `pnpm rag:dump` / `pnpm rag:load` (JSON z markdownem, bez wektorów) do zasilenia lokalnej bazy
- [ ] Usunięcie `content/`, `scripts/seed.ts`, `importForum.ts`, `forumTopics.ts`, `contentPath.ts` — **po osobnym potwierdzeniu**
- [ ] Weryfikacja etapu: brak driftu Prisma, chunki i ich `id` identyczne po backfillu, `PUT` niezmienionego dokumentu → `changed: false` bez embeddingów, `ragEval` identyczny + propozycja commitów

## Etap 4 — n8n jako zaplecze

Zgodnie z zasadami CLAUDE.md (SDK reference → best practices → nodes → walidacja → `test_workflow`
z pełnym pin data; aktywacja tylko po potwierdzeniu).

Podział przy dodawaniu źródeł: **kod** waliduje link / plik, konwertuje i normalizuje treść już przy
zgłoszeniu (EDITOR od razu widzi błąd, ROOT zatwierdza dokładnie to, co trafi do bazy), liczy chunki
i embeddingi; **n8n** tylko prosi ROOT o akceptację, woła `PUT documents` i powiadamia.

- [ ] `server/events.ts` — `emitEvent(type, payload)` → `N8N_EVENTS_WEBHOOK_URL` (POST, `X-Webhook-Authorization`), wynik `ok` raportowany w adminie; zdarzenia `user.role_changed` (rola `null` → `GUEST` jak dziś), `user.deleted`, `rag.source_submitted` (`{ app, slug, title, category, markdown, sourceUrl?, mode: 'create' | 'update', chars, submittedBy: { name, discordId } }`)
- [ ] `POST /api/tutorials/sources` (EDITOR + `verifyOrigin`) — body `{ type: 'FORUM', url, category, title? }` | `{ type: 'MARKDOWN', markdown, fileName?, category, title? }`; walidacja → konwersja forum / `normalizeMarkdown` → tytuł (pole z modalu > tytuł wątku / pierwszy `#` / nazwa pliku) → slug + `mode` (forum: dedup po `sourceUrl` z zachowaniem sluga; `.md`: istniejący `(app, slug)` = aktualizacja) → `emitEvent` → „Zgłoszono do akceptacji”; `422` gdy wątek nierozpoznany, `400` dla walidacji + testy integracyjne (rola, origin, kategoria, limit, błędny link, payload zdarzenia)
- [ ] Przygotowanie n8n (użytkownik): credential `httpHeaderAuth` z `INTERNAL_API_SECRET`, prywatny kanał Discord tylko dla ROOT
- [ ] Workflow **Hub events** — webhook → Switch po `type` → istniejąca logika aktywacji (Discord); `user.deleted` do zbudowania od zera (na instancji nie ma workflowu usunięcia konta); stare ścieżki działają do przełączenia
- [ ] Przełączenie aplikacji na `emitEvent`; usunięcie `server/webhooks.ts`, `server/apps/hooks.ts` (po potwierdzeniu działania)
- [ ] Workflow **RAG forum sync** — cron → `GET documents` → `PUT` z `forumUrl` dla dokumentów z forum → zebrane `changed` → wiadomość na Discord
- [ ] Workflow **RAG add source** (sub-workflow wołany z Hub events, który odpowiada **przed** oczekiwaniem — inaczej request z aplikacji wisi) — Discord _Send and wait_ (approval, Zatwierdź / Odrzuć, limit ~7 dni): tytuł, kategoria, nowy / aktualizacja, link do źródła, liczba znaków, autor, początek treści (limit wiadomości Discorda 2000 znaków) → zatwierdzono: `PUT documents` z gotowym markdownem → „Dodano X (n fragmentów)” z `<@discordId>` autora; odrzucono / wygasło → komunikat do autora; błąd HTTP → istniejący Error workflow. Do sprawdzenia w teście: czy _Send and wait_ działa z obecnym credentialem Discord typu webhook — jeśli nie, potrzebny credential Discord Bot
- [ ] `AddSourceModal`: zakładki „Link do forum” (placeholder `…/index.php?showtopic=…` z `NEXT_PUBLIC_FORUM_URL` zamiast dzisiejszego `viewtopic.php`) / „Plik Markdown” (shadcn `Button` „Wybierz plik” + ukryty input `accept=".md,.markdown"` → `file.text()` → podgląd i poprawki w `MarkdownEditorField`, remount przez `key`, bo Crepe czyta tylko `defaultValue`); opcjonalne pole Tytuł z podpowiedzią; wymagany `Select` kategorii; limit znaków; `method` / `URL` / `CONTENT` → `type` / `FORUM` / `MARKDOWN`; `ENABLED = true`
- [ ] Każdy workflow: `validate_workflow` + `test_workflow` z pełnym pin data + przegląd ścieżek błędów (dla add source: zatwierdzono, odrzucono, wygasło, błąd `PUT`); aktywacja po zgodzie
- [ ] Sprzątanie po przełączeniu: archiwizacja starego workflow `Add source` (`job/source`), usunięcie `SOURCES_WEBHOOK_URL` z `.env.example` — **po potwierdzeniu**
- [ ] Aktualizacja CLAUDE.md i README (struktura `apps`, endpointy wewnętrzne z sekretem, treść w bazie, zdarzenia n8n)

## Poza zakresem (kolejny krok)

- [ ] UI zarządzania dokumentami dla EDITOR (lista + edycja w Milkdown → ingest)

---

## Ryzyka

- Etapy 1–2 dotykają prawie wszystkich importów — robione mechanicznie, krokami, z testami po każdym
- Backfill i drop `filePath` — backup bazy prod przed migracją (b)
- Live n8n — nowe workflowy obok starych; przełączenie i aktywacja po testach i zgodzie
- Konwerter forum zależy od szablonu wersji do druku jcink — po jego zmianie rzuca błąd (celowo: zgłoszenie odrzucone od razu, sync zgłasza błąd na Discordzie)
- Przycisk „Zatwierdź” z Discorda działa dla każdego, kto widzi kanał — kanał tylko dla ROOT
- Dokumentacja (CLAUDE.md, README) musi nadążyć za nową strukturą

## Weryfikacja (każdy etap)

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`
- `scripts/ragEval.ts` — identyczny zestaw dokumentów w kontekście przed/po Etapach 2 i 3
- Smoke (dev): logowanie Discord, kafelki, czat ze streamem i thinkingiem, limit, usuwanie sesji, `/admin` zmiana roli; `enabled: false` → apka znika, `/tutorials` i `/api/tutorials/*` → 404
