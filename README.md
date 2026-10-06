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

| Warstwa       | Technologia                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), TypeScript                                                                   |
| UI            | shadcn/ui (Radix, styl `radix-nova`), Tailwind CSS v4, lucide-react, sonner                           |
| Backend       | Next.js Route Handlers                                                                                |
| Baza danych   | PostgreSQL + `pgvector` + `pg_trgm` (Prisma ORM)                                                      |
| Auth          | NextAuth (Auth.js) v5 — Discord OAuth, sesje w bazie, ochrona tras przez `src/proxy.ts`               |
| LLM           | primary: dowolny endpoint kompatybilny z OpenAI (`LLM_AI_*`), fallback: OVH AI Endpoints (`OVH_AI_*`) |
| Embeddingi    | OVH AI Endpoints                                                                                      |
| Automatyzacja | n8n (webhooki: zmiana roli, usunięcie konta, dodawanie źródeł)                                        |
| Hosting       | OVH VPS → Coolify + Nixpacks                                                                          |
| Testy         | Vitest + Testing Library                                                                              |

## Architektura

### Mini-apki

Rejestr mini-apek to `src/modules/common/apps/registry.ts`: id, ścieżka, nazwa, opis kafelka,
ikona i lista ról. Z rejestru korzystają:

- proxy (dostęp do ścieżek);
- strona startowa (kafelki);
- panel admina (kolumna ról dla każdej mini-apki);
- walidacja ról po stronie serwera.

Dodanie mini-apki:

1. Nowy moduł w `src/modules/<id>` oraz trasy `src/app/<id>` i `src/app/api/<id>`.
2. Wpis w rejestrze `APPS`.
3. Opcjonalnie hook zmiany roli w `src/server/apps/hooks.ts` (np. webhook n8n).
4. Dla RAG-a: treść w `content/<id>/<kategoria>/*.md` i `pnpm db:seed`. Wyszukiwanie
   (`server/rag`), limit zapytań (`server/rateLimit.ts`) i historia rozmów
   (`server/conversations.ts`) przyjmują id mini-apki jako parametr.

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
Import (pnpm content:import [id wątku…]):
  wątek forum (wersja do druku) → markdown → content/tutorials/<kategoria>/<slug>.md

Seeding (pnpm db:seed):
  content/tutorials/<kategoria>/*.md → chunking → embedding (OVH) → PostgreSQL (tsvector + vector)

Zapytanie:
  rezerwacja limitu → [guardrail ∥ hybrid search (FTS AND/OR + trigram + embeddingi, RRF)]
  → rozszerzenie o trafione sekcje/dokumenty → prompt do LLM → odpowiedź (stream SSE)
```

- **Import treści** (`scripts/importForum.ts`): deterministyczny konwerter (bez AI) wersji do druku wątku
  jcink — post → `##`, sekcja posta → `###`, przykłady jako cytaty. Lista wątków: `scripts/forumTopics.ts`.
  Wynik przeglądaj w `git diff content/` przed seedem.
- **Chunking:** ~650 tokenów z overlapem ~100; każdy chunk zna ścieżki sekcji, przez które przechodzi.
- **Hybrid search:**
  - FTS (`simple`, najpierw AND, potem OR);
  - trigram (`word_similarity`);
  - embeddingi (cosine, waga 2× w RRF, timeout 8 s z fallbackiem do samego FTS).
- **Synonimy** specyficzne dla poradników (`server/tutorials/synonyms.ts`) rozszerzają tylko zapytanie FTS.
- **Rozszerzenie kontekstu:** każde trafienie (w kolejności rankingu) dociąga najszerszą grupę, która mieści się w budżecie 12 000 znaków — cały dokument, a gdy się nie mieści, swoją sekcję `##`, a potem podsekcję `###`.
- **Guardrail** (`server/guardrails.ts`): klasyfikator na modelu OVH działa równolegle z wyszukiwaniem i zwraca jeden z werdyktów:
  - `INJECTION` → odpowiedź 400;
  - `JEZYK` → stała odpowiedź „tylko po polsku”, bez wywołania głównego modelu i bez zapisu do historii;
  - `OK` → zwykła ścieżka;
  - błąd lub timeout (5 s) → wiadomość jest przepuszczana (fail-open).
- **Prompt** (`server/tutorials/prompts.ts`): odpowiedzi wyłącznie na podstawie fragmentów poradników. Pytania spoza forum dostają stałe zdanie `OFF_TOPIC_MESSAGE`. Promptowi przekazywane jest 6 ostatnich wiadomości z rozmowy.
- **LLM z fallbackiem** (`server/ai`): najpierw primary (`LLM_AI_*`), a gdy zawiedzie przed wysłaniem pierwszego tokenu, automatycznie OVH (`OVH_AI_*`).
- **Limit przed kosztami:** limit dzienny jest rezerwowany przed wywołaniami płatnych usług (guardrail, embeddingi) i zwalniany przy odrzuceniu lub błędzie.

### Historia czatu

Każda wymiana zapisywana jest w `conversations` (`userId`, `app`, `sessionId`, IP do audytu)
oraz `messages`. Rozmowa należy do użytkownika: historia, lista i usuwanie sesji zawsze
filtrowane są po `userId` i `app`. `localStorage` (`mangetsu:tutorials:*`) służy do szybkiego
wyświetlania historii, a przy starcie jest synchronizowany z listą sesji z serwera.

## Struktura projektu

```
├── content/tutorials/              # Poradniki (markdown: kompendium, mechanika, realia)
├── docs/                           # notices.json (globalne), tutorials/documents-info.md
├── prisma/                         # Schema i migracje
├── public/                         # Grafiki (m.in. tła kafelków)
├── scripts/                        # seed.ts (+ parser ścieżek treści), importForum.ts (forum → markdown)
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
    │       └── tutorials/{chat,sessions,rate-limit,sources}/
    ├── generated/prisma/           # Prisma Client (generowany przez postinstall)
    ├── modules/                    # common, hub, auth, admin, notices, tutorials
    ├── server/
    │   ├── ai/  db/  rag/  apps/  tutorials/
    │   ├── auth.ts  authorize.ts  rateLimit.ts  conversations.ts  users.ts
    │   └── webhooks.ts  guardrails.ts  notices.ts
    └── proxy.ts
```

## Uruchomienie lokalne

```bash
cp .env.example .env.local         # 1. Zmienne środowiskowe
docker compose up -d postgres      # 2. PostgreSQL z pgvector
pnpm install                       # 3. Zależności
pnpm db:migrate                    # 4. Migracje Prisma
pnpm db:seed                       # 5. Indeksowanie treści (chunking + embeddingi)
pnpm dev                           # 6. Dev server
```

Pozostałe skrypty:

- testy (Vitest): `pnpm test`, `pnpm test:watch`;
- lint: `pnpm lint`, `pnpm lint:fix`;
- formatowanie (Prettier): `pnpm format`, `pnpm format:check`.

## Zmienne środowiskowe

Placeholdery są w `.env.example` (dev: `.env.local`, prod: panel Coolify).

| Grupa                  | Zmienne                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Baza                   | `DATABASE_URL`                                                                                                     |
| Auth                   | `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`                             |
| LLM primary            | `LLM_AI_ENDPOINT`, `LLM_AI_API_KEY`, `LLM_AI_MODEL` (bez `LLM_AI_ENDPOINT` czat idzie od razu do OVH)              |
| OVH (fallback, guard.) | `OVH_AI_ENDPOINT`, `OVH_AI_API_KEY`, `OVH_AI_MODEL`                                                                |
| Embeddingi (OVH)       | `OVH_AI_EMBEDDING_ENDPOINT`, `OVH_AI_EMBEDDING_MODEL`                                                              |
| Webhooki n8n           | `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_SECRET`, `N8N_ROLE_ACTIVATION_WEBHOOK_PATH`, `N8N_USER_DELETION_WEBHOOK_PATH` |
| Źródła                 | `SOURCES_WEBHOOK_URL`                                                                                              |
| Pozostałe              | `DAILY_REQUEST_LIMIT`, `NEXT_PUBLIC_FORUM_URL`                                                                     |

Ważne dla izolacji sesji: na produkcji `AUTH_URL` musi być pełnym adresem
`https://mangetsu.thalverntable.app`, bo od niego zależą prefiksy `__Host-` cookies.

## Deployment (Coolify)

1. Połącz repozytorium z Coolify i ustaw zmienne środowiskowe w panelu.
2. Coolify buduje projekt przez **Nixpacks** (bez Dockerfile): `pnpm build` / `pnpm start`.
3. `postinstall` uruchamia `prisma generate`, więc klient Prismy powstaje przy każdej instalacji zależności.
4. Postgres z `pgvector` działa jako oddzielna usługa w Coolify; migracje: `pnpm db:migrate:deploy`.
5. Wersja aplikacji to pole `version` w `package.json`. Podbijaj ją przy wydaniu, bo jest widoczna dla użytkowników w popoverze ogłoszeń.

## Skalowalność

Aplikacja projektowana na **maksymalnie kilkanaście użytkowników**. Nie wymaga cache'owania,
kolejkowania ani złożonej infrastruktury.
