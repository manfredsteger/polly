import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { de, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, ClipboardList, Plus, Trash2, Users, Clock, Info, Mail, CheckCircle, QrCode, Link as LinkIcon, CalendarDays, Bell, Sparkles, Coffee, Repeat, Timer, ChevronDown, GripVertical, RotateCcw } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useAuth } from "@/contexts/AuthContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface OrgaSlot {
  id: string;
  text: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  templateSourceId?: string;
  pendingTemplateId?: string;
  maxCapacity?: number;
  order: number;
}

interface OrgaTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: typeof Clock;
  slots: { description: string; startTime: string; endTime: string; capacity?: number }[];
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

interface OrgaFormData {
  title: string;
  description: string;
  creatorEmail: string;
  enableExpiryReminder: boolean;
  expiryReminderHours: number;
  allowMultipleSlots: boolean;
  allowVoteEdit: boolean;
  allowVoteWithdrawal: boolean;
  resultsPublic: boolean;
  notifyCreatorOnVote: boolean;
  slots: OrgaSlot[];
  expiresAt: string | null;
  isDayMode?: boolean;
  dayModeDate?: string;
  dayModeDates?: string[];
}

interface SortableSlotItemProps {
  slot: OrgaSlot;
  index: number;
  slotsLength: number;
  isDayMode: boolean;
  updateSlot: (index: number, updates: Partial<OrgaSlot>) => void;
  addNextSlotForRow: (index: number) => void;
  removeSlot: (index: number) => void;
  t: (key: string) => string;
}

interface CustomSlotRowProps {
  slot: OrgaSlot;
  index: number;
  slotsLength: number;
  updateSlot: (index: number, updates: Partial<OrgaSlot>) => void;
  removeSlot: (index: number) => void;
  t: (key: string) => string;
}

const parseTimeToMinutes = (time?: string) => {
  if (!time || !time.match(/^\d{2}:\d{2}$/)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes: number) => {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60).toString().padStart(2, "0");
  const mins = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
};

const getDurationFromTimes = (start?: string, end?: string) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return undefined;
  return endMinutes - startMinutes;
};

function SortableSlotItem({ slot, index, slotsLength, isDayMode, updateSlot, addNextSlotForRow, removeSlot, t }: SortableSlotItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const slotStartMinutes = parseTimeToMinutes(slot.startTime);
  const slotEndMinutes = parseTimeToMinutes(slot.endTime);
  const slotDurationValue =
    slotStartMinutes !== null && slotEndMinutes !== null && slotEndMinutes > slotStartMinutes
      ? String(slotEndMinutes - slotStartMinutes)
      : slot.durationMinutes
        ? String(slot.durationMinutes)
        : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-3 bg-muted/30"
      data-testid={`slot-${index}`}
    >
      {isDayMode ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
            aria-label="Verschieben"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <Input
            value={slot.text}
            onChange={(e) => updateSlot(index, { text: e.target.value })}
            placeholder={t('createOrganization.slotDescriptionPlaceholder')}
            className="flex-1 min-w-0"
            data-testid={`input-slot-text-${index}`}
          />
          <div className="flex items-center gap-1 shrink-0">
            <TimePicker
              time={slot.startTime}
              onTimeChange={(time) => updateSlot(index, { startTime: time })}
              placeholder={t('createOrganization.startTime')}
              data-testid={`input-slot-start-${index}`}
            />
            <span className="text-muted-foreground text-sm px-0.5">–</span>
            <TimePicker
              time={slot.endTime}
              onTimeChange={(time) => updateSlot(index, { endTime: time })}
              placeholder={t('createOrganization.endTime')}
              data-testid={`input-slot-end-${index}`}
            />
          </div>
          <Input
            type="number"
            min={1}
            value={slot.maxCapacity ?? ""}
            onChange={(e) => updateSlot(index, { maxCapacity: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined })}
            placeholder="∞"
            className="w-20 shrink-0"
            data-testid={`input-slot-capacity-${index}`}
          />
          {slotsLength > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeSlot(index)}
              className="text-destructive hover:text-destructive shrink-0"
              aria-label={t('createOrganization.removeSlot')}
              data-testid={`button-remove-slot-${index}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          {slot.startTime && slot.endTime && slot.startTime === slot.endTime && (
            <p className="text-xs text-destructive">{t('createOrganization.timesMustDiffer')}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
              aria-label="Verschieben"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <Input
              value={slot.text}
              onChange={(e) => updateSlot(index, { text: e.target.value })}
              placeholder={t('createOrganization.slotDescriptionPlaceholder')}
              className="flex-1 min-w-0"
              data-testid={`input-slot-text-${index}`}
            />
            {slotsLength > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSlot(index)}
                className="text-destructive hover:text-destructive shrink-0"
                aria-label={t('createOrganization.removeSlot')}
                data-testid={`button-remove-slot-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 pl-6">
            <DatePicker
              date={slot.date ? (() => { const [y, m, d] = slot.date!.split('-').map(Number); return new Date(y, m - 1, d); })() : null}
              onDateChange={(d) => {
                if (d) {
                  const y = d.getFullYear();
                  const mo = String(d.getMonth() + 1).padStart(2, '0');
                  const dy = String(d.getDate()).padStart(2, '0');
                  updateSlot(index, { date: `${y}-${mo}-${dy}` });
                } else {
                  updateSlot(index, { date: undefined });
                }
              }}
              placeholder={t('createOrganization.selectDate')}
              buttonClassName="w-[190px]"
              data-testid={`input-slot-date-${index}`}
            />
            <TimePicker
              time={slot.startTime}
              onTimeChange={(time) => updateSlot(index, {
                startTime: time,
                endTime: slot.durationMinutes ? formatMinutesToTime(parseTimeToMinutes(time)! + slot.durationMinutes) : slot.endTime,
              })}
              placeholder={t('createOrganization.startTime')}
              data-testid={`input-slot-start-${index}`}
            />
            <span className="text-muted-foreground text-sm shrink-0">–</span>
            <TimePicker
              time={slot.endTime}
              onTimeChange={(time) => updateSlot(index, {
                endTime: time,
                durationMinutes: getDurationFromTimes(slot.startTime, time),
              })}
              placeholder={t('createOrganization.endTime')}
              data-testid={`input-slot-end-${index}`}
            />
            <Input
              type="number"
              min={1}
              value={slot.maxCapacity ?? ""}
              onChange={(e) => updateSlot(index, { maxCapacity: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined })}
              placeholder="∞"
              className="w-20 shrink-0"
              data-testid={`input-slot-capacity-${index}`}
            />
            <Select
              value={slotDurationValue}
              onValueChange={(value) => {
                const selectedDuration = parseInt(value, 10);
                if (Number.isNaN(selectedDuration)) return;
                updateSlot(index, {
                  durationMinutes: selectedDuration,
                  endTime: slotStartMinutes !== null ? formatMinutesToTime(slotStartMinutes + selectedDuration) : slot.endTime,
                });
              }}
            >
              <SelectTrigger
                className="w-[130px] shrink-0"
                data-testid={`select-slot-duration-${index}`}
              >
                <SelectValue placeholder={t('createOrganization.slotDuration')} />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((duration) => (
                  <SelectItem key={duration} value={String(duration)}>
                    {duration} {t('createOrganization.minutes')}
                  </SelectItem>
                ))}
                {slotDurationValue && !DURATION_OPTIONS.includes(Number(slotDurationValue)) && (
                  <SelectItem value={slotDurationValue}>
                    {slotDurationValue} {t('createOrganization.minutes')}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addNextSlotForRow(index)}
              disabled={!slot.date || !slot.endTime}
              aria-label={t('createOrganization.addNextSlot')}
              className="shrink-0"
              data-testid={`button-add-next-slot-${index}`}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t('createOrganization.addNextSlot')}
            </Button>
          </div>
          {slot.startTime && slot.endTime && slot.startTime === slot.endTime && (
            <p className="text-xs text-destructive pl-6">{t('createOrganization.timesMustDiffer')}</p>
          )}
        </div>
      )}
    </div>
  );
}


function CustomSlotRow({ slot, index, slotsLength, updateSlot, removeSlot, t }: CustomSlotRowProps) {
  const slotStartMinutes = parseTimeToMinutes(slot.startTime);
  const slotEndMinutes = parseTimeToMinutes(slot.endTime);
  const slotDurationValue =
    slotStartMinutes !== null && slotEndMinutes !== null && slotEndMinutes > slotStartMinutes
      ? String(slotEndMinutes - slotStartMinutes)
      : slot.durationMinutes
        ? String(slot.durationMinutes)
        : undefined;

  return (
    <div className="rounded-lg border bg-background p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Input
          value={slot.text}
          onChange={(e) => updateSlot(index, { text: e.target.value })}
          placeholder={t('createOrganization.slotDescriptionPlaceholder')}
          className="flex-1 min-w-0"
          data-testid={`input-slot-text-${index}`}
        />
        {slotsLength > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeSlot(index)}
            className="text-destructive hover:text-destructive shrink-0"
            aria-label={t('createOrganization.removeSlot')}
            data-testid={`button-remove-slot-${index}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_110px_minmax(160px,1fr)]">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t('createOrganization.fieldStart')}</Label>
          <TimePicker
            time={slot.startTime}
            onTimeChange={(time) => updateSlot(index, {
              startTime: time,
              endTime: slot.durationMinutes ? formatMinutesToTime(parseTimeToMinutes(time)! + slot.durationMinutes) : slot.endTime,
            })}
            placeholder={t('createOrganization.startTime')}
            className="w-full"
            data-testid={`input-slot-start-${index}`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t('createOrganization.fieldEnd')}</Label>
          <TimePicker
            time={slot.endTime}
            onTimeChange={(time) => updateSlot(index, {
              endTime: time,
              durationMinutes: getDurationFromTimes(slot.startTime, time),
            })}
            placeholder={t('createOrganization.endTime')}
            className="w-full"
            data-testid={`input-slot-end-${index}`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t('createOrganization.fieldCapacity')}</Label>
          <Input
            type="number"
            min={1}
            value={slot.maxCapacity ?? ""}
            onChange={(e) => updateSlot(index, { maxCapacity: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined })}
            placeholder="∞"
            className="w-full"
            data-testid={`input-slot-capacity-${index}`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t('createOrganization.fieldDuration')}</Label>
          <Select
            value={slotDurationValue}
            onValueChange={(value) => {
              const selectedDuration = parseInt(value, 10);
              if (Number.isNaN(selectedDuration)) return;
              updateSlot(index, {
                durationMinutes: selectedDuration,
                endTime: slotStartMinutes !== null ? formatMinutesToTime(slotStartMinutes + selectedDuration) : slot.endTime,
              });
            }}
          >
            <SelectTrigger
              className="w-full"
              data-testid={`select-slot-duration-${index}`}
            >
              <SelectValue placeholder={t('createOrganization.slotDuration')} />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((duration) => (
                <SelectItem key={duration} value={String(duration)}>
                  {duration} {t('createOrganization.minutes')}
                </SelectItem>
              ))}
              {slotDurationValue && !DURATION_OPTIONS.includes(Number(slotDurationValue)) && (
                <SelectItem value={slotDurationValue}>
                  {slotDurationValue} {t('createOrganization.minutes')}
                </SelectItem>
              )}
              </SelectContent>
            </Select>
        </div>
      </div>
      {slot.startTime && slot.endTime && slot.startTime === slot.endTime && (
        <p className="text-xs text-destructive">{t('createOrganization.timesMustDiffer')}</p>
      )}
    </div>
  );
}

export default function CreateOrganization() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const dateLocale = i18n.language === "de" ? de : enUS;
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [enableExpiryReminder, setEnableExpiryReminder] = useState(false);
  const [expiryReminderHours, setExpiryReminderHours] = useState(24);
  const [allowMultipleSlots, setAllowMultipleSlots] = useState(true);
  const [allowVoteEdit, setAllowVoteEdit] = useState(false);
  const [allowVoteWithdrawal, setAllowVoteWithdrawal] = useState(false);
  const [resultsPublic, setResultsPublic] = useState(true);
  const [notifyCreatorOnVote, setNotifyCreatorOnVote] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [isDayMode, setIsDayMode] = useState(false);
  const [dayModeDate, setDayModeDate] = useState<string>("");
  const [dayModeDates, setDayModeDates] = useState<string[]>([]);
  const [slotDuration, setSlotDuration] = useState(30);
  const nextSlotIdRef = useRef(1);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [templateDialogGroupKey, setTemplateDialogGroupKey] = useState<string | null>(null);
  const [templateDialogDrafts, setTemplateDialogDrafts] = useState<Record<string, {
    templateId?: string;
    durationMinutes?: number;
  }>>({});
  const [slots, setSlots] = useState<OrgaSlot[]>([
    { id: "0", text: "", maxCapacity: undefined, order: 0 }
  ]);

  const slotSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const customDateGroups = slots.reduce<Array<{
    key: string;
    date?: string;
    slots: Array<{ slot: OrgaSlot; index: number }>;
  }>>((groups, slot, index) => {
    if (!slot.date) {
      groups.push({
        key: `group-${slot.id}`,
        date: undefined,
        slots: [{ slot, index }],
      });
      return groups;
    }

    const existingGroup = groups.find((group) => group.date === slot.date);
    if (existingGroup) {
      existingGroup.slots.push({ slot, index });
    } else {
      groups.push({
        key: `group-${slot.id}`,
        date: slot.date,
        slots: [{ slot, index }],
      });
    }

    return groups;
  }, []);

  const handleSlotDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSlots((items) => {
        const oldIndex = items.findIndex((s) => s.id === active.id);
        const newIndex = items.findIndex((s) => s.id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((s, idx) => ({ ...s, order: idx }));
      });
    }
  };

  const formPersistence = useFormPersistence<OrgaFormData>({ key: 'create-organization' });
  const hasRestoredRef = useRef(false);
  const autoSubmitTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isDayMode) return;
    const normalizedDate = dayModeDate || dayModeDates[0];
    if (!normalizedDate) return;

    setSlots((currentSlots) =>
      currentSlots.map((slot) => ({
        ...slot,
        date: slot.date ?? normalizedDate,
        durationMinutes: slot.durationMinutes ?? getDurationFromTimes(slot.startTime, slot.endTime) ?? slotDuration,
      }))
    );
    setIsDayMode(false);
  }, [isDayMode, dayModeDate, dayModeDates, slotDuration]);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    
    const stored = formPersistence.getStoredData();
    if (stored && stored.data) {
      hasRestoredRef.current = true;
      setTitle(stored.data.title || "");
      setDescription(stored.data.description || "");
      setCreatorEmail(stored.data.creatorEmail || "");
      setEnableExpiryReminder(stored.data.enableExpiryReminder ?? false);
      setExpiryReminderHours(stored.data.expiryReminderHours ?? 24);
      setAllowMultipleSlots(stored.data.allowMultipleSlots ?? true);
      setAllowVoteEdit(stored.data.allowVoteEdit ?? false);
      setAllowVoteWithdrawal(stored.data.allowVoteWithdrawal ?? false);
      setResultsPublic(stored.data.resultsPublic ?? true);
      setNotifyCreatorOnVote(stored.data.notifyCreatorOnVote ?? true);
      setIsDayMode(stored.data.isDayMode ?? false);
      setDayModeDate(stored.data.dayModeDate ?? "");
      setDayModeDates(stored.data.dayModeDates ?? (stored.data.dayModeDate ? [stored.data.dayModeDate] : []));
      if (stored.data.slots && stored.data.slots.length >= 1) {
        const restored = stored.data.slots.map((s: OrgaSlot, i: number) => ({ ...s, id: s.id ?? String(i) }));
        nextSlotIdRef.current = restored.length;
        setSlots(restored);
      }
      if (stored.data.expiresAt) {
        setExpiresAt(new Date(stored.data.expiresAt));
      }
      
      if (stored.pendingSubmit) {
        toast({
          title: t('pollCreation.welcomeBack'),
          description: t('pollCreation.formRestoredOrga'),
        });
      }
    }
  }, []);

  // Read AI suggestion from sessionStorage if present
  useEffect(() => {
    const raw = sessionStorage.getItem("ai-suggestion");
    if (!raw) return;
    try {
      const suggestion = JSON.parse(raw);
      if (suggestion.pollType !== "organization") return;
      sessionStorage.removeItem("ai-suggestion");
      if (suggestion.title) setTitle(suggestion.title);
      if (suggestion.description) setDescription(suggestion.description);
      if (Array.isArray(suggestion.options) && suggestion.options.length >= 1) {
        const DATE_PREFIX_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+/;

        type RawSlot = { id: string; text: string; startTime?: string; endTime?: string; maxCapacity?: number; order: number; _isoDate?: string };

        const optionTexts: string[] = suggestion.options.map((opt: any) =>
          typeof opt === "string" ? opt : opt.text || ""
        );
        const aiBaseId = nextSlotIdRef.current;
        nextSlotIdRef.current += optionTexts.length;

        const rawParsed: RawSlot[] = optionTexts.map((text: string, i: number) => {
          const dateMatch = text.match(DATE_PREFIX_RE);
          const timeMatch = text.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
          const capMatch = text.match(/\(max\.?\s*(\d+)/i);

          let isoDate: string | undefined;
          if (dateMatch) {
            const [, dd, mm, yyyy] = dateMatch;
            isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
          }

          let cleanText = text;
          if (dateMatch) {
            cleanText = text.replace(DATE_PREFIX_RE, '');
          }
          if (timeMatch) {
            const timeIndex = cleanText.indexOf(timeMatch[0]);
            const before = cleanText.substring(0, timeIndex).trim();
            cleanText = before || cleanText;
          }
          cleanText = cleanText.replace(/\(max\.?\s*\d+[^)]*\)/gi, '').trim() || text;

          return {
            id: String(aiBaseId + i),
            text: cleanText,
            startTime: timeMatch ? timeMatch[1] : undefined,
            endTime: timeMatch ? timeMatch[2] : undefined,
            maxCapacity: capMatch ? parseInt(capMatch[1]) : undefined,
            order: i,
            _isoDate: isoDate,
          };
        });

        const datesFound = rawParsed.map((s: RawSlot) => s._isoDate).filter(Boolean) as string[];
        const uniqueDates = [...new Set(datesFound)];
        const allSameDate = datesFound.length === rawParsed.length && uniqueDates.length === 1;
        const hasAnyTimes = rawParsed.some((s: RawSlot) => s.startTime || s.endTime);

        if (allSameDate) {
          const sharedDate = uniqueDates[0];
          setIsDayMode(true);
          setDayModeDate(sharedDate);
          setDayModeDates([sharedDate]);
        } else if (datesFound.length > 0) {
          for (const slot of rawParsed) {
            if (slot._isoDate) {
              (slot as any).date = slot._isoDate;
            }
          }
        } else if (hasAnyTimes) {
          setIsDayMode(true);
        }

        const parsedSlots = rawParsed.map(({ _isoDate: _d, ...slot }: RawSlot) => slot);
        setSlots(parsedSlots);
      }
      const s = suggestion.settings;
      if (s && typeof s === "object") {
        if (typeof s.resultsPublic === "boolean") setResultsPublic(s.resultsPublic);
        if (typeof s.allowVoteEdit === "boolean") setAllowVoteEdit(s.allowVoteEdit);
        if (typeof s.allowVoteWithdrawal === "boolean") setAllowVoteWithdrawal(s.allowVoteWithdrawal);
        if (typeof s.notifyCreatorOnVote === "boolean") setNotifyCreatorOnVote(s.notifyCreatorOnVote);
        if (typeof s.allowMultipleSlots === "boolean") setAllowMultipleSlots(s.allowMultipleSlots);
      }
    } catch (_) {}
  }, []);

  const combineDateTime = (date: string, time: string): string | undefined => {
    if (!date || !time) return undefined;
    if (time.includes('T')) return undefined;
    try {
      const combined = new Date(`${date}T${time}`);
      if (isNaN(combined.getTime())) return undefined;
      return combined.toISOString();
    } catch {
      return undefined;
    }
  };

  const buildOptionsPayload = (slotsData: OrgaSlot[], useDayMode: boolean, dayDate: string, dates?: string[]) => {
    const filteredSlots = slotsData.filter(s => s.text.trim());
    
    if (useDayMode && dates && dates.length > 1) {
      const allOptions: any[] = [];
      const sortedDates = [...dates].sort();
      let globalOrder = 0;
      for (const date of sortedDates) {
        const dateLabel = (() => {
          const [y, m, d] = date.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d, 12, 0, 0);
          return dateObj.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: '2-digit' });
        })();
        for (const slot of filteredSlots) {
          allOptions.push({
            text: `${dateLabel} – ${slot.text.trim()}`,
            startTime: combineDateTime(date, slot.startTime || ""),
            endTime: combineDateTime(date, slot.endTime || ""),
            maxCapacity: slot.maxCapacity,
            order: globalOrder++,
          });
        }
      }
      return allOptions;
    }
    
    return filteredSlots.map((slot, idx) => {
      let startTimeISO: string | undefined;
      let endTimeISO: string | undefined;
      
      if (useDayMode && dayDate) {
        startTimeISO = combineDateTime(dayDate, slot.startTime || "");
        endTimeISO = combineDateTime(dayDate, slot.endTime || "");
      } else if (!useDayMode && slot.date) {
        startTimeISO = slot.startTime ? combineDateTime(slot.date, slot.startTime) : undefined;
        endTimeISO = slot.endTime ? combineDateTime(slot.date, slot.endTime) : undefined;
      }
      
      return {
        text: slot.text.trim(),
        startTime: startTimeISO,
        endTime: endTimeISO,
        maxCapacity: slot.maxCapacity,
        order: idx,
      };
    });
  };

  const hasInvalidTimeRange = (optionsData: Array<{ startTime?: string; endTime?: string }>) =>
    optionsData.some((option) => {
      if (!option.startTime || !option.endTime) return false;
      const start = new Date(option.startTime);
      const end = new Date(option.endTime);
      return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start;
    });

  useEffect(() => {
    if (autoSubmitTriggeredRef.current) return;
    if (!hasRestoredRef.current) return;
    if (!isAuthenticated) return;
    
    const stored = formPersistence.getStoredData();
    if (stored?.pendingSubmit && stored.data && title) {
      autoSubmitTriggeredRef.current = true;
      
      const storedExpiresAt = stored.data.expiresAt;
      const storedEnableExpiryReminder = stored.data.enableExpiryReminder ?? false;
      const storedExpiryReminderHours = stored.data.expiryReminderHours ?? 24;
      const storedIsDayMode = stored.data.isDayMode ?? false;
      const storedDayModeDate = stored.data.dayModeDate ?? "";
      const storedDayModeDates = stored.data.dayModeDates ?? (storedDayModeDate ? [storedDayModeDate] : []);
      formPersistence.clearStoredData();
      
      toast({
        title: t('pollCreation.autoSubmitting'),
        description: t('createOrganization.autoSubmitDescription'),
      });
      
      setTimeout(() => {
        const orgaData = buildOrganizationPayload(
          storedIsDayMode,
          storedDayModeDate,
          storedDayModeDates,
          storedExpiresAt || undefined,
          storedEnableExpiryReminder,
          storedExpiryReminderHours
        );
        if (!orgaData) return;
        createPollMutation.mutate(orgaData);
      }, 500);
    }
  }, [isAuthenticated, title, slots]);

  const createPollMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/v1/polls", data);
      return response.json();
    },
    onSuccess: (data) => {
      formPersistence.clearStoredData();
      
      const successData = {
        poll: data.poll,
        publicLink: `/poll/${data.publicToken}`,
        adminLink: `/admin/${data.adminToken}`,
        pollType: 'organization'
      };
      sessionStorage.setItem('poll-success-data', JSON.stringify(successData));
      setLocation(`/success/${data.adminToken}`);
    },
    onError: async (error: any) => {
      let errorMessage = t('createOrganization.createError');
      let requiresLogin = false;
      let requiresEmailVerification = false;
      
      if (error?.message) {
        try {
          const errorData = JSON.parse(error.message.split(': ').slice(1).join(': '));
          if (errorData.errorCode === 'REQUIRES_LOGIN' || errorData.errorCode === 'GUEST_POLL_CREATION_DISABLED') {
            errorMessage = errorData.error;
            requiresLogin = true;
          } else if (errorData.code === 'EMAIL_NOT_VERIFIED') {
            errorMessage = t('pollCreation.emailVerificationRequiredDescription');
            requiresEmailVerification = true;
          } else if (errorData.errorCode === 'INVALID_TIME_RANGE') {
            errorMessage = t('createPoll.invalidTimeRange');
          } else if (typeof errorData.retryAfter === 'number') {
            errorMessage = t('pollCreation.tooManyRequestsDescription', { seconds: errorData.retryAfter });
          }
        } catch {}
      }
      
      toast({
        title: requiresLogin
          ? t('pollCreation.loginRequired')
          : requiresEmailVerification
            ? t('pollCreation.emailVerificationRequired')
            : t('pollCreation.error'),
        description: requiresLogin 
          ? t('pollCreation.loginRequiredDescription')
          : errorMessage,
        variant: "destructive",
      });
      
      if (requiresLogin) {
        formPersistence.saveBeforeRedirect(
          {
            title,
            description,
            creatorEmail,
            enableExpiryReminder,
            expiryReminderHours,
            allowMultipleSlots,
            allowVoteEdit,
            allowVoteWithdrawal,
            resultsPublic,
            notifyCreatorOnVote,
            slots,
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            isDayMode,
            dayModeDate,
            dayModeDates
          },
          '/create-organization'
        );
        
        setTimeout(() => {
          const emailParam = creatorEmail ? `&email=${encodeURIComponent(creatorEmail)}` : '';
          setLocation(`/anmelden?returnTo=/create-organization${emailParam}`);
        }, 2000);
      }
    },
  });

  const recalcSlotTimes = (newDuration: number) => {
    if (!isDayMode) return;
    const firstSlot = slots[0];
    if (!firstSlot?.startTime || !firstSlot.startTime.match(/^\d{2}:\d{2}$/)) return;
    const [startH, startM] = firstSlot.startTime.split(':').map(Number);
    let currentMin = startH * 60 + startM;
    setSlots(slots.map((slot, idx) => {
      const sH = Math.floor(currentMin / 60).toString().padStart(2, '0');
      const sM = (currentMin % 60).toString().padStart(2, '0');
      const endMin = currentMin + newDuration;
      const eH = Math.floor(endMin / 60).toString().padStart(2, '0');
      const eM = (endMin % 60).toString().padStart(2, '0');
      currentMin = endMin;
      return { ...slot, startTime: `${sH}:${sM}`, endTime: `${eH}:${eM}`, order: idx };
    }));
  };

  const addSlot = () => {
    const id = String(nextSlotIdRef.current++);
    const lastSlot = slots[slots.length - 1];
    if (isDayMode && lastSlot?.endTime) {
      const [h, m] = lastSlot.endTime.split(':').map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + slotDuration;
      const newStart = `${Math.floor(startMin / 60).toString().padStart(2, '0')}:${(startMin % 60).toString().padStart(2, '0')}`;
      const newEnd = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
      setSlots([...slots, { id, text: "", startTime: newStart, endTime: newEnd, maxCapacity: undefined, order: slots.length }]);
    } else {
      let nextStartTime: string | undefined;
      let nextEndTime: string | undefined;

      if (!isDayMode && lastSlot?.endTime) {
        const [h, m] = lastSlot.endTime.split(':').map(Number);
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
          const startMin = h * 60 + m;
          const endMin = startMin + slotDuration;
          nextStartTime = `${Math.floor(startMin / 60).toString().padStart(2, '0')}:${(startMin % 60).toString().padStart(2, '0')}`;
          nextEndTime = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
        }
      }

      setSlots([
        ...slots,
        {
          id,
          text: "",
          date: !isDayMode ? lastSlot?.date : undefined,
          startTime: !isDayMode ? nextStartTime : undefined,
          endTime: !isDayMode ? nextEndTime : undefined,
          durationMinutes: !isDayMode ? (lastSlot?.durationMinutes ?? slotDuration) : undefined,
          maxCapacity: undefined,
          order: slots.length,
        }
      ]);
    }
  };

  const addNewDateGroup = () => {
    const id = String(nextSlotIdRef.current++);
    setSlots((currentSlots) => [
      ...currentSlots,
      {
        id,
        text: "",
        maxCapacity: undefined,
        order: currentSlots.length,
      },
    ]);
  };

  const addNextSlotForRow = (index: number) => {
    const sourceSlot = slots[index];
    if (!sourceSlot?.date || !sourceSlot.endTime) return;

    const nextStartMinutes = parseTimeToMinutes(sourceSlot.endTime);
    const durationMinutes =
      sourceSlot.durationMinutes ??
      getDurationFromTimes(sourceSlot.startTime, sourceSlot.endTime) ??
      slotDuration;

    if (nextStartMinutes === null || !durationMinutes) return;

    const id = String(nextSlotIdRef.current++);
    const nextStartTime = formatMinutesToTime(nextStartMinutes);
    const nextEndTime = formatMinutesToTime(nextStartMinutes + durationMinutes);

    setSlots((currentSlots) => {
      const newSlot: OrgaSlot = {
        id,
        text: "",
        date: sourceSlot.date,
        startTime: nextStartTime,
        endTime: nextEndTime,
        durationMinutes,
        maxCapacity: sourceSlot.maxCapacity,
        order: index + 1,
      };

      const updatedSlots = [...currentSlots];
      updatedSlots.splice(index + 1, 0, newSlot);
      return updatedSlots.map((slot, slotIndex) => ({ ...slot, order: slotIndex }));
    });
  };

  const addSlotToDateGroup = (date: string | undefined, lastIndex: number) => {
    const sourceSlot = slots[lastIndex];
    if (!sourceSlot) return;

    const durationMinutes =
      sourceSlot.durationMinutes ??
      getDurationFromTimes(sourceSlot.startTime, sourceSlot.endTime) ??
      slotDuration;

    const nextStartMinutes = parseTimeToMinutes(sourceSlot.endTime);
    const nextStartTime = nextStartMinutes !== null ? formatMinutesToTime(nextStartMinutes) : undefined;
    const nextEndTime =
      nextStartMinutes !== null && durationMinutes
        ? formatMinutesToTime(nextStartMinutes + durationMinutes)
        : undefined;

    const id = String(nextSlotIdRef.current++);

    setSlots((currentSlots) => {
      const updatedSlots = [...currentSlots];
      updatedSlots.splice(lastIndex + 1, 0, {
        id,
        text: "",
        date,
        startTime: nextStartTime,
        endTime: nextEndTime,
        durationMinutes,
        maxCapacity: sourceSlot.maxCapacity,
        order: lastIndex + 1,
      });
      return updatedSlots.map((slot, slotIndex) => ({ ...slot, order: slotIndex }));
    });
  };

  const createSlotsFromTemplateForDateGroup = (
    groupDate: string | undefined,
    indexes: number[],
    templateId: string,
    durationMinutes: number
  ) => {
    if (!groupDate || indexes.length === 0) return;

    const templateSlots = getTemplateSlots(templateId, durationMinutes);
    const baseId = nextSlotIdRef.current;
    nextSlotIdRef.current += templateSlots.length;

    setSlots((currentSlots) => {
      const replacementSlots: OrgaSlot[] = templateSlots.map((slot, idx) => ({
        id: String(baseId + idx),
        text: slot.description,
        date: groupDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: getDurationFromTimes(slot.startTime, slot.endTime) ?? durationMinutes,
        templateSourceId: templateId,
        pendingTemplateId: templateId,
        maxCapacity: slot.capacity,
        order: idx,
      }));

      const firstIndex = Math.min(...indexes);
      const filteredSlots = currentSlots.filter((_, slotIndex) => !indexes.includes(slotIndex));
      filteredSlots.splice(firstIndex, 0, ...replacementSlots);
      return filteredSlots.map((slot, slotIndex) => ({ ...slot, order: slotIndex }));
    });

    toast({
      title: t('createOrganization.templateApplied'),
      description: t('createOrganization.templateAppliedDescription', { count: templateSlots.length }),
    });
  };

  const generateSlotsFromDuration = (startHour: number, endHour: number, durationMinutes: number, description: string, capacity?: number) => {
    const newSlots: OrgaSlot[] = [];
    let current = startHour * 60;
    const end = endHour * 60;
    let idx = 0;
    while (current + durationMinutes <= end) {
      const startH = Math.floor(current / 60).toString().padStart(2, '0');
      const startM = (current % 60).toString().padStart(2, '0');
      const endMin = current + durationMinutes;
      const endH = Math.floor(endMin / 60).toString().padStart(2, '0');
      const endM = (endMin % 60).toString().padStart(2, '0');
      newSlots.push({
        id: `gen-${idx}`,
        text: `${description} ${idx + 1}`,
        startTime: `${startH}:${startM}`,
        endTime: `${endH}:${endM}`,
        maxCapacity: capacity,
        order: idx,
      });
      current = endMin;
      idx++;
    }
    return newSlots;
  };

  const getTemplateSlots = (templateId: string, duration: number = slotDuration): OrgaTemplate['slots'] => {
    switch (templateId) {
      case 'morning-slots':
        return generateSlotsFromDuration(8, 12, duration, "", 5).map(s => ({
          description: "", startTime: s.startTime!, endTime: s.endTime!, capacity: s.maxCapacity,
        }));
      case 'afternoon-slots':
        return generateSlotsFromDuration(13, 17, duration, "", 5).map(s => ({
          description: "", startTime: s.startTime!, endTime: s.endTime!, capacity: s.maxCapacity,
        }));
      case 'full-day':
        return generateSlotsFromDuration(8, 17, duration, "", 5).map(s => ({
          description: "", startTime: s.startTime!, endTime: s.endTime!, capacity: s.maxCapacity,
        }));
      case 'consultation':
        return generateSlotsFromDuration(9, 11, 20, t('createOrganization.templates.consultSlot', { num: '' }), 1)
          .map((s, i) => ({
            description: t('createOrganization.templates.consultSlot', { num: i + 1 }),
            startTime: s.startTime!, endTime: s.endTime!, capacity: 1,
          }));
      default:
        return [];
    }
  };

  const orgaTemplateDefinitions = [
    { id: "morning-slots", nameKey: "createOrganization.templates.morningSlots.name", descriptionKey: "createOrganization.templates.morningSlots.description", icon: Coffee },
    { id: "afternoon-slots", nameKey: "createOrganization.templates.afternoonSlots.name", descriptionKey: "createOrganization.templates.afternoonSlots.description", icon: Clock },
    { id: "full-day", nameKey: "createOrganization.templates.fullDay.name", descriptionKey: "createOrganization.templates.fullDay.description", icon: Repeat },
    { id: "consultation", nameKey: "createOrganization.templates.consultation.name", descriptionKey: "createOrganization.templates.consultation.description", icon: Sparkles },
  ];

  const updateTemplateDialogDraft = (
    groupKey: string,
    updates: { templateId?: string; durationMinutes?: number }
  ) => {
    setTemplateDialogDrafts((drafts) => ({
      ...drafts,
      [groupKey]: {
        ...drafts[groupKey],
        ...updates,
      },
    }));
  };

  const handleResetSlots = () => {
    if (!resetConfirming) {
      setResetConfirming(true);
      return;
    }
    setResetConfirming(false);
    nextSlotIdRef.current = 1;
    setSlots([{ id: "0", text: "", maxCapacity: undefined, order: 0 }]);
    setDayModeDates([]);
    setDayModeDate("");
    setSlotDuration(30);
  };

  const removeSlot = (index: number) => {
    if (slots.length > 1) {
      setSlots(slots.filter((_, i) => i !== index));
    }
  };

  const updateSlot = (index: number, updates: Partial<OrgaSlot>) => {
    const newSlots = [...slots];
    const shouldClearTemplateSource =
      'text' in updates ||
      'startTime' in updates ||
      'endTime' in updates ||
      'maxCapacity' in updates ||
      'durationMinutes' in updates;
    newSlots[index] = {
      ...newSlots[index],
      ...updates,
      ...(shouldClearTemplateSource ? { templateSourceId: undefined } : {}),
    };
    setSlots(newSlots);
  };

  const updateSlots = (indexes: number[], updates: Partial<OrgaSlot>) => {
    setSlots((currentSlots) =>
      currentSlots.map((slot, slotIndex) =>
        indexes.includes(slotIndex) ? { ...slot, ...updates } : slot
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pollData = buildOrganizationPayload(false, "", []);
    if (!pollData) return;
    createPollMutation.mutate(pollData);
  };

  const buildOrganizationPayload = (
    useDayMode: boolean,
    useDayModeDate: string,
    useDayModeDates: string[],
    overriddenExpiresAt?: string,
    overriddenEnableExpiryReminder?: boolean,
    overriddenExpiryReminderHours?: number
  ) => {
    if (!title.trim()) {
      toast({
        title: t('pollCreation.error'),
        description: t('pollCreation.pleaseEnterTitle'),
        variant: "destructive",
      });
      return null;
    }

    const incompleteSlots = slots.filter(s => !s.text.trim() && (s.startTime || s.endTime || s.maxCapacity));
    if (incompleteSlots.length > 0) {
      toast({
        title: t('pollCreation.error'),
        description: t('createOrganization.slotsMissingDescription'),
        variant: "destructive",
      });
      return null;
    }

    const validSlots = slots.filter(s => s.text.trim());
    if (validSlots.length < 1) {
      toast({
        title: t('pollCreation.error'),
        description: t('createOrganization.minSlotsError'),
        variant: "destructive",
      });
      return null;
    }

    if (useDayMode && useDayModeDates.length === 0) {
      toast({
        title: t('pollCreation.error'),
        description: t('createOrganization.dayModeDateError'),
        variant: "destructive",
      });
      return null;
    }

    if (!useDayMode && validSlots.some((slot) => !slot.date)) {
      toast({
        title: t('pollCreation.error'),
        description: t('createOrganization.customModeDateError'),
        variant: "destructive",
      });
      return null;
    }

    if (!isAuthenticated && !creatorEmail.trim()) {
      toast({
        title: t('pollCreation.error'),
        description: t('pollCreation.pleaseEnterEmail'),
        variant: "destructive",
      });
      return null;
    }

    const optionsData = buildOptionsPayload(validSlots, useDayMode, useDayModeDate, useDayModeDates);
    if (hasInvalidTimeRange(optionsData)) {
      toast({
        title: t('pollCreation.error'),
        description: t('createPoll.invalidTimeRange'),
        variant: "destructive",
      });
      return null;
    }

    const now = new Date();
    const hasPastSlot = optionsData.some(opt => {
      const ref = opt.startTime ?? opt.endTime;
      if (!ref) return false;
      const when = new Date(ref);
      return !isNaN(when.getTime()) && when <= now;
    });
    if (hasPastSlot) {
      toast({
        title: t('pollCreation.error'),
        description: t('createOrganization.pastSlotError'),
        variant: "destructive",
      });
      return null;
    }

    const effectiveExpiresAt = overriddenExpiresAt ?? (expiresAt ? expiresAt.toISOString() : undefined);
    const effectiveEnableExpiryReminder = overriddenEnableExpiryReminder ?? enableExpiryReminder;
    const effectiveExpiryReminderHours = overriddenExpiryReminderHours ?? expiryReminderHours;

    return {
      title: title.trim(),
      description: description.trim() || undefined,
      type: "organization" as const,
      creatorEmail: isAuthenticated ? undefined : creatorEmail.trim(),
      expiresAt: effectiveExpiresAt,
      enableExpiryReminder: !!effectiveExpiresAt ? effectiveEnableExpiryReminder : false,
      expiryReminderHours: !!effectiveExpiresAt && effectiveEnableExpiryReminder ? effectiveExpiryReminderHours : undefined,
      allowMultipleSlots,
      allowVoteEdit,
      allowVoteWithdrawal,
      resultsPublic,
      notifyCreatorOnVote,
      options: optionsData,
    };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('pollCreation.back')}
        </Button>
        <h1 className="text-3xl font-bold text-foreground" data-testid="title-create-orga">{t('createOrganization.pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('createOrganization.pageSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-green-600" />
              {t('pollCreation.basicInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">{t('createOrganization.titleLabel')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('createOrganization.titlePlaceholder')}
                className="mt-1"
                required
                data-testid="input-title"
              />
            </div>
            
            <div>
              <Label htmlFor="description">{t('pollCreation.descriptionOptional')}</Label>
              <MarkdownEditor
                id="description"
                value={description}
                onChange={setDescription}
                placeholder={t('createOrganization.descriptionPlaceholder')}
                className="mt-1"
                rows={4}
              />
            </div>

            <div>
              <Label>{t('pollCreation.expiryDateOptional')}</Label>
              <div className="mt-1">
                <DatePicker
                  date={expiresAt}
                  onDateChange={setExpiresAt}
                  placeholder={t('pollCreation.datePlaceholder')}
                  minDate={new Date()}
                  data-testid="input-expires-at"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('pollCreation.expiryHintOrga')}
              </p>
            </div>

            {expiresAt && (() => {
              const hoursUntilExpiry = Math.max(0, (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
              const isTooShort = hoursUntilExpiry < 6;
              const maxReminderHours = Math.min(168, Math.floor(hoursUntilExpiry * 0.8));
              
              return (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        {t('pollCreation.expiryReminder')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {isTooShort 
                          ? t('pollCreation.expiryTooShort', { hours: hoursUntilExpiry.toFixed(0) })
                          : t('pollCreation.expiryReminderDescription')
                        }
                      </p>
                    </div>
                    <Switch
                      checked={enableExpiryReminder && !isTooShort}
                      onCheckedChange={setEnableExpiryReminder}
                      disabled={isTooShort}
                      data-testid="switch-expiry-reminder"
                    />
                  </div>
                  
                  {enableExpiryReminder && !isTooShort && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Label htmlFor="reminderHours" className="shrink-0">{t('pollCreation.sendReminder')}</Label>
                        <Input
                          id="reminderHours"
                          type="number"
                          min={1}
                          max={maxReminderHours}
                          value={Math.min(expiryReminderHours, maxReminderHours)}
                          onChange={(e) => setExpiryReminderHours(Math.min(parseInt(e.target.value) || 24, maxReminderHours))}
                          className="w-20"
                          data-testid="input-reminder-hours"
                        />
                        <span className="text-sm text-muted-foreground">{t('pollCreation.hoursBeforeExpiry')}</span>
                      </div>
                      {expiryReminderHours > maxReminderHours && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {t('pollCreation.maxReminderHours', { hours: maxReminderHours })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {isAuthenticated ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-green-800 dark:text-green-200">
                      {t('pollCreation.loggedInAs', { name: user?.name || user?.username })}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      {t('pollCreation.linksWillBeSentTo')} <strong>{user?.email}</strong>
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-green-700 dark:text-green-300">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        <span>{t('pollCreation.participationLink')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        <span>{t('pollCreation.privateAdminLink')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4" />
                        <span>{t('pollCreation.qrCodeShare')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      {t('pollCreation.emailForNotifications')}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {t('pollCreation.emailNotificationDescription')}
                    </p>
                    <Input
                      type="email"
                      value={creatorEmail}
                      onChange={(e) => setCreatorEmail(e.target.value)}
                      placeholder={t('pollCreation.emailPlaceholder')}
                      className="mt-3"
                      required
                      data-testid="input-creator-email"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="polly-card">
          <CardHeader className={settingsExpanded ? "pb-0" : ""}>
            <button
              type="button"
              onClick={() => setSettingsExpanded(p => !p)}
              className="flex items-center justify-between w-full text-left"
              aria-expanded={settingsExpanded}
            >
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-green-600" />
                {t('createOrganization.settings')}
              </CardTitle>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${settingsExpanded ? "rotate-180" : ""}`} />
            </button>
          </CardHeader>
          {settingsExpanded && (
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('createOrganization.allowMultipleSlots')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('createOrganization.allowMultipleSlotsDescription')}
                  </p>
                </div>
                <Switch
                  checked={allowMultipleSlots}
                  onCheckedChange={setAllowMultipleSlots}
                  data-testid="switch-multiple-slots"
                  aria-label={t('createOrganization.allowMultipleSlots')}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('pollCreation.allowVoteEdit')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('createOrganization.allowEntryEditDescription')}
                  </p>
                </div>
                <Switch
                  checked={allowVoteEdit}
                  onCheckedChange={setAllowVoteEdit}
                  data-testid="switch-allow-vote-edit"
                  aria-label={t('pollCreation.allowVoteEdit')}
                />
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label>{t('pollCreation.allowVoteWithdrawal')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('createOrganization.allowEntryWithdrawalDescription')}
                  </p>
                </div>
                <Switch
                  checked={allowVoteWithdrawal}
                  onCheckedChange={setAllowVoteWithdrawal}
                  data-testid="switch-allow-vote-withdrawal"
                  aria-label={t('pollCreation.allowVoteWithdrawal')}
                />
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label>{t('pollCreation.resultsPublic')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('pollCreation.resultsPublicDescription')}
                  </p>
                </div>
                <Switch
                  checked={resultsPublic}
                  onCheckedChange={setResultsPublic}
                  data-testid="switch-results-public"
                  aria-label={t('pollCreation.resultsPublic')}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label>{t('pollCreation.notifyCreatorOnVote')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('pollCreation.notifyCreatorOnVoteDescription')}
                  </p>
                </div>
                <Switch
                  checked={notifyCreatorOnVote}
                  onCheckedChange={setNotifyCreatorOnVote}
                  data-testid="switch-notify-creator-on-vote"
                  aria-label={t('pollCreation.notifyCreatorOnVote')}
                />
              </div>

            </CardContent>
          )}
        </Card>

        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-green-600" />
              {t('createOrganization.slots')}
            </CardTitle>
            <CardDescription className="flex items-start gap-2 mt-2 rounded-lg border bg-muted/20 p-3">
              <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <span>
                {t('createOrganization.slotsBuilderHint')}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Slot list with column headers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('createOrganization.slotListHintCustom')}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={resetConfirming ? "destructive" : "ghost"}
                    size="sm"
                    onClick={handleResetSlots}
                    className={resetConfirming ? "" : "text-muted-foreground hover:text-destructive"}
                    data-testid="button-reset-slots"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    {resetConfirming ? t('createOrganization.resetConfirm') : t('createOrganization.resetSlots')}
                  </Button>
                  <Button
                    type="button"
                    onClick={addNewDateGroup}
                    variant="outline"
                    size="sm"
                    data-testid="button-add-slot-bottom"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('createOrganization.addNewDate')}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {customDateGroups.map((group) => {
                  const lastIndex = group.slots[group.slots.length - 1]?.index;
                  const groupDate = group.date;
                  const dateValue = groupDate ? (() => {
                    const [y, m, d] = groupDate.split('-').map(Number);
                    return new Date(y, m - 1, d);
                  })() : null;
                  const groupIndexes = group.slots.map(({ index }) => index);
                  const templateDraft = templateDialogDrafts[group.key] ?? {};
                  const selectedTemplateId = templateDraft.templateId;
                  const selectedDuration = templateDraft.durationMinutes;

                  return (
                    <div key={group.key} className="overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
                      <div className="border-b bg-background/90 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <CalendarDays className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">{t('createOrganization.date')}</p>
                              <DatePicker
                                date={dateValue}
                                onDateChange={(date) => {
                                  const dateStr = date
                                    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                                    : undefined;
                                  updateSlots(groupIndexes, { date: dateStr });
                                }}
                                placeholder={t('createOrganization.selectDate')}
                                buttonClassName="w-[220px] bg-background"
                                data-testid={`input-group-date-${group.key}`}
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setTemplateDialogGroupKey(group.key)}
                            className="shrink-0"
                            data-testid={`button-open-template-dialog-${group.key}`}
                          >
                            <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                            {t('createOrganization.templates.title')}
                          </Button>
                        </div>

                        <Dialog
                          open={templateDialogGroupKey === group.key}
                          onOpenChange={(open) => setTemplateDialogGroupKey(open ? group.key : null)}
                        >
                          <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                {t('createOrganization.templates.dialogTitle')}
                              </DialogTitle>
                              <DialogDescription>
                                {t('createOrganization.templates.dialogDescription')}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">{t('createOrganization.date')}</Label>
                                <Calendar
                                  mode="single"
                                  selected={undefined}
                                  onSelect={(date) => {
                                    const dateStr = date
                                      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                                      : undefined;
                                    updateSlots(groupIndexes, { date: dateStr });
                                  }}
                                  disabled={(date) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return date < today;
                                  }}
                                  modifiers={{
                                    selected: (date) => (
                                      !!dateValue &&
                                      date.toDateString() === dateValue.toDateString()
                                    ),
                                  }}
                                  modifiersStyles={{
                                    selected: {
                                      backgroundColor: 'hsl(var(--primary))',
                                      color: 'white',
                                      borderRadius: '50%',
                                      fontWeight: 'bold',
                                    },
                                  }}
                                  locale={dateLocale}
                                  weekStartsOn={1}
                                  classNames={{
                                    cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                                    day_today: "border border-primary/40 bg-background text-foreground rounded-full",
                                  }}
                                  className="mx-auto w-fit rounded-md border sm:mx-0"
                                  data-testid={`input-template-date-${group.key}`}
                                />
                                {groupDate && (
                                  <p className="text-sm font-medium text-primary">
                                    {t('createOrganization.date')}:{" "}
                                    {new Date(groupDate).toLocaleDateString(
                                      i18n.language === "de" ? "de-DE" : "en-US",
                                      { weekday: "short", day: "numeric", month: "short", year: "numeric" }
                                    )}
                                  </p>
                                )}
                              </div>

                              <div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {orgaTemplateDefinitions.map((template) => {
                                    const Icon = template.icon;
                                    return (
                                      <button
                                        key={`${group.key}-${template.id}`}
                                        type="button"
                                        onClick={() => updateTemplateDialogDraft(group.key, { templateId: template.id })}
                                        className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                                          selectedTemplateId === template.id
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-background hover:border-primary/40 hover:bg-accent/40'
                                        }`}
                                        data-testid={`group-template-${group.key}-${template.id}`}
                                      >
                                        <Icon className="mt-0.5 w-4 h-4 text-amber-500 shrink-0" />
                                        <div>
                                          <p className="text-sm font-medium">{t(template.nameKey)}</p>
                                          <p className="text-xs text-muted-foreground leading-tight">{t(template.descriptionKey)}</p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2 text-sm">
                                    <Timer className="w-4 h-4 text-amber-500" />
                                    {t('createOrganization.slotDuration')}
                                  </Label>
                                  <span className="text-xs text-muted-foreground">
                                    {selectedDuration
                                      ? t('createOrganization.templates.durationNote', { duration: selectedDuration })
                                      : t('createOrganization.templates.durationHint')}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                                  {DURATION_OPTIONS.map((duration) => (
                                    <button
                                      key={`${group.key}-${duration}`}
                                      type="button"
                                      onClick={() => updateTemplateDialogDraft(group.key, { durationMinutes: duration })}
                                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                                        selectedDuration === duration
                                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                          : 'bg-background border-border hover:border-primary/40 hover:bg-accent/50 text-foreground'
                                      }`}
                                      data-testid={`group-duration-${group.key}-${duration}`}
                                    >
                                      {duration} {t('createOrganization.minutes')}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {selectedTemplateId && selectedDuration && (() => {
                                const preview = getTemplateSlots(selectedTemplateId, selectedDuration);
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm font-medium">{t('createOrganization.templates.preview')}</Label>
                                      <span className="text-xs text-muted-foreground">
                                        {t('createOrganization.templates.previewCount', { count: preview.length })}
                                      </span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/20 p-2 space-y-1">
                                      {preview.map((slot, i) => (
                                        <div key={i} className="flex items-center gap-3 px-2 py-1 rounded text-sm bg-background border">
                                          <span className="font-mono text-primary shrink-0">{slot.startTime} – {slot.endTime}</span>
                                          {slot.capacity && (
                                            <span className="text-xs text-muted-foreground">max {slot.capacity}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t('createOrganization.templates.previewHint')}</p>
                                  </div>
                                );
                              })()}

                              {!groupDate && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                  {t('createOrganization.templates.selectDateFirst')}
                                </div>
                              )}
                            </div>

                            <DialogFooter className="border-t bg-background pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setTemplateDialogGroupKey(null)}
                              >
                                {t('pollCreation.cancel')}
                              </Button>
                              <Button
                                type="button"
                                onClick={() => {
                                  if (!selectedTemplateId || !selectedDuration) return;
                                  createSlotsFromTemplateForDateGroup(groupDate, groupIndexes, selectedTemplateId, selectedDuration);
                                  setTemplateDialogGroupKey(null);
                                }}
                                disabled={!groupDate || !selectedTemplateId || !selectedDuration}
                                data-testid={`button-create-template-slots-${group.key}`}
                              >
                                <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                                {t('createOrganization.createSlots')}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="space-y-3 p-4">
                        {group.slots.map(({ slot, index }) => (
                          <CustomSlotRow
                            key={slot.id}
                            slot={slot}
                            index={index}
                            slotsLength={slots.length}
                            updateSlot={updateSlot}
                            removeSlot={removeSlot}
                            t={t}
                          />
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => lastIndex !== undefined && addSlotToDateGroup(groupDate, lastIndex)}
                          disabled={lastIndex === undefined || !groupDate}
                          className="w-full border-dashed bg-background/70 text-muted-foreground hover:text-foreground"
                          data-testid={`button-add-slot-group-${group.key}`}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {t('createOrganization.addSlot')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/")}
            data-testid="button-cancel"
          >
            {t('pollCreation.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={createPollMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-submit"
          >
            {createPollMutation.isPending ? t('createOrganization.creatingButton') : t('createOrganization.submitButton')}
          </Button>
        </div>
      </form>
    </div>
  );
}
