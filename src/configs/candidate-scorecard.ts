// Typed runtime copy of knowledge/recruitment/candidate-scorecard.json.

export type ScoreValue = 0 | 1 | 2 | 3;

export interface CriterionDef {
  id: "motivation" | "time" | "budget" | "readiness" | "decision";
  title: string;
  levels: [string, string, string, string];
}

export interface ScoreBandDef {
  band: "A" | "B" | "C" | "D";
  min: number;
  max: number;
  action: string;
}

export const SCORECARD_CRITERIA: CriterionDef[] = [
  {
    id: "motivation",
    title: "Мотивація",
    levels: ["не сформульована", "загальна («цікаво»)", "чітка ціль", "ціль + дедлайн + причина «зараз»"],
  },
  {
    id: "time",
    title: "Час",
    levels: ["<3 год/тиждень", "3–5 год/тиждень", "6–10 год/тиждень", "10+ год/тиждень і є розклад"],
  },
  {
    id: "budget",
    title: "Бюджет",
    levels: ["немає і не розглядає", "тільки розстрочка, не підтверджена", "розстрочка підтверджена", "готовий оплатити"],
  },
  {
    id: "readiness",
    title: "Готовність",
    levels: ["не відповідає передумовам", "великий розрив", "базово відповідає", "повністю відповідає"],
  },
  {
    id: "decision",
    title: "Рішення",
    levels: ["вирішує не він", "потрібна згода інших", "він + формальна згода", "вирішує сам"],
  },
];

export const SCORECARD_BANDS: ScoreBandDef[] = [
  { band: "A", min: 12, max: 15, action: "Передавати далі сьогодні" },
  { band: "B", min: 8, max: 11, action: "Nurture + повторний дзвінок" },
  { band: "C", min: 4, max: 7, action: "Розсилка/вебінар" },
  { band: "D", min: 0, max: 3, action: "Ввічлива відмова" },
];
