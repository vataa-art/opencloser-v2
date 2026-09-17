import { useState } from "react";
import { Briefcase, Check, Plus, X } from "lucide-react";
import {
  isHiringError,
  vacancyCreate,
  vacancyPublishToKb,
  type VacancyInput,
} from "../../../services/hiring";

// ── Draft state (strings kept raw for controlled inputs; parsed on validate) ──

interface VacancyDraft {
  title: string;
  company: string;
  seniority: string;
  must_have: string[];
  salary_min: string;
  salary_max: string;
  currency: string;
  work_format: string;
  location: string;
  english_level: string;
  hiring_manager: string;
  nice_to_have: string[];
  sla_days: string;
}

const EMPTY_DRAFT: VacancyDraft = {
  title: "",
  company: "",
  seniority: "",
  must_have: [],
  salary_min: "",
  salary_max: "",
  currency: "USD",
  work_format: "",
  location: "",
  english_level: "",
  hiring_manager: "",
  nice_to_have: [],
  sla_days: "",
};

/**
 * Mirrors the Rust vacancy_create validator: title, company, work_format,
 * hiring_manager, non-empty must_have, salary_max >= salary_min > 0,
 * sla_days > 0. Returns the missing/violated field keys.
 */
function validateDraft(d: VacancyDraft): string[] {
  const missing: string[] = [];
  if (!d.title.trim()) missing.push("title");
  if (!d.company.trim()) missing.push("company");
  if (!d.work_format) missing.push("work_format");
  if (!d.hiring_manager.trim()) missing.push("hiring_manager");
  if (d.must_have.length === 0) missing.push("must_have");

  const salaryMin = Number(d.salary_min);
  const salaryMax = Number(d.salary_max);
  if (!(salaryMin > 0) || !(salaryMax >= salaryMin)) missing.push("salary_range");

  if (!(Number(d.sla_days) > 0)) missing.push("sla_days");
  return missing;
}

function toPayload(d: VacancyDraft): VacancyInput {
  return {
    title: d.title.trim(),
    company: d.company.trim(),
    seniority: d.seniority || undefined,
    salary_min: Number(d.salary_min),
    salary_max: Number(d.salary_max),
    currency: d.currency.trim() || "USD",
    work_format: d.work_format,
    location: d.location.trim() || undefined,
    english_level: d.english_level || undefined,
    must_have: d.must_have,
    nice_to_have: d.nice_to_have.length > 0 ? d.nice_to_have : undefined,
    hiring_manager: d.hiring_manager.trim(),
    sla_days: Number(d.sla_days),
  };
}

// ── Wizard step definition (order per P1 hiring spec, section 6) ──

const STEPS: ReadonlyArray<{ label: string; fields: readonly string[] }> = [
  { label: "Role", fields: ["title", "company"] },
  { label: "Must-have", fields: ["must_have"] },
  { label: "Range", fields: ["salary_range"] },
  { label: "Format", fields: ["work_format"] },
  { label: "Process", fields: ["hiring_manager"] },
  { label: "SLA", fields: ["sla_days"] },
];

// ── Small building blocks (immutable updates, no mutation of draft) ──

const inputClass =
  "w-full rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-[14px] text-gray-900 " +
  "placeholder:text-gray-300 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100";

const labelClass = "block text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-1.5";

function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{props.label}</label>
      <input
        className={inputClass}
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <div>
      <label className={labelClass}>{props.label}</label>
      <select
        className={inputClass}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">{props.placeholder}</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChipListEditor(props: {
  label: string;
  items: string[];
  onItemsChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [pending, setPending] = useState("");

  const add = () => {
    const value = pending.trim();
    if (!value || props.items.includes(value)) return;
    props.onItemsChange([...props.items, value]);
    setPending("");
  };

  const remove = (item: string) => {
    props.onItemsChange(props.items.filter((i) => i !== item));
  };

  return (
    <div>
      <label className={labelClass}>{props.label}</label>
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={pending}
          placeholder={props.placeholder}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          title="Add"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {props.items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {props.items.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1.5 text-[12px] font-semibold bg-gray-50 text-gray-700 border border-gray-100 pl-3 pr-1.5 py-1.5 rounded-full"
            >
              {item}
              <button
                type="button"
                onClick={() => remove(item)}
                className="w-[18px] h-[18px] flex items-center justify-center rounded-full text-gray-300 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                title={`Remove ${item}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VacancyIntake wizard ──

export function VacancyIntake() {
  const [draft, setDraft] = useState<VacancyDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [publishedChunks, setPublishedChunks] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [failureMissing, setFailureMissing] = useState<string[]>([]);

  const patch = (part: Partial<VacancyDraft>) =>
    setDraft((prev) => ({ ...prev, ...part }));

  const missing = validateDraft(draft);
  const stepMissing = STEPS[step].fields.filter((f) => missing.includes(f));
  const isLastStep = step === STEPS.length - 1;
  const canLeaveStep = stepMissing.length === 0;
  const canSubmit = missing.length === 0;

  const submit = async () => {
    if (!canSubmit || status === "submitting") return;
    setStatus("submitting");
    setFailure(null);
    setFailureMissing([]);
    try {
      const vacancy = await vacancyCreate(toPayload(draft));
      const published = await vacancyPublishToKb(vacancy.id);
      setPublishedChunks(published.chunks);
      setStatus("done");
    } catch (e) {
      if (isHiringError(e)) {
        setFailure(`${e.code}: ${e.message}`);
        setFailureMissing(e.missing);
      } else {
        setFailure(e instanceof Error ? e.message : "Unexpected error while publishing the vacancy.");
      }
      setStatus("idle");
    }
  };

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setStep(0);
    setStatus("idle");
    setPublishedChunks(null);
    setFailure(null);
    setFailureMissing([]);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-[#1A1D20] text-white flex items-center justify-center">
          <Briefcase className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight" style={{ letterSpacing: "-0.03em" }}>
            Vacancy Intake
          </h1>
          <p className="text-[13px] text-gray-500 font-medium">
            Six steps from role definition to a vacancy card published into the hiring knowledge base.
          </p>
        </div>
      </div>

      {/* Step rail */}
      <div className="flex flex-wrap gap-2 mb-8">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setStep(i)}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${
              i === step
                ? "bg-[#1A1D20] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-100 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      {status === "done" ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Check className="w-6 h-6" />
          </div>
          <h2 className="text-[18px] font-bold text-gray-900">
            Vacancy created and published to the hiring KB
          </h2>
          <p className="text-[14px] text-gray-500 mt-1.5">
            {publishedChunks} chunk{publishedChunks === 1 ? "" : "s"} ingested — the Copilot can now answer from this card.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 px-5 py-2.5 rounded-full bg-[#1A1D20] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            Add another vacancy
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-8">
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TextField label="Title" value={draft.title} onChange={(v) => patch({ title: v })} placeholder="Senior Frontend Engineer" />
              <TextField label="Company" value={draft.company} onChange={(v) => patch({ company: v })} placeholder="Acme Corp" />
              <SelectField
                label="Seniority"
                value={draft.seniority}
                onChange={(v) => patch({ seniority: v })}
                placeholder="Optional"
                options={[
                  { value: "junior", label: "Junior" },
                  { value: "middle", label: "Middle" },
                  { value: "senior", label: "Senior" },
                  { value: "lead", label: "Lead" },
                ]}
              />
            </div>
          )}

          {step === 1 && (
            <ChipListEditor
              label="Must-have requirements"
              items={draft.must_have}
              onItemsChange={(items) => patch({ must_have: items })}
              placeholder="e.g. 3+ years React, TypeScript strict…"
            />
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <TextField label="Salary min" type="number" value={draft.salary_min} onChange={(v) => patch({ salary_min: v })} placeholder="5000" />
              <TextField label="Salary max" type="number" value={draft.salary_max} onChange={(v) => patch({ salary_max: v })} placeholder="8000" />
              <TextField label="Currency" value={draft.currency} onChange={(v) => patch({ currency: v })} placeholder="USD" />
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <SelectField
                label="Work format"
                value={draft.work_format}
                onChange={(v) => patch({ work_format: v })}
                placeholder="Select format"
                options={[
                  { value: "onsite", label: "On-site" },
                  { value: "remote", label: "Remote" },
                  { value: "hybrid", label: "Hybrid" },
                ]}
              />
              <TextField label="Location" value={draft.location} onChange={(v) => patch({ location: v })} placeholder="Kyiv (optional)" />
              <SelectField
                label="English level"
                value={draft.english_level}
                onChange={(v) => patch({ english_level: v })}
                placeholder="Optional"
                options={[
                  { value: "b1", label: "B1" },
                  { value: "b2", label: "B2" },
                  { value: "c1", label: "C1" },
                  { value: "c2", label: "C2" },
                ]}
              />
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-5">
              <TextField label="Hiring manager" value={draft.hiring_manager} onChange={(v) => patch({ hiring_manager: v })} placeholder="Who owns the decision" />
              <ChipListEditor
                label="Nice-to-have (optional)"
                items={draft.nice_to_have}
                onItemsChange={(items) => patch({ nice_to_have: items })}
                placeholder="e.g. Experience with design systems…"
              />
            </div>
          )}

          {step === 5 && (
            <div className="max-w-xs">
              <TextField label="SLA days" type="number" value={draft.sla_days} onChange={(v) => patch({ sla_days: v })} placeholder="14" />
              <p className="text-[12px] text-gray-400 font-medium mt-2">
                Stages idle longer than this are flagged for the pipeline owner.
              </p>
            </div>
          )}

          {/* Failure feedback */}
          {failure && (
            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-[13px] font-bold text-amber-700">Vacancy was not created</p>
              <p className="text-[13px] text-amber-700 mt-0.5">{failure}</p>
              {failureMissing.length > 0 && (
                <p className="text-[12px] text-amber-600 mt-1 font-mono">
                  missing: {failureMissing.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-gray-500 bg-white border border-gray-100 hover:text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Back
            </button>
            <span className="text-[12px] font-mono text-gray-300">
              step {step + 1} / {STEPS.length}
            </span>
            {isLastStep ? (
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || status === "submitting"}
                className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-white bg-[#1A1D20] shadow-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
                title={canSubmit ? "Create and publish" : `Missing: ${missing.join(", ")}`}
              >
                {status === "submitting" ? "Publishing…" : "Create & publish to KB"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => canLeaveStep && setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={!canLeaveStep}
                className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-white bg-[#1A1D20] shadow-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
                title={canLeaveStep ? undefined : `Missing: ${stepMissing.join(", ")}`}
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
