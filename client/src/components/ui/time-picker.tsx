import * as React from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TimePickerProps {
  time: string | undefined
  onTimeChange: (time: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  "data-testid"?: string
}

const TIME_PRESETS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00"
]

export function TimePicker({
  time,
  onTimeChange,
  placeholder = "Uhrzeit",
  className,
  disabled = false,
  "data-testid": testId,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (selectedTime: string) => {
    onTimeChange(selectedTime)
    setOpen(false)
  }

  const formatTime = (t: string) => {
    return t + " Uhr"
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[130px] justify-start text-left font-normal",
            !time && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          data-testid={testId}
        >
          <Clock className="mr-2 h-4 w-4" />
          {time ? formatTime(time) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0" align="start">
        <ScrollArea className="h-[280px]">
          <div className="p-2 space-y-1">
            {TIME_PRESETS.map((preset) => (
              <Button
                key={preset}
                variant={time === preset ? "default" : "ghost"}
                className="w-full justify-start font-normal"
                onClick={() => handleSelect(preset)}
              >
                {formatTime(preset)}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
