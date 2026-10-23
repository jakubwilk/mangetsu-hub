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
    ├── chat/                    # silnik czatu RAG: createRagChatRoutes(config) — context, stream, routes
    ├── rag/ingest.ts            # ingest dokumentu (z scripts/seed.ts), hash-skip; rag/routes.ts — API dla n8n
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

- [x] `scripts/ragEval.ts` (`pnpm rag:eval`, `--save`) — strażnik jakości: ~14 pytań (w tym koszt PD, synonim, pytanie uzupełniające) → oczekiwane tytuły dokumentów + uporządkowane `id` chunków; wynik bazowy w `scripts/.rag-eval-baseline.json` (gitignore), zapisany **przed** zmianami przez wydzielone `retrieveChunks`
- [x] `server/chat/` — z `apps/tutorials/server/chat.ts` + `routes/*`: `createRagChatRoutes(config)` → `{ chatPost, sessionsGet, sessionsDelete, rateLimitGet }`; `RagChatConfig`: `app`, `roles`, `buildSystemPrompt(query)`, `buildUserMessage`, `expandQuery?`, `extraSearches?(query)`, `dailyLimit?`
- [x] `server/rateLimit.ts` — limit z configu apki z fallbackiem do `DAILY_REQUEST_LIMIT`
- [x] `apps/tutorials/server/chatConfig.ts` — `tutorialsChat` (`STAT_ADVANCEMENT_PATTERN` → zasady PD w prompcie + dodatkowe wyszukiwanie kosztów); `routes/index.ts` składa handlery z `createRagChatRoutes`
- [x] `modules/chat/` (alias `chat`) — ChatView, MessageList, MessageBubble, ChatInput, ThinkingBlock, TypingIndicator, ChatSidebar, DeleteSessionModal, MobileNavBar, `ChatShell` (z TutorialsShell), `getChatStore(appId)`, `sendMessage` / `fetch*` sparametryzowane `appId` (endpointy `/api/${appId}/…`, klucze `mangetsu:${appId}:*` — identyczne jak dziś, lokalna historia przetrwa); teksty apki (`emptyTitle`, `loadingMessages`) z propsów
- [x] `apps/tutorials/` zostaje z: manifestem, `server/prompts.ts`, `server/synonyms.ts`, configiem, źródłami (`AddSourceModal`, edytor, `submitSource`), `DocsPanel`, stroną
- [x] ESLint: `modules/chat` bez modułów huba, wnętrza apek i `server/*`; hub, `common` i `src/server` bez `chat`
- [x] Testy przeniesione razem z kodem (`chat.test.ts`, testy tras, `chatStore.test.ts`, `sendMessage.test.ts`), asercje bez zmian merytorycznych
- [~] Weryfikacja etapu: test / lint / tsc / build zielone, `ragEval` 14/14 identyczny z bazowym (embeddingi deterministyczne — dwa przebiegi bazowe zgodne), endpointy bez sesji → 401 — smoke z zalogowanym kontem czeka na użytkownika; propozycja commitów

## Etap 3 — Treść RAG w bazie + API ingest dla n8n

Podzielony na **3a** (kod + backfill, migracja tylko dodająca kolumny) i **3b** (NOT NULL, sprzątanie) —
migracja (b) wdrożona przed backfillem na prod wywaliłaby deploy. Skrypty i migracje na prod odpalane
lokalnie z `DATABASE_URL=<prod>` w wierszu poleceń (wygrywa z `.env.local`).

### 3a

- [x] Migracja (a) `20261022120000_rag_documents_content`: `slug`, `markdown`, `contentHash`, `sourceUrl` (nullable), `updatedAt` od razu NOT NULL (`@default(now()) @updatedAt`), `@@unique([app, slug])`, `filePath` → nullable
- [x] Kategorie w manifeście (`rag.categories`: `realia`, `kompendium`, `mechanika`, `inne` + etykiety) zamiast `apps/tutorials/categories.ts` — serwer (`server/rag`) może czytać rejestr `apps`, ale nie wnętrze apki; `getRagCategories`, `isRagCategory` i `MAX_SOURCE_CHARS` (100 000) w rejestrze, bezpieczne dla klienta (modal w Etapie 4)
- [x] `server/rag/normalize.ts` — `normalizeMarkdown(markdown, title)` (BOM, CRLF, 3+ puste linie, jeden `# Tytuł` na górze) + testy, w tym idempotencja na każdym pliku `content/`
- [x] `server/rag/slug.ts` — `slugify` / `isValidSlug` + testy
- [x] Chunker: akapit > `TARGET_CHARS` cięty po liniach, potem po zdaniach, na kawałki ≤ `TARGET − OVERLAP`; kawałki tabeli powtarzają nagłówek + testy (istniejące chunki bez zmian — sprawdzone backfillem)
- [x] `server/rag/ingest.ts` — `ingestDocument` (walidacja → normalizacja → sha256 → przy niezmienionym hashu tylko metadane, bez embeddingów; inaczej embeddingi poza transakcją + upsert po `(app, slug)` i wymiana chunków), `deleteDocument`, `listDocuments`; `IngestError` ze statusem HTTP + testy
- [x] `server/rag/sources/forum.ts` (`git mv` z `scripts/forumToMarkdown.ts`) — `topicHtmlToMarkdown` zwraca `title`; `parseForumTopicUrl`, `canonicalTopicUrl`, `fetchForumTopic` (timeout 15 s; 400 / 422 / 502) + testy na wszystkich 20 wątkach bazy wiedzy; `turndown` w dependencies
- [x] `server/internal.ts` — `requireInternal` (`Authorization: Bearer`, `timingSafeEqual` na sha256, bez sekretu → 503); `api/internal/` poza matcherem `src/proxy.ts`; `INTERNAL_API_SECRET` w `.env.example`
- [x] `server/rag/routes.ts` + `src/app/api/internal/rag/documents/route.ts` — `GET ?app=`, `PUT` (`markdown` + `sourceUrl?` albo `forumUrl` + `title?`), `DELETE ?app=&slug=`; `{ changed, chunks }`, błędy 400/401/404/422/502/503 + testy integracyjne
- [x] `scripts/backfillDocuments.ts` (`pnpm rag:backfill [--dry-run]`) — tytuł z nagłówka `#` (polskie znaki), slug z nazwy pliku, `sourceUrl` z `forumTopics.ts`; zapis tylko gdy `chunkText(markdown)` = chunki w bazie; idempotentny
- [x] `DocsPanel` z `listDocuments` (grupy wg kategorii z manifestu, link do `sourceUrl`); `docs/tutorials/documents-info.md` usunięty
- [x] `pnpm rag:dump <plik>` / `pnpm rag:load <plik>` (JSON z markdownem, bez wektorów)
- [x] `ragEval`: oczekiwane tytuły z polskimi znakami. Wynik bazowy z Etapu 2 był nieaktualny już przed 3a (baza lokalna przeseedowana — żadne z jego id chunków nie istniało); nowy zapisany po backfillu, stary w kopii
- [x] Weryfikacja 3a: test / lint / tsc / build zielone; lokalnie brak driftu, backfill 20/20, id + treść + wektory chunków identyczne jak przed etapem, drugi przebieg bez zmian; API na `pnpm start` (401 bez sekretu, `GET` 20 dokumentów, `PUT` niezmienionego i z `forumUrl` → `changed: false`, zła kategoria → 400); `rag:dump` → `rag:load` bez zmian; propozycja commitów
- [x] Wdrożenie 3a na prod (potwierdzone przez użytkownika): deploy → `DATABASE_URL=<prod> pnpm db:migrate:deploy` → `DATABASE_URL=<prod> pnpm rag:backfill --dry-run` → bez `--dry-run` → `INTERNAL_API_SECRET` w Coolify

### 3b (po backfillu na prod)

- [ ] Backup bazy prod w Coolify przed migracją (b) — użytkownik, przed wdrożeniem 3b
- [x] Migracja (b) `20261023120000_rag_documents_required`: NOT NULL na `slug`, `markdown`, `contentHash` + drop `filePath` w jednym `ALTER` (przy dokumencie bez backfillu migracja pada, zanim cokolwiek usunie); `rag:dump` bez filtrów na `null`
- [x] Usunięcie `content/`, `scripts/seed.ts`, `importForum.ts`, `forumTopics.ts`, `contentPath.ts`, `backfillDocuments.ts` (+ skrypty `db:seed`, `content:import`, `rag:backfill`, test idempotencji na `content/` zastąpiony testem na przekonwertowanym wątku) — potwierdzone przez użytkownika
- [x] Weryfikacja 3b: lokalnie brak driftu, test / lint / tsc / build zielone, `ragEval` 14/14; na prod (#31) `db:migrate:deploy` → „No pending migrations” (12/12, migracja (b) już zastosowana)

## Etap 4 — n8n jako zaplecze

Zgodnie z zasadami CLAUDE.md (SDK reference → best practices → nodes → walidacja → `test_workflow`
z pełnym pin data; aktywacja tylko po potwierdzeniu).

Podział przy dodawaniu źródeł: **kod** waliduje link / plik, konwertuje i normalizuje treść już przy
zgłoszeniu (EDITOR od razu widzi błąd, ROOT zatwierdza dokładnie to, co trafi do bazy), liczy chunki
i embeddingi; **n8n** tylko prosi ROOT o akceptację, woła `PUT documents` i powiadamia.

Decyzje (2026-10-22): akceptacja przez **Discord Bot** (credential `discordBotApi`, kanał tylko dla
ROOT); `user.deleted` z `notify` → wiadomość na kanale aktywacji (credential webhook); zdarzenie
`user.role_changed` wysyłane dla każdej apki (n8n filtruje po `app`).

### 4a — kod

- [x] `server/events.ts` — `emitEvent({ type, data })` → `POST N8N_EVENTS_WEBHOOK_URL` (`{ type, data, occurredAt }`, `X-Webhook-Authorization`); `user.role_changed` (rola `null` → `GUEST`), `user.deleted`, `rag.source_submitted` + testy
- [x] `server/rag/submission.ts` — `prepareSourceSubmission(app, body, submittedBy)`: kategoria z manifestu, konwersja forum / plik `.md`, tytuł (pole > tytuł wątku albo zapisany tytuł przy aktualizacji / pierwszy `#` / nazwa pliku), slug + `mode` (wątek: dedup po `sourceUrl`, kolizja sluga → `-<topicId>`; plik: slug z nazwy pliku, istniejący = aktualizacja, dokument z forum → 409), `normalizeMarkdown`, limity; `MAX_TITLE_LENGTH` w rejestrze `apps` + testy
- [x] `POST /api/tutorials/sources` (EDITOR + `verifyOrigin`) → `prepareSourceSubmission` → `emitEvent` → „… czeka na akceptację”; `IngestError` ze statusem, n8n niedostępne → 502 + testy integracyjne
- [x] `AddSourceModal`: zakładki „Link do forum” / „Plik Markdown” (przycisk + ukryty input, podgląd w edytorze z remountem przez `key`), `Select` kategorii, opcjonalny tytuł, licznik znaków; flaga `ENABLED` usunięta
- [x] Admin (zmiana roli, usunięcie konta) na `emitEvent`; `server/webhooks.ts`, `server/apps/hooks.ts`, `apps/tutorials/server/sources.ts` usunięte; stare workflowy n8n aktywne do potwierdzenia
- [x] `.env.example` (`N8N_EVENTS_WEBHOOK_URL`; bez `N8N_WEBHOOK_BASE_URL`, `*_WEBHOOK_PATH`, `SOURCES_WEBHOOK_URL`), CLAUDE.md, README
- [~] Weryfikacja 4a: test / lint / tsc / build zielone — smoke modalu czeka na użytkownika; propozycja commitów

### 4b — n8n

- [x] Przygotowanie (użytkownik): aplikacja-bot Discord na serwerze + credential `discordBotApi` „Mangetsu-HUB: Discord Bot account”, prywatny kanał ROOT; credential `httpBearerAuth` „Mangetsu-HUB: Internal API” (token = `INTERNAL_API_SECRET` prod); credentiale i kanał przypięte w węzłach (RAG add source, RAG forum sync)
- [x] Workflow **Hub events** (`l3v9e6RStjWOd7u6`, webhook `mangetsu-hub/events`) — webhook (header auth) → Switch po `type`: `user.role_changed` (logika z `User activation`), `user.deleted` (`notify` → Discord), `rag.source_submitted` (odpowiedź 202 **przed** wywołaniem sub-workflowu), nieznany → 400
- [x] Workflow **RAG add source** (`6tuC3poWgKUyXWDQ`, sub-workflow) — Discord _Send and wait_ (bot, approval Zatwierdź / Odrzuć, limit 7 dni): tytuł, kategoria, nowy / aktualizacja, link, liczba znaków, autor, początek treści (< 2000 znaków) → zatwierdzono: `PUT documents` → „Dodano X (n fragmentów)” z `<@discordId>`; odrzucono / wygasło → komunikat do autora; błąd HTTP → Error workflow
- [x] Workflow **RAG forum sync** (`9vJLov1uMeXFfwN5`) — cron 04:00 → `GET documents` → `PUT` z `forumUrl` + zapisany `title` dla dokumentów z forum (błąd jednego nie przerywa pętli) → wiadomość na Discord tylko przy zmianach albo błędach
- [~] Każdy workflow: `validate_workflow` + `test_workflow` z pełnym pin data — Hub events: 4 gałęzie (rola, usunięcie z / bez `notify`, zgłoszenie → 202, nieznany → 400); add source: zatwierdzono / odrzucono / wygasło; forum sync: bez zmian (bez raportu) / zmiana + błąd. Pin data nie sprawdza wyrażeń w przypiętych węzłach (treść wiadomości Discord, body `PUT`) ani błędu Discorda / `PUT` — to zostaje na smoke po aktywacji

### 4c — wdrożenie (po zgodzie, kolejno)

- [x] Aktywacja Hub events + RAG add source + forum sync (użytkownik); `User activation` i `Add source` wyłączone
- [x] Poprawka „Report to ROOT” w forum sync (bot + treść), opublikowana
- [~] `N8N_EVENTS_WEBHOOK_URL` w Coolify → deploy #31 (zrobione) → smoke: zmiana roli, usunięcie konta z `notify`, zgłoszenie linku i pliku → zatwierdzenie / odrzucenie → dokument w DocsPanel
- [ ] Sprzątanie po potwierdzeniu: archiwizacja `User activation` i `Add source`, usunięcie starych zmiennych z Coolify

## Etap 5 — Zarządzanie dokumentami bazy wiedzy

Decyzje (2026-10-23): **EDITOR przez akceptację, ROOT od razu** — edycja EDITORA idzie zdarzeniem
`rag.source_submitted` (`mode: 'update'` + `changes`), usunięcie nowym `rag.document_delete_requested`;
ROOT zapisuje, dodaje i usuwa bez akceptacji. **Dokument z forum: treść tylko na forum** — w aplikacji
tytuł, kategoria i „Pobierz aktualną treść z forum”. **Osobna strona `/tutorials/docs`**.

### 5a — kod

- [x] `server/rag/edit.ts` — `prepareDocumentEdit(app, slug, body, submittedBy)`: 404, kategoria, tytuł, treść pliku albo (forum) zapisana / `refresh` z wątku, `changes` (tytuł / kategoria / treść — sam tytuł nie liczy się jako treść), bez zmian → 400; wspólne `requireCategory` / `requiredText` / `normalizeSource` w `submission.ts`; `getDocument` w `ingest.ts`; zdarzenie `rag.document_delete_requested` + testy
- [x] `GET` / `PATCH` / `DELETE /api/tutorials/documents/[slug]` (EDITOR + `verifyOrigin`; ROOT → `ingestDocument` / `deleteDocument`, EDITOR → zdarzenie, n8n niedostępne → 502); `sourcesPost`: ROOT dodaje od razu; wspólne `routes/submit.ts` + testy integracyjne
- [x] `/tutorials/docs` (`DocumentsPage`, przekierowanie bez EDITOR/ROOT): `DocumentsTable` (grupy kategorii), `EditDocumentModal` (Milkdown dla pliku, przełącznik odświeżenia dla forum), `DeleteDocumentModal`, `CategorySelect` wydzielony z `AddSourceModal`; wejście „Zarządzaj bazą wiedzy” w nagłówku czatu
- [x] CLAUDE.md, README
- [~] Weryfikacja 5a: test / lint / tsc / build zielone — ręczny przegląd UI w dev czeka; propozycja commitów

### 5b — n8n

- [x] **RAG add source**: nagłówek „Zmiana dokumentu” i linia „Zmiany: …” w wiadomości do ROOT, gdy jest `changes`; ogłoszenie „Zaktualizowano w bazie wiedzy” przy `mode: 'update'`
- [x] Nowy sub-workflow **RAG remove document** (`LhFmgeOW58yxspEq`): Send and wait (bot, kanał ROOT, Usuń / Odrzuć, 7 dni) → `DELETE documents` → ogłoszenie / komunikat do autora; error workflow jak w pozostałych
- [x] **Hub events**: wyjście `rag.document_delete_requested` → 202 → RAG remove document (fallback „Unknown” przesunięty na wyjście 4)
- [~] Testy z pełnym pin data: Hub events — usunięcie / nieznany typ / zgłoszenie z `changes`; add source — wiadomość z „Zmiany”; remove document — zatwierdzono / odrzucono / wygasło (bez autora). Publikacja zmian Hub events i RAG add source oraz nowego workflowu — użytkownik

### 5c — wdrożenie

- [ ] Publikacja zmian n8n **przed** deployem kodu (stary Hub events odpowie 400 → EDITOR dostanie 502)
- [ ] Deploy → smoke: EDITOR edycja → akceptacja, usunięcie → odrzucenie; ROOT edycja od razu; odświeżenie z forum

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
