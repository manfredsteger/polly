import { useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
} from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  rows?: number;
}

type FormatAction = "bold" | "italic" | "heading" | "ul" | "ol";

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
  id,
  rows = 4,
}: MarkdownEditorProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = useCallback(
    (action: FormatAction) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.slice(start, end);
      let before = value.slice(0, start);
      let after = value.slice(end);
      let newText = "";
      let cursorOffset = 0;

      switch (action) {
        case "bold":
          newText = `**${selected || t("common.markdownEditor.boldText", "Text")}**`;
          cursorOffset = selected ? newText.length : 2;
          break;
        case "italic":
          newText = `*${selected || t("common.markdownEditor.italicText", "Text")}*`;
          cursorOffset = selected ? newText.length : 1;
          break;
        case "heading":
          {
            const lineStart = before.lastIndexOf("\n") + 1;
            const linePrefix = before.slice(lineStart);
            before = before.slice(0, lineStart);
            newText = `## ${linePrefix}${selected}`;
            cursorOffset = newText.length;
          }
          break;
        case "ul":
          {
            const lineStart = before.lastIndexOf("\n") + 1;
            const linePrefix = before.slice(lineStart);
            before = before.slice(0, lineStart);
            newText = `- ${linePrefix}${selected}`;
            cursorOffset = newText.length;
          }
          break;
        case "ol":
          {
            const lineStart = before.lastIndexOf("\n") + 1;
            const linePrefix = before.slice(lineStart);
            before = before.slice(0, lineStart);
            newText = `1. ${linePrefix}${selected}`;
            cursorOffset = newText.length;
          }
          break;
      }

      const result = before + newText + after;
      onChange(result);

      requestAnimationFrame(() => {
        ta.focus();
        const pos = before.length + cursorOffset;
        ta.setSelectionRange(pos, pos);
      });
    },
    [value, onChange, t]
  );

  const tools: { action: FormatAction; icon: typeof Bold; label: string }[] = [
    { action: "heading", icon: Heading2, label: t("common.markdownEditor.heading", "Überschrift") },
    { action: "bold", icon: Bold, label: t("common.markdownEditor.bold", "Fett") },
    { action: "italic", icon: Italic, label: t("common.markdownEditor.italic", "Kursiv") },
    { action: "ul", icon: List, label: t("common.markdownEditor.bulletList", "Aufzählung") },
    { action: "ol", icon: ListOrdered, label: t("common.markdownEditor.numberedList", "Nummerierung") },
  ];

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted/50 px-1 py-1">
        {tools.map(({ action, icon: Icon, label }) => (
          <Toggle
            key={action}
            size="sm"
            aria-label={label}
            title={label}
            onPressedChange={() => applyFormat(action)}
            pressed={false}
            className="h-7 w-7 p-0 data-[state=on]:bg-transparent"
          >
            <Icon className="h-4 w-4" />
          </Toggle>
        ))}
      </div>
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-t-none border-t-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
