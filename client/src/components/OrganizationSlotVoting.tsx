import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Check, MessageCircle } from 'lucide-react';
import { type PollOption } from '@shared/schema';
import { formatScheduleOptionText } from '@/lib/utils';

function FormattedOptionText({ text }: { text: string }) {
  const parsed = formatScheduleOptionText(text);
  if (parsed) {
    return <><span className="font-bold">{parsed.date}</span> {parsed.time}</>;
  }
  return <>{text}</>;
}

interface SlotBookingInfo {
  optionId: number;
  comment?: string;
}

interface OrganizationSlotVotingProps {
  options: PollOption[];
  allowMultipleSlots: boolean;
  onBookingChange: (bookings: SlotBookingInfo[]) => void;
  existingBookings?: SlotBookingInfo[];
  disabled?: boolean;
  adminPreview?: boolean;
  currentSignups?: Record<number, { count: number; maxCapacity: number; names: string[] }>;
}

export function OrganizationSlotVoting({ 
  options, 
  allowMultipleSlots,
  onBookingChange,
  existingBookings = [],
  disabled = false,
  adminPreview = false,
  currentSignups = {}
}: OrganizationSlotVotingProps) {
  const [bookings, setBookings] = useState<SlotBookingInfo[]>(existingBookings);
  const [comments, setComments] = useState<Record<number, string>>({});

  const isSlotBooked = (optionId: number) => {
    return bookings.some(b => b.optionId === optionId);
  };

  const getSlotCapacity = (optionId: number) => {
    const signupInfo = currentSignups[optionId];
    if (signupInfo) {
      return {
        current: signupInfo.count,
        max: signupInfo.maxCapacity,
        names: signupInfo.names
      };
    }
    const option = options.find(o => o.id === optionId);
    return {
      current: 0,
      max: option?.maxCapacity || 1,
      names: []
    };
  };

  const isSlotFull = (optionId: number) => {
    const capacity = getSlotCapacity(optionId);
    return capacity.current >= capacity.max;
  };

  const toggleSlot = (optionId: number) => {
    if (disabled || adminPreview) return;
    
    let newBookings: SlotBookingInfo[];
    
    if (isSlotBooked(optionId)) {
      newBookings = bookings.filter(b => b.optionId !== optionId);
    } else {
      if (isSlotFull(optionId)) {
        return;
      }
      
      if (!allowMultipleSlots) {
        newBookings = [{ optionId, comment: comments[optionId] }];
      } else {
        newBookings = [...bookings, { optionId, comment: comments[optionId] }];
      }
    }
    
    setBookings(newBookings);
    onBookingChange(newBookings);
  };

  const updateComment = (optionId: number, comment: string) => {
    setComments(prev => ({ ...prev, [optionId]: comment }));
    
    if (isSlotBooked(optionId)) {
      const newBookings = bookings.map(b => 
        b.optionId === optionId ? { ...b, comment } : b
      );
      setBookings(newBookings);
      onBookingChange(newBookings);
    }
  };

  const formatDateTime = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return null;
    try {
      const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return date.toLocaleString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-4">
      {!allowMultipleSlots && bookings.length === 0 && !adminPreview && (
        <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg">
          <strong>Hinweis:</strong> Sie können sich nur für einen Slot eintragen.
        </div>
      )}
      
      {/* Column Headers */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
        <span>Bezeichnung</span>
        <span className="w-24 text-center">Freie Plätze</span>
        <span className="w-32 text-center">Aktion</span>
      </div>
      
      {options.map((option) => {
        const isBooked = isSlotBooked(option.id);
        const capacity = getSlotCapacity(option.id);
        const isFull = capacity.current >= capacity.max;
        const progressPercent = capacity.max > 0 ? (capacity.current / capacity.max) * 100 : 0;
        const startTime = formatDateTime(option.startTime);
        const endTime = formatDateTime(option.endTime);
        
        return (
          <div 
            key={option.id} 
            className={`border rounded-lg p-4 transition-all ${
              isBooked 
                ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                : isFull 
                  ? 'border-gray-300 bg-gray-50 dark:bg-gray-900 opacity-60'
                  : 'border-border hover:border-green-300 hover:bg-green-50/50'
            }`}
            data-testid={`slot-option-${option.id}`}
          >
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-lg"><FormattedOptionText text={option.text} /></h4>
                    {(startTime || endTime) && (
                      <p className="text-sm text-muted-foreground flex items-center mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime}
                      </p>
                    )}
                  </div>
                  
                  <Badge 
                    variant={isFull ? 'secondary' : 'default'}
                    className={isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}
                  >
                    <Users className="w-3 h-3 mr-1" />
                    {capacity.current}/{capacity.max}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {isFull 
                      ? 'Ausgebucht'
                      : `Noch ${capacity.max - capacity.current} ${capacity.max - capacity.current === 1 ? 'Platz' : 'Plätze'} frei`
                    }
                  </p>
                </div>
                
                {capacity.names.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Eingetragen: </span>
                    {capacity.names.join(', ')}
                  </div>
                )}
                
                {isBooked && !adminPreview && (
                  <div className="mt-3">
                    <Label className="text-sm flex items-center mb-1">
                      <MessageCircle className="w-3 h-3 mr-1" />
                      Kommentar (optional)
                    </Label>
                    <Textarea
                      value={comments[option.id] || ''}
                      onChange={(e) => updateComment(option.id, e.target.value)}
                      placeholder="z.B. Kontaktinfos, besondere Hinweise..."
                      className="mt-1 text-sm"
                      rows={2}
                      disabled={disabled}
                      data-testid={`input-comment-${option.id}`}
                    />
                  </div>
                )}
              </div>
              
              {!adminPreview && (
                <div className="flex-shrink-0">
                  <Button
                    type="button"
                    variant={isBooked ? 'default' : 'outline'}
                    className={`w-full md:w-auto ${
                      isBooked 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : isFull
                          ? 'opacity-50 cursor-not-allowed'
                          : 'border-green-600 text-green-600 hover:bg-green-50'
                    }`}
                    onClick={() => toggleSlot(option.id)}
                    disabled={disabled || (isFull && !isBooked)}
                    data-testid={`button-book-slot-${option.id}`}
                  >
                    {isBooked ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Eingetragen
                      </>
                    ) : isFull ? (
                      'Ausgebucht'
                    ) : (
                      'Eintragen'
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      {bookings.length > 0 && !adminPreview && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300">
            <strong>Ihre Auswahl:</strong> Sie haben sich für {bookings.length} {bookings.length === 1 ? 'Slot' : 'Slots'} eingetragen.
          </p>
        </div>
      )}
    </div>
  );
}
