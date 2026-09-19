# Production audit — OpenCloser v2 (раунд 3)

**Дата:** 2026-09-18  
**Гілка:** `hoplite/elis-8588c4bf` (локальна, не пушена)  
**Метод:** незалежний прогін усіх гейтів + код-аудит недопрацювань iter-1..6.

**Висновок: 76/100 — «internal demo / operator workstation»: запускається, але не ready для клієнтів.** Кап 84 лишається: live API E2E не проганявся, Windows-інсталера (MSVC) немає.

## Гейти (незалежний прогін, ця машина — Linux sandbox)

| Перевірка | Результат |
|---|---|
| `npm run lint` (tsc --noEmit) | **0 помилок** |
| `npm test` (Vitest) | **163 passed / 1 skipped** (21 файл; +6 нових sim-violations) |
| `npm run build` (Vite) | **OK** (~7 c) |
| `npm audit` / `--omit=dev` | **0 / 0** |
| `cargo test -p hiring-core` | **33/33** |
| `cargo test -p kb-core` (юніти) | **14/14** |
| `cargo test -p kb-core --test acceptance` | **SKIP з повідомленням** (див. нижче) |
| `cargo check` (app-crate, Linux) | **0 помилок** (5m 42s) |

## Знайдені недопрацювання та фікси цього раунду

### 1. KB-сівинг не працював на чистому checkout (P0, виправлено)
- `seed_dir()` шукав `src-tauri/../../knowledge/recruitment/transcripts` — шлях легасі pack-рута Windows-машини, якого в git-checkout не існує. Наслідок: **свіжий релізний білд засівав 0 документа**.
- `courses.json` був жорстко прив'язаний до наявності transcripts-директорії: без транскриптів каталог курсів теж не сіявся.
- **Фікс (`src-tauri/src/ai/kb.rs`):** розв'язок шляху — спершу repo-checkout (`<project>/knowledge/recruitment`), потім легасі pack-root, env-override збережено (приймає і директорію recruitment, і напряму transcripts); transcripts і courses сіються **незалежно**.

### 2. Acceptance-тест kb-core падав на чистому checkout (P0, виправлено)
- Тест шукав корпус транскриптів на 4 рівні вище crate (pack-root), а сам корпус (`knowledge/recruitment/transcripts/*.txt`) **ніколи не був закомічений у git** — він існував лише локально на Windows-хості.
- **Фікс (`crates/kb-core/tests/acceptance.rs`):** правильний repo-шлях + легасі fallback; коли корпусу немає — тест пише `SKIP: recruitment transcript corpus not present` і проходить (патерн configs-parity). Коли корпус повернуть у репо — тест знову реально перевіряє ранжування `vHG4m5ptmJs`.

### 3. Readiness-gate критерій «вигадана статистика» був мертвим (P1, виправлено)
- `ObjectionTrainer.generateScore` писав `fabricatedStatViolation: false` хардкодом: критерій «жодного порушення в останніх 5 симуляціях» міг спрацювати тільки від job-promise. Виявлення вигаданих цифр (`extractStatClaims` + `flagUnverifiedClaims`, з boundary-check з iter-2 review) існувало, але не було підключене до сим-трекера.
- **Фікс:** новий `src/features/copilot/sim-violations.ts` — `detectSimViolations(userTexts)` перевіряє stat-клейми репа проти KB (та ж семантика, що й живий CoachAgent: немає grounding-чанків → не порушення; KB недоступний → не порушення). ObjectionTrainer тепер годує gate реальними флагами. Тести: `src/test/sim-violations.test.ts` (6 кейсів).

### 4. `cancel_agy_agent` була зареєстрована, але без UI (P3, виправлено)
- Rust-команда існувала з iter-AGY, кнопки не було. **Фікс:** «Зупинити worker» у `AgyTeamView` (активна поки job `queued`/`running`).

### 5. Мертвий код і дрібниці (P3, виправлено)
- `ROUTES` у `constants.ts` — неімпортований експорт (видалено).
- README чесно документує, що transcripts-корпус — локальний content pack **поза git**, сівинг курсів від нього не залежить.

## Що далі не зроблено (чесні блокери)

| # | Блокер | Статус |
|---|---|---|
| 1 | **Transcripts-корпус не в git** | Дані лежать на Windows-хості (`G:/agency/opencloser-v2/knowledge/recruitment/transcripts`). Треба скопіювати в `knowledge/recruitment/transcripts/` і закомітити — інакше KB живиться лише курсами, а acceptance-тест скіпається. |
| 2 | **MSVC + Windows-інсталер** | Не зроблено; GNU-target не дає PE ordinal >65535 для packaged binary. Потрібен admin-install VS Build Tools + `npx tauri build` на msvc. |
| 3 | **Live API E2E** (Gemini/OpenAI Realtime/ElevenLabs/Deepgram) | Ніколи не проганявся з throwaway-ключами. |
| 4 | **Code signing** | Відсутній. |
| 5 | **Hiring vertical iter-6..9** (P1 spec) | Готово iter-5 (v8-схема, vacancy/candidate/pipeline команди, VacancyIntake, Hiring nav). Лишається: ScreeningRoom (step rail/autofill/talk-ratio), screening_start/complete_step/finish, scorecard_submit, candidate_gdpr_delete, Copilot `vacancy_id` фільтр, VacancyPipeline + SLA, RecruiterProgress. |
| 6 | Touch-флаги pipeline (`reply_received`, `contact_attempts`, `slot_confirmed`) | Зафіксовані як unmet у `pipeline_move` — даних-джерела поки немає (пояснено в коментарі коду). |

## Що перевірено і підтримується зеленим

- Demo/Live split, keychain (secrets.rs + secure-keys.ts; в продовому `src/` немає API-key localStorage-записів), CSP + relay-токен на сокеті, DNC/consent-гейт (`assert_lead_callable` у WarRoom, Dial заблоковано), readiness-gate → shadow mode у CopilotView, sim-запис у ObjectionTrainer, hiring-core 33 тести, schema v8 (vacancies/candidates/candidate_pipeline/screening_sessions/scorecards + `kb_chunks.vacancy_id/doc_type`), парність контент-паку (configs-parity).

## Наступний крок

Скопіювати transcripts-корпус з Windows-хосту в `knowledge/recruitment/transcripts/`, закомітити — і acceptance-тест KB знову стане обов'язковим. Це найдешевший хід, що закриває найбільшу прогалину даних.
