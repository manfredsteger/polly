import { Check, CircleHelp, Info } from "lucide-react";

export type Choice = {
  id: number;
  label: string;
};

export function PreviewShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0f172a] px-5 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-[560px]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-300">{eyebrow}</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-800/80 p-2.5 text-sky-300" aria-hidden="true">
            <CircleHelp className="h-4 w-4" />
          </div>
        </div>
        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 sm:p-6">
          {children}
        </section>
      </div>
    </main>
  );
}

export function ChoiceCard({
  choice,
  selected,
  multiple,
  disabled = false,
  onClick,
}: {
  choice: Choice;
  selected: boolean;
  multiple: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={[
        "group flex min-h-[72px] w-full items-center gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        selected
          ? "border-sky-400 bg-sky-500 text-white shadow-lg shadow-sky-950/40"
          : "border-slate-700 bg-slate-950/50 text-slate-100 hover:border-sky-400/70 hover:bg-slate-800",
        disabled && !selected ? "cursor-not-allowed opacity-45" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center border-2",
          multiple ? "rounded-md" : "rounded-full",
          selected
            ? "border-white bg-white text-sky-600"
            : "border-slate-500 bg-slate-900 group-hover:border-sky-300",
        ].join(" ")}
        aria-hidden="true"
      >
        {selected && (multiple ? <Check className="h-4 w-4 stroke-[3]" /> : <span className="h-3.5 w-3.5 rounded-full bg-sky-600" />)}
      </span>
      <span className="flex-1 text-sm font-semibold">{choice.label}</span>
      {selected && <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">Ausgewählt</span>}
    </button>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-slate-700/80 bg-slate-800/70 px-3.5 py-3 text-sm text-slate-300">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
      <span>{children}</span>
    </div>
  );
}
