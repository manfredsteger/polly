import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, X, Calendar as CalendarIcon, Clock, CalendarDays, Repeat, Sparkles, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { de } from "date-fns/locale";

interface PollOption {
  text: string;
  startTime?: string;
  endTime?: string;
}

interface CalendarPickerProps {
  selectedDates?: Date[];
  onDatesChange?: React.Dispatch<React.SetStateAction<Date[]>>;
  onAddTimeSlot: (date: Date, startTime: string, endTime: string) => void;
  onAddTextOption?: (text: string) => void;
  existingOptions?: PollOption[];
}

const WEEKDAYS = [
  { id: 'monday', name: 'Montag', short: 'Mo' },
  { id: 'tuesday', name: 'Dienstag', short: 'Di' },
  { id: 'wednesday', name: 'Mittwoch', short: 'Mi' },
  { id: 'thursday', name: 'Donnerstag', short: 'Do' },
  { id: 'friday', name: 'Freitag', short: 'Fr' },
  { id: 'saturday', name: 'Samstag', short: 'Sa' },
  { id: 'sunday', name: 'Sonntag', short: 'So' },
];

interface TimeSlotPreset {
  startTime: string;
  endTime: string;
}

interface Template {
  id: string;
  name: string;
  icon: typeof Clock;
  description: string;
  presets: TimeSlotPreset[];
  isWeekdayTemplate?: boolean;
}

const defaultTemplates: Template[] = [
  {
    id: "multiple-times",
    name: "Ein Tag, mehrere Uhrzeiten",
    icon: Clock,
    description: "Vormittag, Mittag & Nachmittag",
    presets: [
      { startTime: "09:00", endTime: "11:00" },
      { startTime: "12:00", endTime: "14:00" },
      { startTime: "15:00", endTime: "17:00" },
    ],
  },
  {
    id: "weekday",
    name: "Wochentag",
    icon: CalendarDays,
    description: "Für regelmäßige Termine (z.B. JourFixe)",
    presets: [],
    isWeekdayTemplate: true,
  },
  {
    id: "morning-afternoon",
    name: "Vormittag/Nachmittag",
    icon: Repeat,
    description: "Zwei Optionen pro Tag",
    presets: [
      { startTime: "09:00", endTime: "12:00" },
      { startTime: "14:00", endTime: "17:00" },
    ],
  },
  {
    id: "short-slots",
    name: "Kurze Slots",
    icon: Sparkles,
    description: "30-Min-Termine (ideal für Elterngespräche)",
    presets: [
      { startTime: "09:00", endTime: "09:30" },
      { startTime: "09:30", endTime: "10:00" },
      { startTime: "10:00", endTime: "10:30" },
      { startTime: "10:30", endTime: "11:00" },
    ],
  },
];

export function CalendarPicker({ onAddTimeSlot, onAddTextOption, existingOptions = [] }: CalendarPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editableSlots, setEditableSlots] = useState<TimeSlotPreset[]>([]);
  const [templateSelectedDates, setTemplateSelectedDates] = useState<Date[]>([]);
  const [weekdayDialogOpen, setWeekdayDialogOpen] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [individualSlotsMode, setIndividualSlotsMode] = useState(false);
  const [perDaySlots, setPerDaySlots] = useState<Record<string, TimeSlotPreset[]>>({});

  // Get dates that have existing options for highlighting
  const datesWithOptions = existingOptions
    .filter(opt => opt.startTime)
    .map(opt => {
      const date = new Date(opt.startTime!);
      return date.toDateString();
    });

  // Initialize editable slots when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setEditableSlots([...selectedTemplate.presets]);
    }
  }, [selectedTemplate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setSelectedTemplate(null);
      setStartTime("09:00");
      setEndTime("17:00");
      setDialogOpen(true);
    }
  };

  const handleAddTimeSlot = () => {
    if (selectedDate && startTime && endTime) {
      onAddTimeSlot(selectedDate, startTime, endTime);
      setDialogOpen(false);
      setSelectedDate(undefined);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedDate(undefined);
    setSelectedTemplate(null);
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    if (template.isWeekdayTemplate) {
      setWeekdayDialogOpen(true);
    } else {
      setEditableSlots([...template.presets]);
      setTemplateDialogOpen(true);
    }
  };

  const handleWeekdayDialogClose = () => {
    setWeekdayDialogOpen(false);
    setSelectedTemplate(null);
    setSelectedWeekdays([]);
  };

  const toggleWeekday = (weekdayName: string) => {
    setSelectedWeekdays(prev => {
      if (prev.includes(weekdayName)) {
        return prev.filter(w => w !== weekdayName);
      }
      return [...prev, weekdayName];
    });
  };

  const handleWeekdayAddOptions = () => {
    if (selectedWeekdays.length > 0 && onAddTextOption) {
      const weekdayOrder = WEEKDAYS.map(w => w.name);
      const sortedWeekdays = [...selectedWeekdays].sort(
        (a, b) => weekdayOrder.indexOf(a) - weekdayOrder.indexOf(b)
      );
      sortedWeekdays.forEach((weekday) => {
        onAddTextOption(weekday);
      });
      setWeekdayDialogOpen(false);
      setSelectedTemplate(null);
      setSelectedWeekdays([]);
    }
  };

  const handleTemplateDialogClose = () => {
    setTemplateDialogOpen(false);
    setSelectedTemplate(null);
    setEditableSlots([]);
    setTemplateSelectedDates([]);
    setIndividualSlotsMode(false);
    setPerDaySlots({});
  };

  const handleTemplateAddSlots = () => {
    if (templateSelectedDates.length > 0) {
      if (individualSlotsMode) {
        // Add individual slots per day
        templateSelectedDates.forEach((date) => {
          const dateKey = date.toDateString();
          const slots = perDaySlots[dateKey] || [];
          slots.forEach((slot) => {
            onAddTimeSlot(date, slot.startTime, slot.endTime);
          });
        });
      } else {
        // Add same slots for each selected date
        if (editableSlots.length > 0) {
          templateSelectedDates.forEach((date) => {
            editableSlots.forEach((slot) => {
              onAddTimeSlot(date, slot.startTime, slot.endTime);
            });
          });
        }
      }
      setTemplateDialogOpen(false);
      setSelectedTemplate(null);
      setEditableSlots([]);
      setTemplateSelectedDates([]);
      setIndividualSlotsMode(false);
      setPerDaySlots({});
    }
  };

  const switchToIndividualMode = () => {
    // Copy current shared slots to each day
    const newPerDaySlots: Record<string, TimeSlotPreset[]> = {};
    templateSelectedDates.forEach((date) => {
      newPerDaySlots[date.toDateString()] = [...editableSlots];
    });
    setPerDaySlots(newPerDaySlots);
    setIndividualSlotsMode(true);
  };

  const switchToSharedMode = () => {
    // Take slots from first day as the shared slots
    if (templateSelectedDates.length > 0) {
      const firstDateKey = templateSelectedDates[0].toDateString();
      const firstDaySlots = perDaySlots[firstDateKey] || [];
      setEditableSlots([...firstDaySlots]);
    }
    setIndividualSlotsMode(false);
    setPerDaySlots({});
  };

  const updatePerDaySlot = (dateKey: string, index: number, field: 'startTime' | 'endTime', value: string) => {
    setPerDaySlots(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const removePerDaySlot = (dateKey: string, index: number) => {
    setPerDaySlots(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].filter((_, i) => i !== index)
    }));
  };

  const addPerDaySlot = (dateKey: string) => {
    setPerDaySlots(prev => {
      const currentSlots = prev[dateKey] || [];
      const lastSlot = currentSlots[currentSlots.length - 1];
      const newStartTime = lastSlot ? lastSlot.endTime : "09:00";
      const [hours, mins] = newStartTime.split(':').map(Number);
      const endHours = Math.min(hours + 1, 23);
      const newEndTime = `${endHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      
      return {
        ...prev,
        [dateKey]: [...currentSlots, { startTime: newStartTime, endTime: newEndTime }]
      };
    });
  };

  const getTotalSlotsCount = () => {
    if (individualSlotsMode) {
      return templateSelectedDates.reduce((total, date) => {
        const slots = perDaySlots[date.toDateString()] || [];
        return total + slots.length;
      }, 0);
    }
    return templateSelectedDates.length * editableSlots.length;
  };

  const toggleTemplateDate = (date: Date | undefined) => {
    if (!date) return;
    
    setTemplateSelectedDates(prev => {
      const dateStr = date.toDateString();
      const exists = prev.some(d => d.toDateString() === dateStr);
      if (exists) {
        return prev.filter(d => d.toDateString() !== dateStr);
      }
      return [...prev, date].sort((a, b) => a.getTime() - b.getTime());
    });
  };

  const removeTemplateDate = (date: Date) => {
    setTemplateSelectedDates(prev => 
      prev.filter(d => d.toDateString() !== date.toDateString())
    );
  };

  // Update a slot's time
  const updateSlot = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setEditableSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, [field]: value } : slot
    ));
  };

  // Remove a slot
  const removeSlot = (index: number) => {
    setEditableSlots(prev => prev.filter((_, i) => i !== index));
  };

  // Add a new empty slot
  const addNewSlot = () => {
    const lastSlot = editableSlots[editableSlots.length - 1];
    const newStartTime = lastSlot ? lastSlot.endTime : "09:00";
    // Calculate end time as 1 hour after start
    const [hours, mins] = newStartTime.split(':').map(Number);
    const endHours = Math.min(hours + 1, 23);
    const newEndTime = `${endHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    
    setEditableSlots(prev => [...prev, { startTime: newStartTime, endTime: newEndTime }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <CalendarIcon className="w-4 h-4" />
        <span>Klicken Sie auf ein Datum, um einen Zeitslot hinzuzufügen</span>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar */}
        <div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return date < today;
            }}
            modifiers={{
              hasOptions: (date) => datesWithOptions.includes(date.toDateString()),
            }}
            modifiersStyles={{
              hasOptions: {
                backgroundColor: 'hsl(25, 95%, 53%)',
                color: 'white',
                borderRadius: '50%',
                fontWeight: 'bold',
              },
            }}
            locale={de}
            weekStartsOn={1}
            className="rounded-md border"
            data-testid="calendar-picker"
          />
          {/* Counter and Legend */}
          {existingOptions.length > 0 ? (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <span className="text-lg">✓</span>
                <span className="font-medium">{existingOptions.length} {existingOptions.length === 1 ? 'Termin' : 'Termine'} hinzugefügt</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-schedule"></span>
                Orange markierte Tage haben Terminoptionen
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              Wählen Sie Tage im Kalender oder nutzen Sie eine Schnellvorlage
            </p>
          )}
        </div>

        {/* Templates Section */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-polly-orange" />
                Schnellvorlagen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Wählen Sie eine Vorlage und dann ein Datum
              </p>
              {defaultTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <Button
                    key={template.id}
                    type="button"
                    variant="outline"
                    className={`w-full justify-start h-auto py-3 px-4 ${
                      selectedTemplate?.id === template.id 
                        ? "border-polly-orange bg-orange-50 dark:bg-orange-950" 
                        : ""
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                    data-testid={`template-${template.id}`}
                  >
                    <Icon className="w-4 h-4 mr-3 text-polly-orange flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground">{template.description}</div>
                    </div>
                  </Button>
                );
              })}
              
              {/* Tip about combining templates */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">💡 Tipp:</span> Vorlagen können kombiniert werden! 
                  Wählen Sie einen Tag, wenden Sie eine Vorlage an, und wiederholen Sie das für weitere Tage mit anderen Uhrzeiten.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Single Time Slot Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-polly-orange" />
              Zeitslot hinzufügen
            </DialogTitle>
            <DialogDescription>
              {selectedDate && (
                <span className="font-medium text-foreground">
                  {selectedDate.toLocaleDateString('de-DE', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dialog-startTime" className="text-sm font-medium">Von</Label>
                <Input
                  id="dialog-startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1"
                  data-testid="input-start-time"
                />
              </div>
              <div>
                <Label htmlFor="dialog-endTime" className="text-sm font-medium">Bis</Label>
                <Input
                  id="dialog-endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1"
                  data-testid="input-end-time"
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDialogClose}
                className="flex-1"
                data-testid="button-cancel-timeslot"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleAddTimeSlot}
                disabled={!startTime || !endTime}
                className="flex-1 polly-button-schedule"
                data-testid="button-add-timeslot"
              >
                <Plus className="w-4 h-4 mr-2" />
                Hinzufügen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Dialog - Select Dates first, then Editable Slots */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate && (
                <>
                  <selectedTemplate.icon className="w-5 h-5 text-polly-orange" />
                  {selectedTemplate.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Wählen Sie einen oder mehrere Tage und passen Sie dann die Zeitslots an.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Calendar for multi-date selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Tage auswählen (Klicken zum Hinzufügen/Entfernen):</Label>
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={toggleTemplateDate}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today;
                }}
                modifiers={{
                  hasOptions: (date) => datesWithOptions.includes(date.toDateString()),
                  selected: (date) => templateSelectedDates.some(d => d.toDateString() === date.toDateString()),
                }}
                modifiersStyles={{
                  hasOptions: {
                    backgroundColor: 'hsl(var(--primary) / 0.15)',
                    borderRadius: '50%',
                    fontWeight: 'bold',
                  },
                  selected: {
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'white',
                    borderRadius: '50%',
                    fontWeight: 'bold',
                  },
                }}
                locale={de}
                weekStartsOn={1}
                className="rounded-md border"
                data-testid="template-calendar"
              />
              
              {/* Selected dates list */}
              {templateSelectedDates.length > 0 && (
                <div className="mt-3 p-2 bg-muted rounded-lg">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Gewählte Tage ({templateSelectedDates.length}):
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {templateSelectedDates.map((date, idx) => (
                      <div 
                        key={idx} 
                        className="inline-flex items-center gap-1 bg-background border rounded-full px-3 py-1 text-sm"
                      >
                        <span>{date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        <button
                          type="button"
                          onClick={() => removeTemplateDate(date)}
                          className="text-muted-foreground hover:text-destructive ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mode Toggle Button - only show if multiple dates selected */}
            {templateSelectedDates.length > 1 && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={individualSlotsMode ? switchToSharedMode : switchToIndividualMode}
                  className="text-xs"
                  data-testid="button-toggle-slot-mode"
                >
                  {individualSlotsMode ? (
                    <>
                      <Repeat className="w-3 h-3 mr-1" />
                      Gleiche Slots für alle Tage
                    </>
                  ) : (
                    <>
                      <CalendarDays className="w-3 h-3 mr-1" />
                      Individuelle Slots pro Tag
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Shared Time Slots Mode */}
            {!individualSlotsMode && (
              <div className="p-3 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Zeitslots pro Tag ({editableSlots.length}):</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addNewSlot}
                    className="h-7 text-xs"
                    data-testid="button-add-template-slot"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Hinzufügen
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editableSlots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-2 bg-background p-2 rounded border">
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(index, 'startTime', e.target.value)}
                        className="h-8 w-24 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                        data-testid={`input-template-start-${index}`}
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(index, 'endTime', e.target.value)}
                        className="h-8 w-24 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                        data-testid={`input-template-end-${index}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSlot(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        disabled={editableSlots.length <= 1}
                        data-testid={`button-remove-slot-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Slots Per Day Mode */}
            {individualSlotsMode && (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {templateSelectedDates.map((date) => {
                  const dateKey = date.toDateString();
                  const slots = perDaySlots[dateKey] || [];
                  return (
                    <div key={dateKey} className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-foreground">
                          {date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                          <span className="text-muted-foreground ml-1">({slots.length} Slots)</span>
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addPerDaySlot(dateKey)}
                          className="h-6 text-xs px-2"
                          data-testid={`button-add-slot-${dateKey}`}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-1">
                        {slots.map((slot, index) => (
                          <div key={index} className="flex items-center gap-2 bg-background p-1.5 rounded border">
                            <Input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updatePerDaySlot(dateKey, index, 'startTime', e.target.value)}
                              className="h-7 w-20 text-xs [color-scheme:light] dark:[color-scheme:dark]"
                              data-testid={`input-day-${dateKey}-start-${index}`}
                            />
                            <span className="text-muted-foreground text-xs">-</span>
                            <Input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updatePerDaySlot(dateKey, index, 'endTime', e.target.value)}
                              className="h-7 w-20 text-xs [color-scheme:light] dark:[color-scheme:dark]"
                              data-testid={`input-day-${dateKey}-end-${index}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePerDaySlot(dateKey, index)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              disabled={slots.length <= 1}
                              data-testid={`button-remove-day-slot-${dateKey}-${index}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary - how many slots will be created */}
            {templateSelectedDates.length > 0 && getTotalSlotsCount() > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Es werden <strong className="text-foreground">{getTotalSlotsCount()}</strong> Zeitslots erstellt
                {!individualSlotsMode && (
                  <> ({templateSelectedDates.length} Tag{templateSelectedDates.length > 1 ? 'e' : ''} × {editableSlots.length} Slot{editableSlots.length > 1 ? 's' : ''})</>
                )}
              </p>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleTemplateDialogClose}
                className="flex-1"
                data-testid="button-cancel-template"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleTemplateAddSlots}
                disabled={templateSelectedDates.length === 0 || getTotalSlotsCount() === 0}
                className="flex-1 polly-button-schedule"
                data-testid="button-confirm-template"
              >
                <Plus className="w-4 h-4 mr-2" />
                Hinzufügen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekday Selection Dialog */}
      <Dialog open={weekdayDialogOpen} onOpenChange={setWeekdayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-polly-orange" />
              Wochentag-Auswahl
            </DialogTitle>
            <DialogDescription>
              Wählen Sie die Wochentage für Ihre Abstimmung (z.B. für einen regelmäßigen JourFixe).
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Weekday checkboxes */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Wochentage auswählen:</Label>
              <div className="grid gap-2">
                {WEEKDAYS.map((weekday) => (
                  <div 
                    key={weekday.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedWeekdays.includes(weekday.name) 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-background hover:bg-muted'
                    }`}
                    onClick={() => toggleWeekday(weekday.name)}
                    data-testid={`weekday-${weekday.id}`}
                  >
                    <Checkbox 
                      checked={selectedWeekdays.includes(weekday.name)}
                      onCheckedChange={() => toggleWeekday(weekday.name)}
                    />
                    <span className="font-medium">{weekday.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected count */}
            {selectedWeekdays.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                <strong className="text-foreground">{selectedWeekdays.length}</strong> Wochentag{selectedWeekdays.length > 1 ? 'e' : ''} ausgewählt
              </p>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleWeekdayDialogClose}
                className="flex-1"
                data-testid="button-cancel-weekday"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleWeekdayAddOptions}
                disabled={selectedWeekdays.length === 0 || !onAddTextOption}
                className="flex-1 polly-button-schedule"
                data-testid="button-confirm-weekday"
              >
                <Plus className="w-4 h-4 mr-2" />
                Hinzufügen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
