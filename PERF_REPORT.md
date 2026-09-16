# OpenCloser performance report

## Зміни

- `src/features/crm/components/PipelineBoard.tsx`: компонент мемоізовано через `React.memo`; фільтрація лідів виконується одним проходом і кешується через `useMemo`, після чого кожна колонка отримує стабільний масив.
- `src/features/crm/components/KanbanColumn.tsx`: колонка мемоізована через `React.memo`. Довгі Kanban-колонки вже не використовують `stagger-children`.
- `src/features/crm/components/KanbanBoard.tsx`: стабілізовано callbacks для toast, drag-and-drop, dial, power dialing і переходу до деталей через `useCallback`. Toast-оновлення більше не змушує весь PipelineBoard і його картки перебудовуватися.
- `src/features/voice/components/WarRoom.tsx`: persona читається один раз через наявний `useMemo`; побудова system prompt і запуск engine використовують цей об'єкт без повторного `loadPersona()`. Аналіз емоцій та objection detection працюють лише по останніх 20 рядках. Emotion-related state оновлюється одним state update. Панелі Transcript/Intel мемоізовані, coaching hints перераховуються лише при зміні transcript, framework або переході межі 5 хвилин.
- `src/features/voice/lib/pcm.ts`: додано декодер PCM16 з native `Uint8Array.fromBase64`, коли його надає WebView; compatibility fallback зберігає попередній формат аудіо. Playback queue більше не використовує `Array.shift()` і очищується після планування chunks.
- `src/features/voice/components/warroom/TranscriptPanel.tsx` та `IntelPanel.tsx`: додано `React.memo`, щоб секундний timer War Room не перемальовував незмінні панелі.
- `src/index.css`: прибрано нескінченну `box-shadow`-анімацію `pulseGlow` та її клас. `VoiceVisualizer` уже мав потрібну поведінку: rAF запускається лише при `isActive`, малювання використовує solid strokes без градієнтів. `LeadCard` уже містив статичний статус `Queued for call`, тому pulse не додавався.
- `src/test/pcm.test.ts`: додано 2 тести на точне збереження signed PCM16 і сумісність з попередньою обробкою непарного байта.

## Чому це зменшує main-thread роботу

Toast і timer тепер змінюють лише компоненти, яким справді потрібен новий стан. Мемоізовані board/columns/cards уникають повторної побудови DOM для незмінених лідів, а фільтрація не створює чотири незалежні проходи по всьому масиву.

War Room більше не запускає повний transcript scan: emotion та objections обмежені останніми 20 рядками, а пов'язані state updates зведені до одного оновлення. Native base64 decoder прибирає проміжний binary string і per-byte `charCodeAt` у сучасному WebView; індексована черга також прибирає O(n) `shift()` для аудіо chunks.

## Перевірка

- `unset PYTHONPATH PYTHONHOME VIRTUAL_ENV; npm run lint` — PASS.
- `unset PYTHONPATH PYTHONHOME VIRTUAL_ENV; npm test` — PASS: 11 test files, 73 tests.
- `unset PYTHONPATH PYTHONHOME VIRTUAL_ENV; npm run build` — PASS: 1733 modules transformed.
- До змін baseline: 10 test files, 71 tests; build CSS 88.03 kB / gzip 14.34 kB.
- Після змін build CSS 87.86 kB / gzip 14.29 kB.
- `npx tauri build` не запускався. MSVC не встановлювався. Live Gemini/OpenAI/ElevenLabs API не викликалися.

## Залишкові ризики лагів

- У War Room залишаються статичні `backdrop-blur-xl` і великий ambient `blur-[180px]`; вони не належать до scrolling lists, але можуть бути дорогими на слабких GPU.
- Transcript feed досі монтує всі рядки без virtualisation; для дуже довгих live-call transcript варто додати bounded window або virtual list.
- На старих WebView без `Uint8Array.fromBase64` працює compatibility fallback з `atob`; там base64 decode залишається CPU-витратою.
- Два visualizer rAF-потоки працюють під час активного дзвінка; вони вже не працюють у idle, але подальший бюджет можна зменшити throttling до display rate або знизити кількість samples.
