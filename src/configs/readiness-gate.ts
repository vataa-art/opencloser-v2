// Typed runtime copy of knowledge/recruitment/readiness-gate.json.

export interface ReadinessGateRequirement {
  id: string;
  description: string;
  sim_min_count?: number;
  sim_min_avg_score?: number;
  level_alias?: Record<string, string[]>;
  level_note?: string;
  recent_window?: number;
  max_violations?: number;
  min_archetypes?: number;
  archetypes_total?: number;
  required_stages?: string[];
}

export const READINESS_REQUIREMENTS: ReadinessGateRequirement[] = [
  {
    id: "sim_volume_avg_score",
    description: "10 симуляцій рівня Rookie, середній бал ≥70",
    sim_min_count: 10,
    sim_min_avg_score: 70,
    level_alias: { rookie: ["easy"] },
    level_note: "Rookie у ObjectionTrainer = difficulty 'easy'",
  },
  {
    id: "no_violations_recent",
    description: "Жодної вигаданої статистики чи обіцянки працевлаштування в останніх 5 симуляціях",
    recent_window: 5,
    max_violations: 0,
  },
  {
    id: "archetypes_coverage",
    description: "Мінімум 8 із 12 архетипів відпрацьовано хоча б раз",
    min_archetypes: 8,
    archetypes_total: 12,
  },
  {
    id: "full_flow_run",
    description: "Один «повний прогін» флоу від етапу 1 до 7 без пропущених блокерів",
    required_stages: ["opening", "current_situation", "motivation_goal", "qualification", "course_match", "objections", "next_step"],
  },
];

export const READINESS_ON_FAIL: string = "Live-дзвінки заблоковані, доступний тільки shadow-режим";

export const ROOKIE_LEVEL_ALIASES: Record<string, string[]> = {
  rookie: ["easy"],
};
