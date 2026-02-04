import { useState, useRef, useEffect, useId } from "react";
import { Input } from "@/components/ui/input";
import { Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerDropdownProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  "data-testid"?: string;
}

const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
];

function formatTimeDisplay(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function TimePickerDropdown({ 
  value, 
  onChange, 
  label,
  className,
  "data-testid": testId 
}: TimePickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const inputId = useId();

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      const currentIndex = TIME_OPTIONS.indexOf(value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      
      if (listRef.current && value) {
        const selectedOption = listRef.current.querySelector(`[data-value="${value}"]`);
        if (selectedOption) {
          selectedOption.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }
    }
  }, [isOpen, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const highlightedOption = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedOption) {
        highlightedOption.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (/^\d{2}:\d{2}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleInputBlur = () => {
    if (/^\d{2}:\d{2}$/.test(inputValue)) {
      onChange(inputValue);
    } else {
      setInputValue(value);
    }
  };

  const handleOptionClick = (time: string) => {
    onChange(time);
    setInputValue(time);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < TIME_OPTIONS.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : TIME_OPTIONS.length - 1
        );
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < TIME_OPTIONS.length) {
          handleOptionClick(TIME_OPTIONS[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.focus();
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const handleToggleClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div 
        className="flex items-center border rounded-md bg-background hover:border-polly-orange/50 transition-colors cursor-pointer"
        onClick={handleToggleClick}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
      >
        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => {}}
          placeholder="HH:MM"
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pr-0"
          data-testid={testId}
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={isOpen && highlightedIndex >= 0 ? `time-option-${highlightedIndex}` : undefined}
        />
        <div className="flex items-center gap-1 px-2 text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
        </div>
      </div>

      {isOpen && (
        <div 
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Time options"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-lg"
        >
          {TIME_OPTIONS.map((time, index) => (
            <div
              key={time}
              id={`time-option-${index}`}
              role="option"
              data-value={time}
              data-index={index}
              aria-selected={value === time}
              onClick={() => handleOptionClick(time)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm cursor-pointer transition-colors",
                value === time && "bg-polly-orange/10 text-polly-orange font-medium",
                highlightedIndex === index && value !== time && "bg-accent text-accent-foreground"
              )}
            >
              {formatTimeDisplay(time)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
