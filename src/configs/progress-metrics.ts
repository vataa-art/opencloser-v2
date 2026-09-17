// Typed runtime copy of knowledge/recruitment/progress-metrics.json.

export interface MetricDef {
  id: string;
  title: string;
  note?: string;
}

export const PERSONAL_METRICS: MetricDef[] = [
  {
    id: "avg_sim_score_week",
    title: "Середній бал симуляцій за тиждень",
  },
  {
    id: "talk_ratio",
    title: "Talk-ratio",
    note: "потрібен другий аудіо-канал (друга хвиля)",
  },
  {
    id: "stage4_fill_rate",
    title: "% дзвінків із заповненим етапом 4",
  },
  {
    id: "next_step_rate",
    title: "% дзвінків із конкретним next step",
  },
  {
    id: "failed_archetypes",
    title: "Які архетипи провалює",
  },
  {
    id: "kb_usage_per_call",
    title: "Скільки разів звертався до KB під час дзвінка",
  },
];

export const MANAGER_METRICS: MetricDef[] = [
  {
    id: "newbie_ranking",
    title: "Рейтинг новачків за метриками",
    note: "потребує багатокористувацького бекенда — друга хвиля",
  },
  {
    id: "auto_flags",
    title: "Автофлаг дзвінків: блок на обіцянки або talk-ratio >75%",
  },
];

export const WEEKLY_SUMMARY_NOTE: string = "Щотижня — автозведення «топ-3 що покращити»";
