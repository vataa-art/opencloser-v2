import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  ExternalLink,
  GraduationCap,
  PlayCircle,
} from "lucide-react";

export interface RecruitmentCourse {
  id: string;
  title: string;
  publisher: string;
  channel_url: string;
  url: string;
  kind: "playlist" | "video";
  language: string;
  lessons: number | null;
  duration_hint: string;
  topics: string[];
  coverage: string[];
  verified_alive: boolean;
  transcript_likelihood: "high" | "medium" | "low";
  risk?: string;
}

// Mirrors G:\agency\opencloser-v2\knowledge\recruitment\courses.json
// (verified with yt-dlp, 2026-09-16). Keep both in sync when updating.
export const RECRUITMENT_COURSES: RecruitmentCourse[] = [
  {
    id: "juhas-technical-foundation",
    title: "Technical Foundation For IT Recruiters",
    publisher: "AI with Michal Juhas",
    channel_url: "https://www.youtube.com/@michal-juhas",
    url: "https://www.youtube.com/playlist?list=PLokCw8elrMIT3y8Spu-fd-igr0ISraXES",
    kind: "playlist",
    language: "en",
    lessons: 56,
    duration_hint: "~6.5 h · 56 short lessons",
    topics: ["recruiting foundations", "IT terminology", "SDLC", "Agile / Scrum / Kanban", "tech roles"],
    coverage: ["foundations"],
    verified_alive: true,
    transcript_likelihood: "high",
  },
  {
    id: "juhas-workshops",
    title: "IT Recruiting Training & Workshops",
    publisher: "AI with Michal Juhas",
    channel_url: "https://www.youtube.com/@michal-juhas",
    url: "https://www.youtube.com/playlist?list=PLokCw8elrMITnWhEJEhHtvzpw2-uk-98R",
    kind: "playlist",
    language: "en",
    lessons: 8,
    duration_hint: "~9 h · long-form workshops",
    topics: ["sourcing", "Google X-Ray", "GitHub sourcing", "LinkedIn screen-share", "technology market"],
    coverage: ["sourcing"],
    verified_alive: true,
    transcript_likelihood: "high",
  },
  {
    id: "juhas-linkedin",
    title: "Recruit on LinkedIn (screen-share session replays)",
    publisher: "AI with Michal Juhas",
    channel_url: "https://www.youtube.com/@michal-juhas",
    url: "https://www.youtube.com/playlist?list=PLokCw8elrMIRV8Ee6aauJyPrn1QCerqd5",
    kind: "playlist",
    language: "en",
    lessons: 5,
    duration_hint: "~5 h · role-by-role sourcing replays",
    topics: ["sourcing", "LinkedIn Recruiter", "boolean search", "Java / C# / Azure / JS roles"],
    coverage: ["sourcing"],
    verified_alive: true,
    transcript_likelihood: "high",
  },
  {
    id: "juhas-faq",
    title: "FAQs from Tech Recruiters",
    publisher: "AI with Michal Juhas",
    channel_url: "https://www.youtube.com/@michal-juhas",
    url: "https://www.youtube.com/playlist?list=PLokCw8elrMIQb3cK13ZCNqvEezs8RagzV",
    kind: "playlist",
    language: "en",
    lessons: 9,
    duration_hint: "~1.5 h · 5–12 min answers",
    topics: ["screening", "CV review", "hard-to-fill roles", "salary objections", "tech assessments"],
    coverage: ["screening", "candidate_experience_compliance"],
    verified_alive: true,
    transcript_likelihood: "high",
  },
  {
    id: "juhas-weekly",
    title: "Weekly Chat On Tech Recruitment",
    publisher: "AI with Michal Juhas",
    channel_url: "https://www.youtube.com/@michal-juhas",
    url: "https://www.youtube.com/playlist?list=PLokCw8elrMISgpM8ke5cUej_IHyYLBpb3",
    kind: "playlist",
    language: "en",
    lessons: 8,
    duration_hint: "~1.5 h · operations talk",
    topics: ["recruitment operations", "agency building", "recruiter onboarding", "strategies"],
    coverage: ["metrics_operations"],
    verified_alive: true,
    transcript_likelihood: "high",
  },
  {
    id: "skilldeck-hr",
    title: "SkillDeck HR/Recruitment playlists (KPI, Manpower Planning, Social Media Sourcing, HR Compliance)",
    publisher: "SkillDeck",
    channel_url: "https://www.youtube.com/channel/UCKKpG41M4yHhV3z0WL8wEzw",
    url: "https://www.youtube.com/channel/UCKKpG41M4yHhV3z0WL8wEzw/playlists",
    kind: "playlist",
    language: "en",
    lessons: null,
    duration_hint: "short-form topic playlists",
    topics: ["recruitment metrics", "KPI", "manpower planning", "social media sourcing", "HR compliance"],
    coverage: ["metrics_operations", "candidate_experience_compliance"],
    verified_alive: true,
    transcript_likelihood: "medium",
    risk: "Narrow playlists of short videos, not one structured course. Fills the metrics/compliance gap.",
  },
];

const COVERAGE_LABELS: Record<string, string> = {
  foundations: "Foundations",
  sourcing: "Sourcing",
  screening: "Screening",
  interviewing: "Interviewing",
  candidate_experience_compliance: "CX & Compliance",
  metrics_operations: "Metrics & Ops",
};

const FILTERS = ["All", ...Object.values(COVERAGE_LABELS)];

interface RecruitmentKnowledgeViewProps {
  onBack?: () => void;
}

export function RecruitmentKnowledgeView({ onBack }: RecruitmentKnowledgeViewProps) {
  const [filter, setFilter] = useState("All");

  const visible = RECRUITMENT_COURSES.filter(
    (c) => filter === "All" || c.coverage.some((k) => COVERAGE_LABELS[k] === filter)
  );
  const totalLessons = RECRUITMENT_COURSES.reduce((n, c) => n + (c.lessons ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-2">
        <div>
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-11 h-11 rounded-2xl bg-[#1A1D20] text-white flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight" style={{ letterSpacing: "-0.03em" }}>
                Recruitment Academy
              </h1>
              <p className="text-[13px] text-gray-500 font-medium">
                Free, publicly accessible YouTube courses for technical recruiting — curated into the
                knowledge base.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 bg-white rounded-full px-4 py-2.5 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <BookOpen className="w-4 h-4 text-gray-400" />
          <span className="text-[13px] font-bold text-gray-900">{RECRUITMENT_COURSES.length} courses</span>
          <span className="text-[13px] text-gray-400">·</span>
          <span className="text-[13px] font-semibold text-gray-500">{totalLessons}+ lessons</span>
        </div>
      </div>

      <p className="text-[11px] font-mono text-gray-400 uppercase tracking-wider mb-6 pl-1">
        Sources verified with yt-dlp · 2026-09-16 · free public access (not open-licensed)
      </p>

      {/* Coverage filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${
              filter === f
                ? "bg-[#1A1D20] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-100 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Course cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visible.map((course) => (
          <a
            key={course.id}
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-200 p-7 flex flex-col"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold text-gray-900 leading-snug group-hover:text-[#FF5C39] transition-colors" style={{ letterSpacing: "-0.01em" }}>
                  {course.title}
                </h2>
                <p className="text-[13px] text-gray-500 font-medium mt-1">{course.publisher}</p>
              </div>
              <PlayCircle className="w-8 h-8 text-gray-200 group-hover:text-[#FF5C39] transition-colors shrink-0" />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {course.coverage.map((k) => (
                <span
                  key={k}
                  className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full"
                >
                  {COVERAGE_LABELS[k] ?? k}
                </span>
              ))}
              {course.topics.slice(0, 3).map((t) => (
                <span key={t} className="text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-100 px-2.5 py-1 rounded-full">
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-auto flex items-center gap-4 text-[12px] text-gray-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {course.duration_hint}
              </span>
              <span className="ml-auto flex items-center gap-1 text-gray-300 group-hover:text-[#FF5C39] transition-colors font-semibold">
                Open <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>

            {course.risk && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-4">
                {course.risk}
              </p>
            )}
          </a>
        ))}
      </div>

      {/* Knowledge base pointer */}
      <div className="mt-10 bg-white rounded-3xl border border-gray-100 p-6 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <BookOpen className="w-4.5 h-4.5 text-gray-500 w-[18px] h-[18px]" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-gray-900">Local knowledge base</h3>
          <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
            Cleaned lesson transcripts and the full course manifest live in
            <code className="mx-1.5 px-1.5 py-0.5 bg-gray-50 border border-gray-100 rounded text-[12px] font-mono">G:\agency\opencloser-v2\knowledge\recruitment\</code>
            — courses.json plus transcripts/*.txt for ingestion into AI caller context and objection playbooks.
          </p>
        </div>
      </div>
    </div>
  );
}
