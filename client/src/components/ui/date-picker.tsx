import * as React from "react"
import { format } from "date-fns"
import { de, enUS } from "date-fns/locale"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | null | undefined
  onDateChange: (date: Date | null) => void
  placeholder?: string
  minDate?: Date
  className?: string
  buttonClassName?: string
  disabled?: boolean
  showClearButton?: boolean
  inline?: boolean
  "data-testid"?: string
}

export function DatePicker({
  date,
  onDateChange,
  placeholder,
  minDate,
  className,
  buttonClassName,
  disabled = false,
  showClearButton = true,
  inline = false,
  "data-testid": testId,
}: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = React.useState(false)

  const locale = i18n.language === 'de' ? de : enUS
  const displayPlaceholder = placeholder ?? t('ui.datePicker.placeholder')
  const calendarClassNames = {
    cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
    day_today: "border border-primary/40 bg-background text-foreground rounded-full",
  }
  const calendarModifiersStyles = {
    selected: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'white',
      borderRadius: '50%',
      fontWeight: 'bold',
    },
  }

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const dateWithEndOfDay = new Date(selectedDate)
      dateWithEndOfDay.setHours(23, 59, 59, 999)
      onDateChange(dateWithEndOfDay)
    } else {
      onDateChange(null)
    }
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDateChange(null)
    setOpen(false)
  }

  const isBeforeMinDate = (d: Date) => {
    if (!minDate) return false
    const selectedDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const minDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime()
    return selectedDay < minDay
  }

  if (inline) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !date && "text-muted-foreground",
              buttonClassName
            )}
            disabled={disabled}
            onClick={() => setOpen(!open)}
            data-testid={testId}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "P", { locale }) : displayPlaceholder}
          </Button>
          {showClearButton && date && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground h-8 w-8 p-0"
              data-testid={testId ? `${testId}-clear` : undefined}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {open && (
          <div className="rounded-md border bg-popover p-0 shadow-md">
            <Calendar
              mode="single"
              selected={date || undefined}
              onSelect={handleSelect}
              disabled={minDate ? isBeforeMinDate : undefined}
              initialFocus
              locale={locale}
              weekStartsOn={1}
              classNames={calendarClassNames}
              modifiersStyles={calendarModifiersStyles}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !date && "text-muted-foreground",
              buttonClassName
            )}
            disabled={disabled}
            data-testid={testId}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "P", { locale }) : displayPlaceholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="start"
        >
          <Calendar
            mode="single"
            selected={date || undefined}
            onSelect={handleSelect}
            disabled={minDate ? isBeforeMinDate : undefined}
            initialFocus
            locale={locale}
            weekStartsOn={1}
            classNames={calendarClassNames}
            modifiersStyles={calendarModifiersStyles}
          />
        </PopoverContent>
      </Popover>
      {showClearButton && date && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-muted-foreground h-8 w-8 p-0"
          data-testid={testId ? `${testId}-clear` : undefined}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
