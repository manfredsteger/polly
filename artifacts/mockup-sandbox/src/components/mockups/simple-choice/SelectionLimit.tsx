import "./_group.css";
import { ChoiceCard, Hint, PreviewShell } from "./_shared";

const choices = [
  { id: 1, label: "Montag, 9:00–10:00 Uhr" },
  { id: 2, label: "Dienstag, 14:00–15:00 Uhr" },
  { id: 3, label: "Mittwoch, 11:00–12:00 Uhr" },
  { id: 4, label: "Donnerstag, 16:00–17:00 Uhr" },
];

export function SelectionLimit() {
  return (
    <PreviewShell
      eyebrow="Simple Choice · Limit erreicht"
      title="Bis zu zwei Termine"
      description="Nach Erreichen des Limits bleiben die bereits gewählten Optionen aktiv; weitere Optionen werden klar als nicht verfügbar dargestellt."
    >
      <h2 className="mb-1 text-lg font-bold text-white">Welche Termine passen?</h2>
      <p className="mb-4 text-sm text-slate-400">Wähle bis zu zwei Optionen.</p>
      <Hint>Du hast das Auswahl-Limit erreicht. Hebe zuerst eine Auswahl auf, um eine andere zu wählen.</Hint>
      <div className="space-y-3">
        {choices.map((choice, index) => (
          <ChoiceCard key={choice.id} choice={choice} multiple selected={index < 2} disabled={index >= 2} />
        ))}
      </div>
      <p className="mt-4 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-200">2 von 2 ausgewählt</p>
    </PreviewShell>
  );
}
