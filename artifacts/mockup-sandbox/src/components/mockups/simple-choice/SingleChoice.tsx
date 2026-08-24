import { useState } from "react";
import "./_group.css";
import { ChoiceCard, Hint, PreviewShell } from "./_shared";

const choices = [
  { id: 1, label: "Workshop am Vormittag" },
  { id: 2, label: "Workshop am Nachmittag" },
  { id: 3, label: "Online-Teilnahme" },
];

export function SingleChoice() {
  const [selected, setSelected] = useState<number[]>([1]);

  return (
    <PreviewShell
      eyebrow="Simple Choice · 1 von 1"
      title="Ein Termin für alle"
      description="Der ausgewählte Zustand ist durch Karte, Kontrast, Radio-Punkt und Statuslabel eindeutig erkennbar."
    >
      <h2 className="mb-1 text-lg font-bold text-white">Bevorzugte Teilnahme</h2>
      <p className="mb-4 text-sm text-slate-400">Bitte wähle genau eine Option.</p>
      <Hint>Ein Klick wechselt die Auswahl direkt. Der gefüllte Punkt bleibt auch bei geringer Bildschirmhelligkeit sichtbar.</Hint>
      <div className="space-y-3">
        {choices.map((choice) => (
          <ChoiceCard
            key={choice.id}
            choice={choice}
            multiple={false}
            selected={selected.includes(choice.id)}
            onClick={() => setSelected([choice.id])}
          />
        ))}
      </div>
    </PreviewShell>
  );
}
