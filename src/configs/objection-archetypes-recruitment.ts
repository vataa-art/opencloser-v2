// Typed runtime copy of knowledge/recruitment/objection-archetypes-recruitment.json.

export interface RecruitmentArchetype {
  id: string;
  label: string;
  triggers: string[];
  core_response: string;
  framework: string;
  urgency: "low" | "medium" | "high";
}

export const RECRUITMENT_ARCHETYPES: RecruitmentArchetype[] = [
  {
    id: "expensive",
    label: "«Дорого»",
    triggers: ["дорого", "не по бюджету", "дорогий", "ціна", "дорого коштує", "дорожче"],
    core_response: "Розкласти на вартість місяця / порівняти з ціною бездіяльності",
    framework: "Monthly Cost Reframe",
    urgency: "high",
  },
  {
    id: "no_time",
    label: "«Немає часу»",
    triggers: ["немає часу", "не маю часу", "зайнятий", "завантажений", "ніколи не встигаю"],
    core_response: "Реальний тайм-бокс + приклад графіка студента, який працював",
    framework: "Realistic Time-box + Student Schedule Proof",
    urgency: "high",
  },
  {
    id: "job_guarantee",
    label: "«Чи гарантуєте роботу?»",
    triggers: ["гарантує", "гарантія", "гарантуєте роботу", "буде робота"],
    core_response: "Ніяких гарантій. Тільки факти з KB + що саме дає школа",
    framework: "Honest Facts + School Value",
    urgency: "medium",
  },
  {
    id: "let_me_think",
    label: "«Подумаю»",
    triggers: ["подумаю", "мені треба подумати", "я подумаю"],
    core_response: "Прояснити, що саме незрозуміло; домовитись про дату",
    framework: "Clarify + Date Commit",
    urgency: "medium",
  },
];
