# Plan implementacji UI — Mangetsu Tutorials RAG

> Status: [ ] = do zrobienia, [x] = ukończone, [~] = w toku

---

## Faza 1 — Konfiguracja motywu i dark mode

**Pliki:** `src/app/layout.tsx`, `src/app/globals.css`

### Zadania

- [x] Wygenerować 10-odcieniową paletę dla koloru `#10718f` (wymagane przez Mantine)
- [x] Zarejestrować kolor własny w `createTheme({ colors: { mangetsu: [...] } })` i ustawić `primaryColor: 'mangetsu'`
- [x] Wymusić dark mode na poziomie `MantineProvider`: `forceColorScheme="dark"` (bez przełącznika)
- [x] Zaktualizować `ColorSchemeScript` z `defaultColorScheme="dark"`
- [x] Oczyścić `globals.css` — usunąć zmienne dla light mode, zostawić tylko dark base
- [x] Zaktualizować metadane (`title`, `description`) na właściwe dla projektu

**Uwaga:** Mantine wymaga tablicy 10 kolorów (shade 0–9). Kolor `#10718f` będzie na pozycji `[6]`.

---

## Faza 2 — Pliki statyczne `docs/`

**Pliki:** `docs/documents-info.md`, `docs/notices.json`

### Zadania

- [x] Utworzyć folder `docs/` w root projektu
- [x] Utworzyć `docs/documents-info.md` — markdown z opisem dokumentów dostępnych w bazie (placeholder content)
- [x] Utworzyć `docs/notices.json` — tablica obiektów z komunikatami

**Dlaczego notices jako JSON (nie .md)?**
Każdy komunikat potrzebuje `id` (do śledzenia odrzuconych w localStorage), `type` (info/warning) oraz `message`. Markdown nie daje tej struktury bez parsowania frontmatter — JSON jest tu czytelniejszy i prostszy.

**Format `notices.json`:**

```json
[
  {
    "id": "demo-notice",
    "type": "info",
    "message": "To jest wersja DEMO — funkcjonalność jest ograniczona."
  }
]
```

---

## Faza 3 — App Shell (szkielet layoutu)

**Pliki:** `src/app/layout.tsx`, nowe komponenty w `src/components/layout/`

### Zadania

- [x] Zaktualizować `src/app/layout.tsx` — uproszczony body (h-full overflow-hidden)
- [x] Utworzyć `src/components/layout/AppLayout.tsx` — Server Component, custom flexbox (zamiast Mantine AppShell — AppShell nie obsługuje natywnie vw + max-width dla offsets)
- [x] Utworzyć `src/components/layout/Topbar.tsx` — Server Component
  - Logo nieselektowalne po lewej (c="mangetsu.4"), przycisk forum po prawej
  - Wysokość: 60px, border-bottom
  - URL forum: `process.env.NEXT_PUBLIC_FORUM_URL`
- [x] Utworzyć `src/components/layout/ChatSidebar.tsx` — Client Component
  - Przycisk „Nowy czat", placeholder historii, licznik zapytań na dole
  - Szerokość: `20vw`, `maxWidth: 300px`
- [x] Utworzyć `src/components/layout/DocsPanel.tsx` — Client Component (react-markdown wymaga client)
  - Treść czytana serwerowo w `page.tsx`, przekazywana jako prop
  - Renderuje przez `Typography` (Mantine v9 odpowiednik TypographyStylesProvider) + `react-markdown`
  - Szerokość: `20vw`, `maxWidth: 300px`
- [x] Zaktualizować `src/app/page.tsx` — czyta `docs/documents-info.md`, renderuje AppLayout

**Układ:** `[Sidebar 20vw/max300px] | [Chat flex-1] | [DocsPanel 20vw/max300px]`

---

## Faza 4 — Panel czatu (główna treść)

**Pliki:** nowe komponenty w `src/components/chat/`, `src/app/page.tsx`

### Zadania

- [x] Przepisać `src/app/page.tsx` — czysty wrapper, ładuje `ChatView`
- [x] Utworzyć `src/components/chat/ChatView.tsx` — Client Component, główny kontener
- [x] Utworzyć `src/components/chat/MessageList.tsx` — lista wiadomości ze scrollem
- [x] Utworzyć `src/components/chat/MessageBubble.tsx` — bąbelki user/assistant
  - User: wyrównane do prawej, tło w kolorze primary, plain text
  - Assistant: wyrównane do lewej, tło neutralne, treść przez `react-markdown`
  - Animacja pojawiania się (CSS `bubble-in` — zamiast Mantine `Transition` ze względu na regułę ESLint `react-hooks/set-state-in-effect`)
- [x] Utworzyć `src/components/chat/ChatInput.tsx` — pole tekstowe + przycisk wyślij
  - `Textarea` z auto-resize (Mantine `autosize`)
  - Enter wysyła, Shift+Enter = nowa linia
  - Dezaktywacja podczas ładowania odpowiedzi
- [x] Placeholder pusty czat — zachęta do wpisania pytania (widoczna gdy brak wiadomości)
- [x] Typing indicator — ikona książki z pulsowaniem + losowy tekst z `src/data/loading-messages.json`
- [x] Floating card design dla ChatInput (bez borderTop, `borderRadius`, `boxShadow`, `maxWidth`, `variant="unstyled"` na Textarea)

---

## Faza 5 — System ogłoszeń (notices)

**Pliki:** `src/components/notices/NoticesPopover.tsx`, integracja w `Topbar.tsx`

### Zadania

- [x] Utworzyć `src/components/notices/NoticesPopover.tsx` — Client Component
  - Czyta notices przez props (przekazane z Server Component który czyta `docs/notices.json`)
  - Ikona dzwonka (lub info) w topbarze z badge (liczba aktywnych)
  - Popover z listą aktywnych komunikatów
  - Każdy komunikat: przycisk X do odrzucenia (zapisuje id do `localStorage`)
  - Przycisk „Pokaż wszystkie" — czyści dismissed list z `localStorage`
- [x] Utworzyć `src/app/notices-loader.ts` (Server Component helper) — czyta i parsuje `docs/notices.json`
- [x] Integracja z `Topbar.tsx` — notices icon po prawej, obok przycisku forum

---

## Faza 6 — Powiadomienia systemowe (snackbary)

**Pliki:** `src/app/layout.tsx` (już skonfigurowane), `src/lib/notifications.ts`

### Zadania

- [x] Skonfigurować Mantine `Notifications` — `position="top-center"`, `limit={3}`, `autoClose={10000}`
- [x] Utworzyć `src/lib/notifications.ts` — helper funkcje `notifyError()`, `notifyInfo()`, `notifyWarning()` owijające `notifications.show()`
- [x] Ostylować powiadomienia zgodnie z dark theme

---

## Faza 7 — Integracja i cleanup

### Zadania

- [x] Podłączyć `session_id` (UUID z `localStorage`) do stanu czatu
- [x] Podłączyć licznik zapytań do realnych danych (mock na start: `0/10`)
- [x] Podłączyć listę historii czatów (z `localStorage` na start)
- [x] Testy TypeScript — `tsc --noEmit`, zero błędów
- [x] Usunąć wszystkie `console.log`, dead code, placeholder images Next.js
- [x] Sprawdzić czy ESLint nie zgłasza błędów

---

---

## Faza 8 — Baza danych i indeksowanie treści

**Cel:** działająca baza z wczytanymi poradnikami, gotowa do przeszukiwania.

### Nowe zależności

- `prisma` (devDependency) + `@prisma/client` — ORM
- `openai` — klient OVH AI Endpoints (instalowany już w tej fazie, używany w Fazie 9)

### Zmiany konfiguracyjne

- `package.json` — dodać `"postinstall": "prisma generate"` (wymagane dla Coolify)
- `package.json` — dodać skrypt `"db:migrate": "prisma migrate dev"` i `"db:seed": "tsx scripts/seed.ts"`
- `devDependencies` — dodać `tsx` do uruchamiania seed scriptu

### Pliki do utworzenia

| Plik                   | Co robi                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `prisma/schema.prisma` | Schema bazy: modele Document, Chunk, Conversation, Message, RateLimit |
| `prisma/migrations/`   | Automatycznie generowane przez `prisma migrate dev`                   |
| `src/lib/db.ts`        | Singleton Prisma Client (globalny, bezpieczny w Next.js dev)          |
| `src/lib/chunker.ts`   | Podział plików `.md` na chunki (~500–800 tokenów, overlap ~100)       |
| `scripts/seed.ts`      | Czyta `content/**/*.md`, chunkuje, zapisuje do bazy (idempotentny)    |

### Schema bazy (Prisma)

```
Document   — id, title, category, filePath, createdAt
           — relacja: chunks[]

Chunk      — id, documentId, content, chunkIndex
           — search_vector: Unsupported("tsvector")  ← FTS, aktualizowane triggerem SQL

Conversation — id, sessionId, ip, createdAt
             — relacja: messages[]

Message    — id, conversationId, role, content, tokensUsed, createdAt

RateLimit  — id, ip, requestDate, count
           — unikalny indeks: (ip, requestDate)
```

### Trigger SQL (po migracji, przez `prisma.$executeRaw`)

```sql
-- Automatyczna aktualizacja search_vector przy INSERT/UPDATE na chunks
CREATE TRIGGER chunks_search_vector_update
BEFORE INSERT OR UPDATE ON chunks
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(search_vector, 'pg_catalog.simple', content);
```

### Zadania

- [x] Zainstalować `prisma`, `@prisma/client`, `openai`, `tsx`
- [x] Skonfigurować `prisma/schema.prisma` z wszystkimi modelami
- [x] Uruchomić `prisma migrate dev --name initial` — wygenerować i zastosować migrację
- [x] Dodać trigger `tsvector` przez osobny plik migracji SQL
- [x] Utworzyć `src/lib/db.ts` — singleton Prisma Client
- [x] Utworzyć `src/lib/chunker.ts` — logika chunkingu
- [x] Utworzyć `scripts/seed.ts` — idempotentny seed (usuwa stare chunks dokumentu przed ponownym wstawieniem)
- [x] Dodać `postinstall`, `db:migrate`, `db:seed` do `package.json`
- [x] Uruchomić `npm run db:seed` i zweryfikować dane w bazie (20 docs, 118 chunks)
- [x] `tsc --noEmit` + `eslint .` — zero błędów

---

## Faza 9 — API `/api/chat` (RAG pipeline)

**Cel:** endpoint przyjmujący pytanie, szukający w bazie, wywołujący LLM, zwracający odpowiedź.

### Nowe zmienne środowiskowe (już w `.env.example`)

- `OVH_AI_ENDPOINT` — URL endpointu modelu
- `OVH_AI_API_KEY` — klucz API OVH
- `OVH_AI_MODEL` — nazwa modelu (np. `Meta-Llama-3.1-70B-Instruct`)
- `DAILY_REQUEST_LIMIT` — dzienny limit zapytań per IP (domyślnie `20`)

### Pliki do utworzenia

| Plik                        | Co robi                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/prompts.ts`        | System prompt — instruuje LLM jak odpowiadać na pytania o Mangetsu           |
| `src/lib/search.ts`         | FTS helper — rozbija query na tokeny, zwraca top 6 chunków przez `$queryRaw` |
| `src/app/api/chat/route.ts` | POST handler — cały pipeline RAG                                             |

### Pipeline w `POST /api/chat`

```
Body: { message: string, sessionId: string }

1. Walidacja inputu
2. Pobierz IP z nagłówka X-Forwarded-For
3. Sprawdź rate limit (tabela RateLimit, pole requestDate = dzisiaj)
   → jeśli count >= DAILY_REQUEST_LIMIT: return 429
4. FTS search → top 6 chunków (search.ts)
5. Zbuduj prompt: system + chunki jako kontekst
6. Wywołaj OVH przez openai package (baseURL = OVH_AI_ENDPOINT)
7. Upsert Conversation (sessionId + ip), zapisz 2 Messages (user + assistant)
8. Upsert RateLimit — count += 1
9. Zwróć: { reply, tokensUsed, requestsUsed }
```

### Zadania

- [x] Utworzyć `src/lib/prompts.ts` — system prompt po polsku
- [x] Utworzyć `src/lib/search.ts` — FTS przez `prisma.$queryRaw`
- [x] Utworzyć `src/app/api/chat/route.ts` — pełny pipeline
- [x] Przetestować endpoint przez `curl` / Postman
- [x] `tsc --noEmit` + `eslint .` — zero błędów

---

## Faza 10 — Integracja frontendu z API

**Cel:** zastąpienie mocka prawdziwym API, licznik zapytań z bazy, obsługa błędów.

### Pliki do zmiany

| Plik                               | Co się zmienia                                                          |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `src/components/chat/ChatView.tsx` | `fetch('/api/chat')` zamiast mock, obsługa błędów przez `notifyError()` |
| `src/store/chatStore.ts`           | `requestsUsed` aktualizowany z odpowiedzi API (nie tylko lokalnie)      |

### Zadania

- [x] Zastąpić mock w `ChatView` prawdziwym `fetch('/api/chat')`
- [x] Obsłużyć błędy (429 = limit, 500 = błąd serwera) przez `notifyError()`
- [x] Zaktualizować `requestsUsed` w `chatStore` z wartości zwróconej przez API
- [ ] Sprawdzić działanie end-to-end: pytanie → odpowiedź z LLM → zapis w bazie
- [x] `tsc --noEmit` + `eslint .` — zero błędów

---

## Faza 11 — Embedding search (hybrid RAG)

**Cel:** zastąpienie czystego FTS+trigram wyszukiwaniem hybrydowym (FTS + cosine similarity na wektorach embeddingów), eliminując błędy wynikające z luk semantycznych (np. "rodzaje klątw" → "Poziomy Klątw").

**Model:** `Qwen3-Embedding-8B` przez OVH AI Endpoints (multilingual, #1 MTEB, 32k ctx, wymiary 4096)

**Infrastruktura:** pgvector 0.8.2 aktywny lokalnie (Docker `pgvector/pgvector:pg18`) i na produkcji (Coolify PGVector 18)

### Nowe zmienne środowiskowe

- `OVH_AI_EMBEDDING_ENDPOINT` — osobny URL endpointu dla modelu embeddingowego (OVH, format OpenAI-compatible)

### Pliki do zmiany

| Plik                                 | Co się zmienia                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`               | Dodać `embedding Unsupported("vector(4096)")` do modelu `Chunk`                                      |
| `prisma/migrations/`                 | Dwie migracje: `add_embeddings` (vector(1024) + pgvector ext) + `resize_embedding_4096` (ALTER TYPE) |
| `.env.example`                       | Dodać `OVH_AI_EMBEDDING_ENDPOINT`                                                                    |
| `src/server/ai/embeddings.ts`        | Nowy plik — klient embeddingów (OpenAI-compatible, `input` → `number[]`)                             |
| `src/modules/search/utils/search.ts` | Hybrid search: FTS + `runEmbedding()` z cosine similarity, wyniki mergowane wagowo                   |
| `scripts/seed.ts`                    | Generować embedding per chunk przy indeksowaniu, zapisywać do kolumny `embedding`                    |

### Schema — zmiana w modelu Chunk

```prisma
model Chunk {
  id           String                    @id @default(uuid())
  documentId   String
  content      String
  chunkIndex   Int
  searchVector Unsupported("tsvector")?  @map("search_vector")
  embedding    Unsupported("vector(4096)")?
  document     Document                  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  @@map("chunks")
}
```

### Hybrid search — logika (RRF)

```
1. Równolegle: embedText(query) + runFts(AND) + runTrigram(query)
2. Jeśli AND < 3 wyników → runFts(OR) jako fallback
3. FTS+trigram mergowane wagowo (trigram jako secondary z wagą 0.5)
4. Embedding search z cosine similarity
5. Finalne połączenie FTS i embedding przez RRF (k=60) — bez normalizacji rang
6. Zwróć top limit wyników
```

### Zadania

- [x] Dodać `OVH_AI_EMBEDDING_ENDPOINT` do `.env.example` i `.env`
- [x] Zaktualizować `prisma/schema.prisma` — kolumna `embedding vector(4096)` w `Chunk`
- [x] Uruchomić migracje: `add-embeddings` + `resize-embedding-4096`
- [x] Utworzyć `src/server/ai/embeddings.ts` — funkcja `embedText(text: string): Promise<number[]>`
- [x] Zaktualizować `scripts/seed.ts` — generować embedding per chunk, zapisywać przez `$executeRaw`
- [x] Zaktualizować `src/modules/search/utils/search.ts` — dodać `runEmbedding()` + hybrid merge (RRF)
- [x] Uruchomić `npm run db:seed` — 118/118 chunków z embeddingami
- [x] Przetestować zapytania semantyczne — "rodzaje klątw" → trafia w "Poziomy Klątw" ✓
- [x] `tsc --noEmit` + `npm run build` — zero błędów

---

## Decyzje — podjęte

| #   | Pytanie                | Decyzja                                                                                   |
| --- | ---------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Renderowanie markdown  | `react-markdown` — używane w docs panelu **i** w bąbelkach czatu (odpowiedzi AI)          |
| 2   | Nazwa koloru w Mantine | `mangetsu`                                                                                |
| 3   | Logo w topbarze        | Tekst nieselektowalny (`user-select: none`)                                               |
| 4   | Wyszukiwanie chunków   | PostgreSQL full-text search (tsvector) — FTS przez `prisma.$queryRaw`                     |
| 5   | Odpowiedź API          | Jednorazowa (nie streaming) — prostsze, typing indicator zostaje                          |
| 6   | Rate limiting          | Per IP z nagłówka `X-Forwarded-For`                                                       |
| 7   | ORM                    | Prisma — typy z automatu, migracje przez CLI                                              |
| 8   | Embedding model        | `Qwen3-Embedding-8B` (OVH AI Endpoints) — wymiary 4096 (domyślne)                         |
| 9   | Hybrid search merge    | RRF (Reciprocal Rank Fusion, k=60) — lepszy niż ważone summy bo nie wymaga normalizacji   |
| 10  | Brak HNSW index        | pgvector HNSW max 2000 dims, mamy 4096 — sequential scan wystarczy przy ~100-200 chunkach |

---

## Znane ograniczenia platformy

**Discord OAuth nie otwiera natywnej appki przy logowaniu (desktop i mobile).** Discord
celowo blokuje deep-linking do natywnej aplikacji dla standardowego logowania
(`identify`/`email` scope, używanego przez `next-auth/providers/discord`) — mechanizm ten
działa wyłącznie dla flow bez callbacku do zewnętrznej strony, np. zaproszenia bota na
serwer (`bot`/`applications.commands` scope), które kończy się całkowicie wewnątrz Discorda.
Standardowe logowanie wymaga, żeby Discord odesłał użytkownika z powrotem do konkretnej
karty przeglądarki trzymającej stan sesji (cookies, CSRF token) — deep-linking uniemożliwiłby
to odesłanie i zerwałby flow. Potwierdzone przez staff Discorda:
[discord-api-docs#7259](https://github.com/discord/discord-api-docs/discussions/7259),
[discord-api-docs#1296](https://github.com/discord/discord-api-docs/issues/1296).

Nie ma możliwej zmiany kodu, konfiguracji NextAuth ani ustawień w Discord Developer Portal,
która by to naprawiła. Workaround w `DiscordSignInButton.tsx` (`<form>` + Server Action
zamiast klienckiego `signIn()`, zachowujący synchroniczny user-gesture) zostaje — ma sens
jako próba dla mobilnych Universal Links/App Links, ale nie gwarantuje deep-linkingu i nie
dotyczy tego ograniczenia.

---

## Kolejność implementacji (rekomendowana)

```
Faza 1 → Faza 2 → Faza 3 → Faza 4 → Faza 5 → Faza 6 → Faza 7 → Faza 8 → Faza 9 → Faza 10 → Faza 11
```

Każda faza jest niezależna — można zatwierdzać i commitować po kolei.
