import * as React from "react"
import { format } from "date-fns"
import { de, enUS } from "date-fns/locale"
import { Calendar as CalendarIcon, Clock, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DateTimePickerProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder?: string
  minDate?: Date
  className?: string
  disabled?: boolean
  showClearButton?: boolean
  "data-testid"?: string
}

const TIME_PRESETS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00"
]

export function DateTimePicker({
  value,
  onChange,
  placeholder,
  minDate,
  className,
  disabled = false,
  showClearButton = true,
  "data-testid": testId,
}: DateTimePickerProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => {
    if (value) {
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? undefined : parsed
    }
    return undefined
  })
  const [selectedTime, setSelectedTime] = React.useState<string>(() => {
    if (value) {
      const parsed = new Date(value)
      if (!isNaN(parsed.getTime())) {
        return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
      }
    }
    return "09:00"
  })

  const locale = i18n.language === 'de' ? de : enUS
  const displayPlaceholder = placeholder ?? t('ui.dateTimePicker.placeholder')
  const timeLabel = t('ui.dateTimePicker.timeLabel')
  const timeSuffix = t('ui.timePicker.suffix')

  React.useEffect(() => {
    if (value) {
      const parsed = new Date(value)
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed)
        setSelectedTime(`${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`)
      }
    } else {
      setSelectedDate(undefined)
    }
  }, [value])

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date) {
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const combined = new Date(date)
      combined.setHours(hours, minutes, 0, 0)
      onChange(combined.toISOString())
    }
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
    if (selectedDate) {
      const [hours, minutes] = time.split(':').map(Number)
      const combined = new Date(selectedDate)
      combined.setHours(hours, minutes, 0, 0)
      onChange(combined.toISOString())
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDate(undefined)
    onChange(undefined)
  }

  const formatTimeWithSuffix = (time: string) => {
    return timeSuffix ? `${time} ${timeSuffix}` : time
  }

  const displayValue = selectedDate
    ? `${format(selectedDate, "P", { locale })}, ${selectedTime}`
    : null

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[220px] justify-start text-left font-normal",
              !displayValue && "text-muted-foreground"
            )}
            disabled={disabled}
            data-testid={testId}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue || displayPlaceholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="border-r">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={minDate ? (d) => d < minDate : undefined}
                initialFocus
                locale={locale}
                weekStartsOn={1}
              />
            </div>
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 pb-2 border-b mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{timeLabel}</span>
              </div>
              <ScrollArea className="h-[260px] w-[100px]">
                <div className="space-y-1">
                  {TIME_PRESETS.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "ghost"}
                      size="sm"
                      className="w-full justify-start font-normal"
                      onClick={() => handleTimeSelect(time)}
                    >
                      {formatTimeWithSuffix(time)}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {showClearButton && displayValue && (
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
