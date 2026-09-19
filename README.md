# Mangetsu Tutorials RAG

![Mangetsu RAG](https://jakubwilk.pl/images/mangetsu-rag.png)

Prywatna aplikacja webowa do przeszukiwania poradników z forum Mangetsu przy użyciu LLM. Użytkownik zadaje pytania w języku naturalnym, aplikacja wyszukuje odpowiednie fragmenty poradników (hybrid search: full-text + embeddingi) i zwraca odpowiedź wygenerowaną przez model językowy.

## Funkcjonalności

- Interfejs czatu do zadawania pytań dotyczących poradników
- Pseudo-RAG: fragmentacja plików tekstowych → hybrid search (FTS + trigram + embeddingi, RRF) → kontekst do LLM
- Logowanie przez Discord OAuth (NextAuth / Auth.js v5) — brak logowania hasłem
- System ról: `GUEST` (konto nieaktywowane) → `USER` → `EDITOR` → `ROOT` (administrator)
- Nowe konta trafiają na stronę `/pending` do czasu aktywacji przez administratora
- Panel administracyjny `/admin` — zarządzanie rolami i usuwanie kont, z powiadomieniami przez webhooki n8n (aktywacja / usunięcie)
- Panel „Dodaj źródło" (rola `EDITOR`/`ROOT`) — zgłaszanie nowych poradników przez webhook automatyzacji
- Dzienny limit zapytań na użytkownika (rate limiting per-user, nie per-IP)
- Historia konwersacji zapisywana w PostgreSQL (audit, debugowanie błędów)
- Pliki poradników zarządzane bezpośrednio w kodzie źródłowym (katalog `content/`)

## Stack technologiczny

| Warstwa        | Technologia                                                             |
| -------------- | ----------------------------------------------------------------------- |
| Frontend       | Next.js 16 (App Router), TypeScript                                     |
| UI             | Mantine v9, Tailwind CSS                                                |
| Backend        | Next.js Route Handlers                                                  |
| Baza danych    | PostgreSQL + `pgvector` (FTS `tsvector`/`tsquery`, trigram, embeddingi) |
| Auth           | NextAuth (Auth.js) v5 — Discord OAuth                                   |
| LLM/Embeddingi | OVH AI Endpoints                                                        |
| Automatyzacja  | n8n (webhooki: aktywacja/usunięcie konta, dodawanie źródeł)             |
| Hosting        | OVH VPS → Coolify + Nixpacks                                            |

## Architektura

```
content/
  <kategoria>/
    poradnik-1.md
    poradnik-2.md
    ...

Przy seedingu (pnpm db:seed):
  Odczyt plików → chunking → embedding (OVH) → zapis chunków do PostgreSQL (tsvector + vector)

Na zapytanie użytkownika:
  Pytanie → hybrid search (FTS AND/OR + trigram + embeddingi, merge przez RRF)
          → rozszerzenie o sąsiednie chunki tego samego dokumentu
          → top N chunków jako kontekst → prompt do LLM → odpowiedź (stream SSE)
```

### Katalog `content/`

Pliki poradników (`.md`), pogrupowane w podkatalogi wg kategorii, trzymane bezpośrednio w repozytorium. **Nie trafiają do `public/`** — są dostępne wyłącznie po stronie serwera przez skrypt seedujący. Dodanie nowego poradnika = dodanie pliku + `pnpm db:seed` (lub zgłoszenie przez panel „Dodaj źródło", który idzie webhookiem do automatyzacji).

### Chunking

Pliki dzielone na fragmenty (~500–800 tokenów z overlapem ~100 tokenów). Każdy chunk trafia do tabeli `chunks` z kolumną `search_vector tsvector` (indeks GIN) oraz `embedding vector(4096)` (`pgvector`).

### Hybrid search

Trzy metody wyszukiwania uruchamiane równolegle i łączone przez **Reciprocal Rank Fusion**:

- **FTS** — `to_tsquery('simple', ...)`, najpierw tryb AND, fallback do OR gdy zbyt mało wyników
- **Trigram** (`pg_trgm`, `word_similarity`) — łagodzi literówki i odmianę słów
- **Embeddingi** (`pgvector`, cosine distance) — dominują wagę w RRF (2×), bo dopasowanie słów kluczowych w polskich tekstach RPG jest zawodne; mają timeout 8s z fallbackiem do samego FTS

Wyniki są dodatkowo rozszerzane o sąsiednie chunki tego samego dokumentu, gdy dokument pojawia się w wynikach więcej niż raz (sygnał, że cały dokument jest istotny).

### Autoryzacja i role

Logowanie wyłącznie przez Discord OAuth. Nowe konto dostaje rolę `GUEST` i trafia na `/pending` — czat jest niedostępny do czasu aktywacji przez `ROOT` w panelu `/admin`. Aktywacja i usunięcie konta wysyłają webhook do n8n (powiadomienie, np. na Discordzie). Endpointy API chronione przez `requireRole()` + `verifyOrigin()` (ochrona przed CSRF przez porównanie nagłówków `Origin`/`Host`).

### Historia czatu

Każda wiadomość zapisywana do PostgreSQL. Tabela `conversations` przechowuje `sessionId` (UUID generowany w `localStorage` przy pierwszej wizycie) oraz IP użytkownika (z nagłówka `X-Forwarded-For`) — wyłącznie do audytu i debugowania błędów. Tabela `messages` przechowuje pojedyncze wiadomości z rolą (`user`/`assistant`) i liczbą tokenów. Dzienny limit zapytań (`rate_limits`) liczony jest per zalogowany użytkownik (`userId`), nie per IP/sesja.

`localStorage` nadal używany do szybkiego wyświetlania historii w UI.

## Struktura projektu

```
mangetsu-tutorials-rag/
├── content/                        # Pliki poradników (markdown, wg kategorii)
├── docs/                           # Pliki statyczne: notices.json, documents-info.md
├── prisma/                         # Schema i migracje Prisma ORM
├── scripts/                        # Skrypty pomocnicze (seed, debug-search)
├── src/
│   ├── app/
│   │   ├── page.tsx                # Główna strona czatu (Server Component)
│   │   ├── layout.tsx              # Root layout z MantineProvider
│   │   ├── login/page.tsx          # Logowanie przez Discord
│   │   ├── pending/page.tsx        # Ekran oczekiwania na aktywację (rola GUEST)
│   │   ├── admin/page.tsx          # Panel administracyjny (zarządzanie użytkownikami)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts   # NextAuth (Discord OAuth)
│   │       ├── chat/route.ts                 # POST /api/chat — RAG pipeline (SSE stream)
│   │       ├── sessions/route.ts             # GET /api/sessions — walidacja sesji
│   │       ├── rate-limit/route.ts           # GET /api/rate-limit — licznik zapytań
│   │       ├── sources/route.ts              # POST /api/sources — zgłoszenie nowego źródła (webhook)
│   │       └── admin/users/[id]/route.ts     # PATCH/DELETE — role i usuwanie kont
│   ├── modules/
│   │   ├── common/                 # Współdzielone komponenty layoutu i utility
│   │   │   ├── api/sources.ts      # Klient HTTP — dodawanie źródeł
│   │   │   ├── components/         # AppLayout, Topbar, MobileNavBar, DocsPanel, Logo, AddSourceModal
│   │   │   ├── data/               # loading-messages.json
│   │   │   └── utils/notifications.ts
│   │   ├── auth/                   # Logowanie i role
│   │   │   ├── components/         # DiscordSignInButton, SignOutButton, UserMenu, AuthErrorNotice
│   │   │   └── types/role.ts       # UserRole, ROLE_LABELS
│   │   ├── admin/                  # Panel administracyjny
│   │   │   ├── api/                # updateUserRole, deleteUser
│   │   │   ├── components/         # AdminHeader, UsersTable, DeleteUserModal
│   │   │   └── types/
│   │   ├── chat/                   # Moduł czatu
│   │   │   ├── api/                # Klienty HTTP: handler, sessions, rate-limit
│   │   │   ├── components/         # ChatView, ChatInput, MessageList, MessageBubble, ChatSidebar
│   │   │   ├── store/              # Stan czatu (external store)
│   │   │   └── types/
│   │   ├── notices/                # System ogłoszeń
│   │   │   ├── components/         # NoticesPopover
│   │   │   └── store/              # Stan odrzuconych ogłoszeń (localStorage)
│   │   └── search/                 # Hybrid search (klient/typy)
│   │       ├── utils/chunker.ts
│   │       └── types/searchResult.ts
│   ├── server/                      # Kod wyłącznie serwerowy
│   │   ├── ai/                     # Klient OVH AI Endpoints + embedText()
│   │   ├── db/                     # Singleton Prisma Client
│   │   ├── prompts/                # System prompt dla LLM
│   │   ├── auth.ts                 # Konfiguracja NextAuth (Discord provider, Prisma adapter)
│   │   ├── authorize.ts            # requireRole(), verifyOrigin()
│   │   ├── chat.ts                 # Rate limiting, kontekst promptu, SSE stream
│   │   ├── guardrails.ts           # Walidacja/ograniczenia treści promptu
│   │   ├── notices.ts              # Loader docs/notices.json
│   │   ├── sources.ts              # Webhook — zgłaszanie nowych źródeł
│   │   └── webhooks.ts             # Webhooki n8n (aktywacja/usunięcie konta)
│   └── generated/prisma/           # Auto-generowane typy Prisma
├── .env.example
└── CLAUDE.md
```

## Uruchomienie lokalne

```bash
# 1. Skopiuj zmienne środowiskowe
cp .env.example .env.local

# 2. Uruchom PostgreSQL (z pgvector)
docker compose up -d postgres

# 3. Zainstaluj zależności
pnpm install

# 4. Zastosuj migracje Prisma
pnpm db:migrate

# 5. Zaindeksuj poradniki (chunking + embeddingi)
pnpm db:seed

# 6. Uruchom dev server
pnpm dev
```

## Zmienne środowiskowe

Pełna, aktualna lista placeholderów znajduje się w `.env.example`. Skrót:

```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/mangetsu_rag

# LLM AI Endpoints — komunikacja z użytkownikiem (primary)
LLM_AI_ENDPOINT=https://...
LLM_AI_API_KEY=...
LLM_AI_MODEL=...

# OVH AI Endpoints — LLM (fallback)
OVH_AI_ENDPOINT=https://...
OVH_AI_API_KEY=...
OVH_AI_MODEL=...

# OVH AI Endpoints — embeddingi (osobny endpoint)
OVH_AI_EMBEDDING_ENDPOINT=https://...
OVH_AI_EMBEDDING_MODEL=...

# Rate limiting
DAILY_REQUEST_LIMIT=20

# Auth (Discord OAuth) — AUTH_SECRET wygeneruj: npx auth secret
AUTH_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=
AUTH_TRUST_HOST=true

# n8n — panel administracyjny (aktywacja/usunięcie konta)
N8N_WEBHOOK_BASE_URL=
N8N_WEBHOOK_SECRET=
N8N_ROLE_ACTIVATION_WEBHOOK_PATH=
N8N_USER_DELETION_WEBHOOK_PATH=

# Webhook automatyzacji — panel "Dodaj źródło"
SOURCES_WEBHOOK_URL=

# Link do forum (widoczny w UI)
NEXT_PUBLIC_FORUM_URL=
```

## Deployment (Coolify)

1. Połącz repozytorium z Coolify
2. Ustaw zmienne środowiskowe w panelu Coolify
3. Coolify buduje projekt przez **Nixpacks** (bez Dockerfile) i uruchamia `pnpm build` / `pnpm start`
4. Postgres z `pgvector` jako oddzielna usługa w Coolify

## Skalowalność

Aplikacja projektowana na **maksymalnie kilkanaście użytkowników**. Nie wymaga cache'owania, kolejkowania ani złożonej infrastruktury.
