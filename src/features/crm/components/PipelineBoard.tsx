// ============================================================
// PipelineBoard — search/score filter bar and the Kanban columns.
// ============================================================

import React from "react";
import { Search } from "lucide-react";
import { Lead, LeadStatus } from "../../../types";
import { KanbanColumn } from "./KanbanColumn";

const COLUMNS: LeadStatus[] = [
  "Discovery",
  "Outbound Call",
  "Audit Requested",
  "Closed",
];

interface PipelineBoardProps {
  leads: Lead[];
  searchQuery: string;
  scoreFilter: number;
  onSearchChange: (query: string) => void;
  onScoreFilterChange: (score: number) => void;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onDrop: (e: React.DragEvent, status: LeadStatus) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDial: (lead: Lead) => void;
  onViewDetails: (lead: Lead) => void;
}

export const PipelineBoard = React.memo(function PipelineBoard({
  leads, searchQuery, scoreFilter,
  onSearchChange, onScoreFilterChange,
  onDragStart, onDrop, onDragOver, onDial, onViewDetails,
}: PipelineBoardProps) {
  const leadsByColumn = React.useMemo(() => {
    const columns: Record<LeadStatus, Lead[]> = {
      "Discovery": [],
      "Outbound Call": [],
      "Audit Requested": [],
      "Closed": [],
    };
    const normalizedQuery = searchQuery.toLowerCase();

    for (const lead of leads) {
      const matchesSearch =
        !normalizedQuery ||
        lead.name.toLowerCase().includes(normalizedQuery) ||
        lead.company.toLowerCase().includes(normalizedQuery);
      if (matchesSearch && lead.score >= scoreFilter) {
        columns[lead.status].push(lead);
      }
    }
    return columns;
  }, [leads, searchQuery, scoreFilter]);

  return (
    <div className="flex gap-5 h-full items-start flex-col">
      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 w-full shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <label htmlFor="pipeline-search" className="sr-only">Search leads</label>
          <input
            id="pipeline-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads…"
            className="input-field"
            style={{ paddingLeft: 40 }}
          />
        </div>
        <div className="flex items-center gap-1">
          {[0, 70, 80, 90].map((score) => (
            <button
              key={score}
              onClick={() => onScoreFilterChange(scoreFilter === score ? 0 : score)}
              className="btn-ghost"
              style={{
                fontSize: 12,
                padding: "6px 12px",
                fontFamily: "var(--font-mono)",
                background: scoreFilter === score && score > 0 ? "var(--accent-coral-light)" : undefined,
                borderColor: scoreFilter === score && score > 0 ? "var(--accent-coral-medium)" : undefined,
                color: scoreFilter === score && score > 0 ? "var(--accent-coral)" : undefined,
              }}
            >
              {score === 0 ? "All" : `${score}+`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-5 flex-1 items-start w-full overflow-x-auto pb-2">
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            leads={leadsByColumn[status]}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDial={onDial}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>
    </div>
  );
});
