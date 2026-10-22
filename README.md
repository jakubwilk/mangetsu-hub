# Mangetsu Hub

![Mangetsu RAG](https://jakubwilk.pl/images/mangetsu-hub.png)

Prywatny hub aplikacji („mini-apek”) dla forum RPG Mangetsu, dostępny pod
`mangetsu.thalverntable.app`. Jedno logowanie przez Discord daje dostęp do wszystkich mini-apek,
do których użytkownik ma rolę. Każda mini-apka działa pod własnym URL-em. Pierwszą jest
**Poradniki** (`/tutorials`): czat RAG odpowiadający na pytania o zasady forum na podstawie
poradników (hybrid search: full-text + trigram + embeddingi).

## Funkcjonalności

- **Hub:** `/` pokazuje logowanie przez Discord, a po zalogowaniu kafelki mini-apek dostępnych dla użytkownika.
- **Role per mini-apka:** każda mini-apka definiuje własny zestaw ról (`USER` jest zawsze). `ROOT` jest globalny: ma dostęp do wszystkiego i jako jedyny administruje.
- **Nowe konta:** konto bez żadnej roli trafia na `/pending` do czasu aktywacji.
- **Panel `/admin` (tylko ROOT):**
  - nadawanie i odbieranie ról w każdej mini-apce;
  - usuwanie kont;
  - powiadomienia przez webhooki n8n.
- **Poradniki (`/tutorials`):**
  - czat RAG ze streamingiem SSE;
  - guardrail przed modelem: blokuje próby prompt injection i odpowiada stałym komunikatem na wiadomości w języku innym niż polski;
  - asystent trzyma się tematu forum: pytania spoza zakresu dostają stały komunikat, a na pytania o niego samego (np. „kim jesteś?”) odpowiada krótkim przedstawieniem się;
  - historia rozmów (prywatna dla użytkownika);
  - dzienny limit zapytań (`DAILY_REQUEST_LIMIT`, domyślnie 20);
  - panel „Dodaj źródło” (rola `EDITOR`, obecnie wyłączony flagą `ENABLED` w `AddSourceModal`).
- **Ogłoszenia** (`docs/notices.json`) wspólne dla całego huba, pod ikoną dzwonka w nagłówku. Nagłówek popovera pokazuje też wersję aplikacji z `package.json`.

## Stack technologiczny

| Warstwa       | Technologia                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), TypeScript                                                                                 |
| UI            | shadcn/ui (Radix, styl `radix-nova`), Tailwind CSS v4, lucide-react, sonner                                         |
| Backend       | Next.js Route Handlers                                                                                              |
| Baza danych   | PostgreSQL + `pgvector` + `pg_trgm` (Prisma ORM)                                                                    |
| Auth          | NextAuth (Auth.js) v5 — Discord OAuth, sesje w bazie, ochrona tras przez `src/proxy.ts`                             |
| LLM           | primary: dowolny endpoint kompatybilny z OpenAI (`LLM_MAIN_AI_*`), fallback: OVH AI Endpoints (`LLM_FALLBACK_AI_*`) |
| Embeddingi    | OVH AI Endpoints                                                                                                    |
| Automatyzacja | n8n (webhooki: zmiana roli, usunięcie konta, dodawanie źródeł)                                                      |
| Hosting       | OVH VPS → Coolify + Nixpacks                                                                                        |
| Testy         | Vitest + Testing Library                                                                                            |

## Architektura

### Mini-apki

Rejestr mini-apek to `src/apps/index.ts`, złożony z manifestów `src/apps/<id>/manifest.ts`: id,
ścieżka, nazwa, opis kafelka, ikona, lista ról i flaga `enabled`. Z rejestru korzystają:

- proxy (dostęp do ścieżek);
- strona startowa (kafelki);
- panel admina (kolumna ról dla każdej mini-apki);
- walidacja ról po stronie serwera.

Dodanie mini-apki:

1. Folder `src/apps/<id>` z `manifest.ts` i wpis manifestu w rejestrze `APPS` (`src/apps/index.ts`).
2. Cienkie pliki tras w `src/app/<id>` i `src/app/api/<id>`, re-eksportujące `routes/` i `page/` apki.
3. Opcjonalnie hook zmiany roli w `src/server/apps/hooks.ts` (np. webhook n8n).
4. Dla czatu RAG: `RagChatConfig` (prompt, synonimy, dodatkowe wyszukiwania, limit) →
   `createRagChatRoutes` (`server/chat`) i komponenty `chat` (`ChatShell`, `ChatView`, `ChatSidebar`)
   na stronie. Kategorie bazy wiedzy w manifeście (`rag.categories`), treść przez wewnętrzne API
   (`PUT /api/internal/rag/documents`) albo `pnpm rag:load`.

### Autoryzacja i izolacja subdomen

- **Logowanie** wyłącznie przez Discord OAuth.
- **Role:** `users.isRoot` (globalny ROOT, ustawiany tylko w bazie) oraz `app_roles` (`userId`, `app`, `role`). Rola walidowana jest w kodzie względem rejestru.
- **Ochrona tras:** `src/proxy.ts` przekierowuje użytkownika bez dostępu. Route Handlery sprawdzają rolę przez `requireAppRole()` lub `requireRoot()`, a mutacje dodatkowo przez `verifyOrigin()`.
- **Izolacja subdomen:** hub współdzieli domenę `thalverntable.app` z niezależnymi aplikacjami (inne subdomeny, domena główna). Dlatego:
  - cookies Auth.js są host-only (bez atrybutu `Domain`), więc nie trafiają do innych subdomen;
  - przy HTTPS mają prefiks `__Host-`, więc przeglądarka odrzuci cookie o tej nazwie ustawione przez sąsiednią subdomenę lub domenę główną;
  - `verifyOrigin()` porównuje `Origin` z `Host` co do hosta, bo `SameSite=Lax` nie chroni przed żądaniami z sąsiedniej subdomeny (to ta sama „site”).

### Poradniki — RAG

![Mangetsu RAG](https://jakubwilk.pl/images/mangetsu-rag.png)

```
Ingest (PUT /api/internal/rag/documents z n8n, pnpm rag:load):
  markdown albo link do wątku forum (wersja do druku → markdown) → normalizacja → hash
  → bez zmian: koniec (bez embeddingów) / zmiana: chunking → embedding (OVH) → PostgreSQL

Zapytanie:
  rezerwacja limitu → [guardrail ∥ hybrid search (FTS AND/OR + trigram + embeddingi, RRF)]
  → rozszerzenie o trafione sekcje/dokumenty → prompt do LLM → odpowiedź (stream SSE)
```

- **Treść w bazie:** tabela `documents` trzyma markdown, `contentHash`, `slug` i `sourceUrl` — to źródło
  prawdy. `ingestDocument` (`server/rag/ingest.ts`) waliduje kategorię (manifest), slug i limit
  `MAX_SOURCE_CHARS`, a chunki i embeddingi liczy tylko przy zmianie hasha.
- **Wątki forum** (`server/rag/sources/forum.ts`): przyjmowany jest wyłącznie zwykły link
  `…/index.php?showtopic=N` forum z `NEXT_PUBLIC_FORUM_URL`; deterministyczny konwerter (bez AI) wersji do
  druku jcink — post → `##`, sekcja posta → `###`, przykłady jako cytaty.
- **Wewnętrzne API dla n8n** (`/api/internal/rag/documents`, poza proxy, nagłówek
  `Authorization: Bearer <INTERNAL_API_SECRET>`): `GET ?app=` lista, `PUT` `{ app, slug, title, category,
markdown, sourceUrl? }` albo `{ app, slug, category, forumUrl, title? }` → `{ changed, chunks }`,
  `DELETE ?app=&slug=`.
- **Chunking:** ~650 tokenów z overlapem ~100; każdy chunk zna ścieżki sekcji, przez które przechodzi.
  Akapit dłuższy niż cel dzielony jest po liniach, potem po zdaniach; kawałki tabeli powtarzają nagłówek.
- **Hybrid search:**
  - FTS (`simple`, najpierw AND, potem OR);
  - trigram (`word_similarity`);
  - embeddingi (cosine, waga 2× w RRF, timeout 8 s z fallbackiem do samego FTS).
- **Synonimy** specyficzne dla poradników (`apps/tutorials/server/synonyms.ts`) rozszerzają tylko zapytanie FTS.
- **Rozszerzenie kontekstu:** każde trafienie (w kolejności rankingu) dociąga najszerszą grupę, która mieści się w budżecie 12 000 znaków — cały dokument, a gdy się nie mieści, swoją sekcję `##`, a potem podsekcję `###`.
- **Guardrail** (`server/guardrails.ts`): klasyfikator na modelu OVH działa równolegle z wyszukiwaniem i zwraca jeden z werdyktów:
  - `INJECTION` → odpowiedź 400;
  - `JEZYK` → stała odpowiedź „tylko po polsku”, bez wywołania głównego modelu i bez zapisu do historii;
  - `OK` → zwykła ścieżka;
  - błąd lub timeout (5 s) → wiadomość jest przepuszczana (fail-open).
- **Prompt** (`apps/tutorials/server/prompts.ts`): odpowiedzi wyłącznie na podstawie fragmentów poradników. Pytania spoza forum dostają stałe zdanie `OFF_TOPIC_MESSAGE`. Promptowi przekazywane jest 6 ostatnich wiadomości z rozmowy.
- **LLM z fallbackiem** (`server/ai`): najpierw primary (`LLM_MAIN_AI_*`), a gdy zawiedzie przed wysłaniem pierwszego tokenu, automatycznie fallback (`LLM_FALLBACK_AI_*`).
- **Limit przed kosztami:** limit dzienny jest rezerwowany przed wywołaniami płatnych usług (guardrail, embeddingi) i zwalniany przy odrzuceniu lub błędzie.
- **Strażnik jakości** (`pnpm rag:eval`): zestaw pytań z oczekiwanymi dokumentami; `--save` zapisuje wynik bazowy z lokalnej bazy, zwykłe uruchomienie pokazuje różnice w chunkach trafiających do kontekstu.

### Historia czatu

Każda wymiana zapisywana jest w `conversations` (`userId`, `app`, `sessionId`, IP do audytu)
oraz `messages`. Rozmowa należy do użytkownika: historia, lista i usuwanie sesji zawsze
filtrowane są po `userId` i `app`. `localStorage` (`mangetsu:tutorials:*`) służy do szybkiego
wyświetlania historii, a przy starcie jest synchronizowany z listą sesji z serwera.

## Struktura projektu

```
├── content/tutorials/              # Stara kopia treści Poradników (do usunięcia w etapie 3b, źródło: baza)
├── docs/                           # notices.json (ogłoszenia globalne)
├── prisma/                         # schema/ (platform.prisma, rag.prisma) i migrations/
├── public/apps/<id>/               # Grafiki mini-apek (tła kafelków)
├── scripts/                        # rag:eval / rag:dump / rag:load / rag:backfill (+ stare seed, importForum)
├── docker-compose.yml              # Tylko lokalny Postgres z pgvector (nie do deploymentu)
└── src/
    ├── app/
    │   ├── page.tsx                # Logowanie albo kafelki mini-apek
    │   ├── pending/  admin/  tutorials/
    │   ├── robots.ts               # Blokada indeksowania
    │   ├── _components/HubHeader/  # Nagłówek huba (kompozycja modułów)
    │   └── api/
    │       ├── auth/[...nextauth]/              # Auth.js
    │       ├── admin/users/[id]/                # DELETE konta
    │       ├── admin/users/[id]/apps/[app]/     # PUT roli w mini-apce
    │       ├── internal/rag/documents/          # API dla n8n (sekret), re-eksport z server/rag
    │       └── tutorials/{chat,sessions,rate-limit,sources}/  # re-eksporty z apps/tutorials/routes
    ├── apps/                       # mini-apki: rejestr (index.ts) + tutorials/ (manifest, server, routes, page…)
    ├── generated/prisma/           # Prisma Client (generowany przez postinstall)
    ├── modules/                    # common, hub, auth, admin, notices, chat (UI czatu RAG)
    ├── server/
    │   ├── ai/  db/  rag/  chat/  apps/
    │   ├── auth.ts  authorize.ts  internal.ts  rateLimit.ts  conversations.ts  users.ts
    │   └── webhooks.ts  guardrails.ts  notices.ts
    └── proxy.ts
```

## Uruchomienie lokalne

```bash
cp .env.example .env.local         # 1. Zmienne środowiskowe
docker compose up -d postgres      # 2. PostgreSQL z pgvector
pnpm install                       # 3. Zależności
pnpm db:migrate                    # 4. Migracje Prisma
pnpm rag:load <zrzut.json>         # 5. Baza wiedzy ze zrzutu (pnpm rag:dump), chunking + embeddingi
pnpm dev                           # 6. Dev server
```

Pozostałe skrypty:

- testy (Vitest): `pnpm test`, `pnpm test:watch`;
- lint: `pnpm lint`, `pnpm lint:fix`;
- formatowanie (Prettier): `pnpm format`, `pnpm format:check`;
- baza wiedzy: `pnpm rag:dump <plik.json>` (markdown bez wektorów), `pnpm rag:load <plik.json>`
  (ingest, niezmienione dokumenty pomijane po hashu), `pnpm rag:eval` (strażnik jakości wyszukiwania),
  `pnpm rag:backfill [--dry-run]` (jednorazowe przeniesienie `content/` do bazy bez ponownego chunkowania).

## Zmienne środowiskowe

Placeholdery są w `.env.example` (dev: `.env.local`, prod: panel Coolify).

| Grupa                | Zmienne                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Baza                 | `DATABASE_URL`                                                                                                                  |
| Auth                 | `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`                                          |
| LLM primary          | `LLM_MAIN_AI_ENDPOINT`, `LLM_MAIN_AI_API_KEY`, `LLM_MAIN_AI_MODEL` (bez `LLM_MAIN_AI_ENDPOINT` czat idzie od razu do fallbacku) |
| LLM fallback, guard. | `LLM_FALLBACK_AI_ENDPOINT`, `LLM_FALLBACK_AI_API_KEY`, `LLM_FALLBACK_AI_MODEL`                                                  |
| Embeddingi           | `LLM_AI_EMBEDDING_ENDPOINT`, `LLM_AI_EMBEDDING_API_KEY`, `LLM_AI_EMBEDDING_MODEL`                                               |
| Webhooki n8n         | `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_SECRET`, `N8N_ROLE_ACTIVATION_WEBHOOK_PATH`, `N8N_USER_DELETION_WEBHOOK_PATH`              |
| API wewnętrzne       | `INTERNAL_API_SECRET` (bez niej `/api/internal/*` zwraca 503)                                                                   |
| Źródła               | `SOURCES_WEBHOOK_URL`                                                                                                           |
| Pozostałe            | `DAILY_REQUEST_LIMIT`, `NEXT_PUBLIC_FORUM_URL`                                                                                  |

Ważne dla izolacji sesji: na produkcji `AUTH_URL` musi być pełnym adresem
`https://mangetsu.thalverntable.app`, bo od niego zależą prefiksy `__Host-` cookies.

## Deployment (Coolify)

1. Połącz repozytorium z Coolify i ustaw zmienne środowiskowe w panelu.
2. Coolify buduje projekt przez **Nixpacks** (bez Dockerfile): `pnpm build` / `pnpm start`.
3. `postinstall` uruchamia `prisma generate`, więc klient Prismy powstaje przy każdej instalacji zależności.
4. Postgres z `pgvector` działa jako oddzielna usługa w Coolify; migracje: `pnpm db:migrate:deploy`.
5. Skrypty na bazie produkcyjnej odpala się lokalnie, podając jej adres w wierszu poleceń (wygrywa z
   `.env.local`): `DATABASE_URL=<prod> pnpm db:migrate:deploy`, `DATABASE_URL=<prod> pnpm rag:backfill --dry-run`.
6. Wersja aplikacji to pole `version` w `package.json`. Podbijaj ją przy wydaniu, bo jest widoczna dla użytkowników w popoverze ogłoszeń.

## Skalowalność

Aplikacja projektowana na **maksymalnie kilkanaście użytkowników**. Nie wymaga cache'owania,
kolejkowania ani złożonej infrastruktury.
