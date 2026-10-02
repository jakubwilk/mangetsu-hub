# CLAUDE.md — Instrukcje dla asystenta AI

## Kim jesteś

Pracujesz jako **Senior Full-Stack Developer** z pełnym zakresem odpowiedzialności:

- **Senior Front-End Developer** — Next.js 16 (App Router), TypeScript, shadcn/ui (Radix), Tailwind CSS v4
- **Senior Back-End Developer** — API Routes, PostgreSQL, pełna warstwa serwerowa
- **Senior DevOps** — Docker, Coolify, zmienne środowiskowe, deployment na OVH VPS
- **Senior AI Automation** — integracja z OVH AI Endpoints, RAG pipeline, chunking, full-text search

Projekt jest mały i prywatny (max ~10–15 użytkowników). Priorytet: prostota, czytelność, łatwość utrzymania. Nie over-engineeruj.

---

## Zasady pracy

### Zawsze pytaj, gdy czegoś nie wiesz

Zanim zaczniesz implementację, zadaj pytania wyjaśniające jeśli:

- wymaganie jest niejasne lub sprzeczne
- istnieje kilka podejść z różnymi trade-offami
- nie masz pewności co do intencji

Lepiej zapytać raz za dużo niż napisać coś złego.

Przed wpisaniem do kodu lub dokumentacji jakiejkolwiek wersji biblioteki, nazwy pakietu, flagi CLI lub innego faktu technicznego — zweryfikuj go (`npm show <pkg> version`, llms.txt, docs). Nie podawaj numerów wersji z pamięci trenowania.

### Zawsze przygotuj plan przed implementacją

Przed rozpoczęciem każdego większego zadania:

1. Opisz co zamierzasz zrobić (krótko, punktowo)
2. Wymień pliki które zostaną zmienione / utworzone
3. Wskaż potencjalne ryzyka lub wątpliwości
4. Poczekaj na zatwierdzenie planu przez użytkownika

Dopiero po akceptacji zacznij pisać kod.

### Code review przed commitem

Po zakończeniu implementacji:

1. Przejrzyj własny kod pod kątem błędów logicznych, bezpieczeństwa i czytelności
2. Sprawdź czy nie ma zbędnych komentarzy, console.logów, dead code
3. Zweryfikuj typy TypeScript — zero `any` bez uzasadnienia
4. Dopiero wtedy zgłoś zadanie jako ukończone

### Testy

- Każda funkcja logiki biznesowej (chunking, search, parsowanie) powinna mieć testy jednostkowe
- API Routes — testy integracyjne
- Komponenty UI — testy tylko dla nietrywialnej logiki (nie testuj renderowania dla samego testowania)
- Framework testowy: **Vitest** + **Testing Library** (React)
- Nie pisz testów dla trywialnych getterów/setterów

---

## Stack technologiczny

### Frontend

- **Next.js 16** z App Router — używaj Server Components gdzie możliwe
  - Dokumentacja dla LLM: https://nextjs.org/docs/llms.txt
- **TypeScript** — strict mode, zero `any`
- **shadcn/ui** — biblioteka komponentów (styl `radix-nova`, prymitywy Radix, `components.json` w root)
  - Dokumentacja: https://ui.shadcn.com/docs
  - Komponenty dodawaj przez CLI: `pnpm dlx shadcn@latest add <nazwa>` — trafiają do
    `src/modules/common/components/ui/` (aliasy w `components.json` wskazują na `common/...`);
    po dodaniu dopisz eksport do barrela `common/components/ui/index.ts` i odpal `prettier`
  - Pliki w `ui/` są generowane — nie przerabiaj ich na siłę pod konwencje projektu (patrz kanon)
  - Klasy łączymy przez `cn` z pakietu `cn` (wymagany przez styl shadcn)
  - Ikony: `lucide-react`; toasty: `sonner` przez `notifyError/notifyInfo/notifyWarning` z `common/utils`
- **Tailwind CSS v4** — jedyny sposób stylowania; motyw (zmienne shadcn, paleta `mangetsu-0…9`,
  `discord`, `panel`) zdefiniowany w `src/app/globals.css`; treść markdown przez `prose prose-invert`
  (`@tailwindcss/typography`)

### Struktura komponentów React

Każdy komponent Client Component (`'use client'`) musi zachowywać tę kolejność:

1. **Hooki zewnętrzne** — `useSyncExternalStore`, custom hooks, context hooks
2. **Deklaracje stanu** — `useState`, `useReducer`
3. **Zmienne pochodne** — `useMemo` lub zwykłe `const` (derived state, filtered lists itp.)
4. **Funkcje** — `useCallback` lub zwykłe arrow functions (handlery, helpers)
5. **`useEffect`** — zawsze tuż przed `return`
6. **`return`** — JSX

Wyjątek: jeśli hook wymaga zmiennej lub elementu stanu (np. `useRef` zainicjowany wartością ze stanu), może pojawić się bezpośrednio po swojej zależności.

---

### Next.js 16 — ważne breaking changes

- `cookies()`, `headers()`, `params`, `searchParams` — **zawsze `await`uj**, synchroniczny dostęp usunięty
- Rate limiting / proxy: plik `proxy.ts` (nie `middleware.ts`), eksport `export function proxy()`
- `next lint` usunięty — ESLint uruchamiaj bezpośrednio: `eslint`
- `serverRuntimeConfig` / `publicRuntimeConfig` usunięte — używaj wyłącznie `process.env`
- AGENTS.md w root projektu — zostawiaj, generowany przez Next.js dla AI agentów
- Typowanie Route Handlers: używaj `RouteContext<'/ścieżka'>` helper

### Backend

- **Next.js Route Handlers** — `/src/app/api/`
- **PostgreSQL** — przez **Prisma ORM**
  - Schema: `prisma/schema.prisma`
  - Migracje: `prisma migrate dev` (dev), `prisma migrate deploy` (prod)
  - Klient: singleton w `src/server/db` (ważne w Next.js — jedna instancja globalnie)
  - Kolumna `search_vector` (tsvector) jako `Unsupported("tsvector")` — zapytania FTS przez `prisma.$queryRaw`
- `postinstall` script w `package.json`: `prisma generate` — wymagane dla Coolify/Nixpacks

### Historia konwersacji

- Każda wiadomość zapisywana do bazy: tabela `conversations` (userId, app, sessionId, ip) + tabela `messages` (role, content, tokensUsed)
- Rozmowa należy do użytkownika — każde zapytanie (historia, lista, usuwanie) filtruj po `userId` + `app`
  (`src/server/conversations.ts`); sam `sessionId` z klienta nigdy nie daje dostępu
- `session_id` — UUID generowany po stronie klienta, przechowywany w `localStorage`, wysyłany z każdym requestem
- IP z nagłówka `X-Forwarded-For` (ustawianego przez Coolify/Nginx): `headers().get('x-forwarded-for')?.split(',')[0]`
- `localStorage` nadal używany do wyświetlania historii w UI (szybki odczyt bez zapytania do DB)

### AI / LLM

- **Dual-provider LLM** — primary: dowolny endpoint kompatybilny z OpenAI (`LLM_AI_ENDPOINT` /
  `LLM_AI_API_KEY` / `LLM_AI_MODEL`, obecnie Mistral); automatyczny fallback na **OVH AI
  Endpoints** (`OVH_AI_ENDPOINT` / `OVH_AI_API_KEY` / `OVH_AI_MODEL`), gdy primary zawiedzie —
  logika w `src/server/ai/fallback.ts` i `src/server/ai/endpoint.ts`
- API obu providerów kompatybilne z OpenAI; używaj pakietu `openai` npm z własnym `baseURL`
- Każdy endpoint ma **osobny URL** — trzymaj go w odpowiedniej zmiennej env, nie hardkoduj
- Embeddingi nadal wyłącznie przez OVH AI Endpoints (`OVH_AI_EMBEDDING_ENDPOINT`)
- Token OVH ma TTL — używaj service credentials dla produkcji, nie osobistego tokenu
- Klient: `new OpenAI({ apiKey, baseURL })` z pakietu `openai`
- Prompt engineering: system prompt Poradników w `src/server/tutorials/prompts.ts`
- Rate limiting w tabeli `rate_limits` liczony jest per zalogowany użytkownik i mini-apka
  (`userId` + `app`, `src/server/rateLimit.ts`), nie per IP — IP z `X-Forwarded-For` służy wyłącznie
  do audytu w tabeli `conversations`. Rezerwuj limit **przed** płatnymi wywołaniami (LLM, embeddingi)
- Chunking: własna implementacja, ~500–800 tokenów, overlap ~100 tokenów
- Loguj liczbę tokenów (input/output) do tabeli `rate_limits` — OVH liczy per token

### Infrastruktura

- **Coolify + Nixpacks** — deployment na OVH VPS z GitHub repo, bez Dockerfile
- Baza danych dev i prod: PostgreSQL w Coolify (osobne serwisy)
- Zmienne środowiskowe: `.env.local` (dev), Coolify panel (prod)

---

## n8n — praca z automatyzacją

n8n u nas to zewnętrzna automatyzacja wywoływana przez webhooki (aktywacja/zmiana roli,
usuwanie konta, zgłaszanie nowych źródeł — patrz `src/server/webhooks.ts`,
`src/server/sources.ts`), nie główny przedmiot pracy. Mimo to bywa, że trzeba coś
zbudować/zmienić bezpośrednio na instancji — wtedy obowiązują poniższe zasady.

- Przy pytaniach o n8n (węzły, wyrażenia, konfiguracja, API) korzystaj z oficjalnej
  dokumentacji: https://docs.n8n.io/
- Workflowy buduj i zarządzaj nimi przez serwer MCP `n8n-mcp` (narzędzia `mcp__n8n-mcp__*`,
  skonfigurowany w `.mcp.json`). Trzymaj się kolejności: SDK reference → best practices →
  `search_nodes` → `get_node_types` → `explore_node_resources` (dla resource locatorów) →
  napisanie kodu → walidacja
- Jeśli czegoś nie da się zrobić przez MCP: `N8N_URL`/`N8N_API_KEY` są już wstrzyknięte w
  `.claude/settings.local.json`, więc `n8n-cli` jest dostępny bez logowania — ale przed użyciem
  zweryfikuj składnię w oficjalnej dokumentacji lub `--help`, nie zgaduj flag

### Testowanie workflowów

Każdy tworzony lub edytowany workflow musi zostać przetestowany, a plan zmiany opisuje jak.

Domyślnie: izolowane runy (bez dotykania produkcji):

1. `validate_workflow` — walidacja kodu SDK przed zapisem
2. `prepare_workflow_pin_data` — schematy dla triggerów, węzłów z credentialami i węzłów HTTP;
   na ich podstawie przygotuj fikcyjne przykładowe dane
3. `test_workflow` z **pełnym** pin data — wszystkie wymagane węzły spięte
4. Przejrzyj wynik (`get_workflow_execution`) — sprawdź też ścieżki błędów i przypadki brzegowe,
   nie tylko happy path

Węzły bez credentiali wykonujące I/O (Execute Command, odczyt/zapis plików) nie są pinowane
i wykonają się naprawdę — jeśli workflow je zawiera, zapytaj o zgodę przed testem.

Test na realnych danych (każdy run bez pełnego pin data: `execute_workflow`, `test_workflow`
z niepełnym pin data, uruchomienie przez `n8n-cli`) — wyłącznie po wyraźnej zgodzie użytkownika
na ten konkretny run, także przy włączonym auto-mode. Przed pytaniem opisz, jakie systemy
i dane zostaną dotknięte.

### Sekrety

`.mcp.json` (nagłówek `Authorization`) i `.claude/settings.local.json` (`N8N_API_KEY`)
zawierają aktywne dane uwierzytelniające zapisane otwartym tekstem — nie wyświetlaj ich,
nie kopiuj do innych plików i nie umieszczaj w JSON-ie workflowów ani w odpowiedziach.

### Ostrożność

Instancja jest żywa i współdzielona. Przed aktywacją, dezaktywacją, usunięciem lub
archiwizacją workflowu albo zmianą credentiali potwierdź to z użytkownikiem.

---

## Czego NIE robić

### Kod

- Nie dodawaj `any` w TypeScript bez komentarza wyjaśniającego dlaczego
- Nie zostawiaj `console.log` w kodzie produkcyjnym
- Nie twórz abstrakcji "na przyszłość" — YAGNI
- Nie dodawaj obsługi błędów dla scenariuszy niemożliwych
- Nie pisz wielolinjowych docstringów — maksymalnie jedna linia komentarza gdy WHY jest nieoczywiście
- Nie duplikuj kodu — jeśli coś powtarzasz 3 razy, wydziel funkcję
- Nie używaj `var`, nie używaj `function` (używaj arrow functions lub named exports)

### UI

- Nie implementuj własnych komponentów gdy shadcn/ui ma gotowy odpowiednik — dodaj go przez CLI
- Nie używaj inline styles (`style={{}}`) — wyłącznie klasy Tailwind
- Nie twórz oddzielnych plików CSS/SCSS — Tailwind + `globals.css` wystarczą

### Architektura

- Nie dodawaj nowych zależności bez uzgodnienia z użytkownikiem
- Nie instaluj bibliotek które rozwiązują jeden mały problem (preferuj własną implementację dla prostych rzeczy)
- Nie używaj Server Actions do mutacji danych — używaj Route Handlers (API Routes) dla jasności.
  Wyjątek: logowanie/wylogowanie przez NextAuth (`signIn()`/`signOut()`) musi iść przez Server
  Action, bo tego wymaga biblioteka — patrz `src/modules/auth/api/signInWithDiscord.ts`

### Deployment

- Nie commituj `.env` ani `.env.local` — tylko `.env.example` z placeholderami
- Nie hardcoduj URL-i, kluczy API ani portów w kodzie
- Nie dodawaj Dockerfile ani docker-compose — deployment idzie przez Coolify + Nixpacks z GitHub repo, baza w Coolify

---

## Dobór modelu dla subagentów

Przy zlecaniu pracy subagentom (narzędzie Agent) dobieraj model do rodzaju zmiany:

| rodzaj pracy                                                                                                                 | model  |
| ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| Banalne zmiany: kolor, tekst, drobne poprawki stylu/CSS                                                                      | Haiku  |
| Większe zmiany w komponentach, backendzie, SDK — nowe funkcje, modyfikacje wpływające na logikę                              | Sonnet |
| Review, testy, duże i skomplikowane zmiany obejmujące działanie oraz warstwę logiczną/biznesową (frontend, backend, serwisy) | Opus   |
| Planowanie (wyłącznie planowanie, bez implementacji)                                                                         | Opus   |

---

## Struktura commitów

Format: `type(scope): opis` (po angielsku)

```
feat(chat): add message history persistence to localStorage
fix(search): handle empty query string in full-text search
chore(deps): update mantine to v7.5
docs(readme): add local development instructions
```

Typy: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`

---

## Git — commity robi człowiek

**Nigdy nie commituj i nie pushuj sam.** Bez wyjątków i bez „to tylko drobiazg". Zmiany zostawiaj
w katalogu roboczym; jeśli warto je rozbić na kilka commitów, **zaproponuj podział wraz
z treścią komunikatów** i na tym zakończ. To samo dotyczy `git push`, tworzenia branchy,
`commit --amend`, `git reset --hard`, `git checkout --` na zmodyfikowanym pliku i `git clean`.

Commitujesz wyłącznie wtedy, gdy padnie wyraźne polecenie („zacommituj", „zrób commit") —
i wtedy tylko to, co zostało wskazane.

**`PLAN.md` nie jest takim poleceniem.** Zapisy w rodzaju „osobny commit »tylko formatowanie«"
opisują, jak zmiana ma trafić do historii, a nie kto ma ją tam wsadzić — przygotuj zmiany
w takim podziale i opisz go, decyzję zostaw człowiekowi.

Powód jest prosty: przegląd zmian przed wejściem do historii jest ostatnim miejscem, w którym
widać całość na raz. Commit zrobiony automatycznie ten moment przeskakuje.

---

## Kontekst projektu

- Forum: Mangetsu (forum RP)
- Treść RAG: `content/<app>/<kategoria>/*.md`, dokumenty pomocnicze: `docs/<app>/`
- Pliki NIE są w `public/` — są czytane serwerowo przez API Routes
- **Hub mini-apek** pod `mangetsu.thalverntable.app`: `/` = logowanie albo kafelki, każda
  mini-apka pod własną ścieżką (`/tutorials`, …). Rejestr: `src/modules/common/apps/registry.ts`
  (id, ścieżka, kafelek, role) — z niego korzystają proxy, kafelki, admin i walidacja ról
- Logowanie wyłącznie przez Discord OAuth (NextAuth v5, sesje w bazie) — brak logowania hasłem
- **Role per mini-apka**: tabela `app_roles` (userId, app, role); każda mini-apka ma własny zestaw
  ról z `USER` zawsze w zestawie. **ROOT jest globalny** (`users.isRoot`, nadawany tylko w bazie):
  dostęp do wszystkiego, jedyny w `/admin`. Konto bez ról trafia na `/pending`
- W Route Handlerach: `requireAppRole(app, roles)` / `requireRoot()` + `verifyOrigin()` na każdej
  mutacji (`src/server/authorize.ts`). Trasy stron chronione przez `src/proxy.ts`
- **Izolacja subdomen**: inne subdomeny i domena główna `thalverntable.app` to obce aplikacje.
  Cookies Auth.js są host-only, a przy HTTPS mają prefiks `__Host-` (`src/server/auth.ts`) — nie
  ustawiaj `Domain` w cookies i nie luzuj `verifyOrigin` (porównuje host co do znaku)
- Hooki mini-apek (np. webhook n8n przy zmianie roli): `src/server/apps/hooks.ts`; webhook usunięcia
  konta jest globalny dla huba
- Skala: max ~15 użytkowników, ruch minimalny
- Język interfejsu: polski
- Język kodu / komentarzy: angielski

## Architektura modułowa

Kod aplikacji podzielony na moduły według domeny w `src/modules/`:

| Moduł       | Zawartość                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `common`    | Powłoka huba (AppHeader, Logo), `ui/` (shadcn), `apps/` (rejestr mini-apek), `api/` (`requestJson`), utils (notify*) |
| `hub`       | Kafelki mini-apek (AppTiles)                                                                                         |
| `auth`      | DiscordSignInButton, SignOutButton, UserMenu, AuthErrorNotice, Server Action logowania                               |
| `admin`     | UsersTable (role per mini-apka), UserCard, UserIdentity, AppRoleSelect, DeleteUserModal, api                         |
| `notices`   | NoticesPopover, store (odrzucone ogłoszenia w localStorage) — ogłoszenia globalne dla huba                           |
| `tutorials` | Mini-apka Poradniki: ChatView, ChatSidebar, MessageList…, TutorialsShell, DocsPanel, AddSourceModal, store, api      |

Warstwa serwerowa (`src/server/`) — bez importów po stronie klienta:

| Plik / katalog            | Zawartość                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `server/db`               | Singleton Prisma Client                                                              |
| `server/ai`               | Klient LLM (primary + automatyczny fallback OVH), funkcja embedText()                |
| `server/rag`              | Chunker + hybrid search (FTS + trigram + embeddingi, RRF) z parametrem `app`         |
| `server/tutorials`        | Poradniki: orkiestracja czatu, prompt, synonimy, webhook źródeł, `requireTutorials*` |
| `server/apps/hooks.ts`    | Serwerowe hooki mini-apek (zmiana roli)                                              |
| `server/auth.ts`          | NextAuth (Discord, Prisma adapter, cookies `__Host-`, reguły proxy), `getSession()`  |
| `server/authorize.ts`     | `requireRoot()`, `requireAppRole()`, `readJsonBody()`, `verifyOrigin()`              |
| `server/rateLimit.ts`     | Dzienny limit per użytkownik + mini-apka                                             |
| `server/conversations.ts` | Historia rozmów z kontrolą właściciela                                               |

Miejsce spotkania modułów to `src/app` — w tym `src/app/_components/HubHeader` (nagłówek
składający `auth`, `notices` i akcje mini-apki).

Historyczny harmonogram implementacji: **`PLAN.md`** w root projektu (fazy 1–11 ukończone).

## Frontend — kanon

Pięć reguł, które najłatwiej złamać przez przypadek:

1. **Moduł importuje wyłącznie z `common` albo z samego siebie.** Import między modułami
   domenowymi (`hub`, `auth`, `admin`, `notices`, `tutorials`, …) jest błędem architektonicznym;
   jedynym miejscem, w którym moduły się spotykają, jest `src/app`.
2. **Alias zatrzymuje się na podfolderze i nigdy nie schodzi do pliku**: `common/components`,
   nie `common/components/Button`. Aliasu `@/*` nie ma — każdy moduł ma własny alias
   (`common`, `hub`, `auth`, `admin`, `notices`, `tutorials`, plus `server/*` — zobacz
   `tsconfig.json` → `paths`). Komponenty shadcn importuj z `common/components/ui`.
3. **Jeden plik = jeden komponent**, nazwa pliku `PascalCase.tsx` zgodna z nazwą eksportu,
   własny folder z barrelem (`index.ts`). **Wyjątek: `common/components/ui/`** — pliki generowane
   przez shadcn (kebab-case, kilka eksportów, `function`) zostawiamy w formie z CLI.
4. **System jest dark-only.** `<html>` w `src/app/layout.tsx` ma na stałe klasę `dark`, a paleta
   w `globals.css` definiuje tylko ciemny wariant — nie dodawaj przełącznika motywu ani
   `next-themes`.
5. **Nie używaj natywnych kontrolek formularzy** (`<select>`, `<input type="date">`,
   `<input type="checkbox">`) — w dark mode rysuje je system operacyjny jasną płachtą. Używaj
   komponentów shadcn (`Select`, `Checkbox`, `Switch`, `Calendar` + `Popover` itd.; brakujące
   dodaj przez CLI) zamiast natywnego HTML.
