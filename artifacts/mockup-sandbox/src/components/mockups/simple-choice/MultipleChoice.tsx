import { useState } from "react";
import "./_group.css";
import { ChoiceCard, Hint, PreviewShell } from "./_shared";

const choices = [
  { id: 1, label: "Barrierefreier Zugang" },
  { id: 2, label: "Vegetarisches Mittagessen" },
  { id: 3, label: "Aufzeichnung erhalten" },
  { id: 4, label: "Austausch in Kleingruppen" },
];

export function MultipleChoice() {
  const [selected, setSelected] = useState<number[]>([1, 3]);

  const toggle = (id: number) => {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  return (
    <PreviewShell
      eyebrow="Simple Choice · bis zu 3"
      title="Mehrere Wünsche auswählen"
      description="Checkboxen verwenden ein eigenes Symbol. So bleibt der Unterschied zwischen Single und Multiple Choice eindeutig."
    >
      <h2 className="mb-1 text-lg font-bold text-white">Was ist dir wichtig?</h2>
      <p className="mb-4 text-sm text-slate-400">Du kannst bis zu drei Optionen auswählen.</p>
      <Hint>Ausgewählte Optionen werden blau hinterlegt und erhalten ein deutliches Häkchen.</Hint>
      <div className="space-y-3">
        {choices.map((choice) => (
          <ChoiceCard
            key={choice.id}
            choice={choice}
            multiple
            selected={selected.includes(choice.id)}
            onClick={() => toggle(choice.id)}
          />
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200">{selected.length} von 3 ausgewählt</p>
    </PreviewShell>
  );
}
