import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarPicker } from "@/components/CalendarPicker";
import { Calendar, Clock, Mail, Save } from "lucide-react";

interface PollOption {
  text: string;
  startTime?: string;
  endTime?: string;
  order: number;
}

interface PollFormProps {
  initialData?: {
    title: string;
    description: string;
    options: PollOption[];
  };
  onSubmit: (data: {
    title: string;
    description: string;
    creatorEmail?: string;
    userId?: number;
    options: PollOption[];
  }) => void;
  isLoading?: boolean;
  isAnonymous?: boolean;
}

export function PollForm({ 
  initialData, 
  onSubmit, 
  isLoading = false,
  isAnonymous = true 
}: PollFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [anonymousCreation, setAnonymousCreation] = useState(isAnonymous);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [options, setOptions] = useState<PollOption[]>(initialData?.options || []);

  const addTimeSlot = (date: Date, startTime: string, endTime: string) => {
    const option: PollOption = {
      text: `${date.toLocaleDateString('de-DE')} ${startTime} - ${endTime}`,
      startTime: new Date(date.toDateString() + ' ' + startTime).toISOString(),
      endTime: new Date(date.toDateString() + ' ' + endTime).toISOString(),
      order: options.length,
    };
    setOptions([...options, option]);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = {
      title: title.trim(),
      description: description.trim(),
      creatorEmail: anonymousCreation ? creatorEmail.trim() : undefined,
      userId: anonymousCreation ? undefined : 1, // TODO: Get from auth context
      options,
    };

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-polly-orange" />
            Grundinformationen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="title">Titel der Terminumfrage *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Team-Meeting März 2025"
              className="mt-1"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Beschreibung (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Weitere Details zur Terminabstimmung..."
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Date and Time Selection */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2 text-polly-blue" />
            Termine auswählen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarPicker
            selectedDates={selectedDates}
            onDatesChange={setSelectedDates}
            onAddTimeSlot={addTimeSlot}
          />
          
          {/* Selected Options */}
          {options.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-foreground mb-4">
                Terminoptionen ({options.length})
              </h4>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between bg-muted p-4 rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{option.text}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      Entfernen
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Creation Options */}
      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2 text-green-600" />
            Erstellungsoptionen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="anonymous"
                checked={anonymousCreation}
                onCheckedChange={(checked) => setAnonymousCreation(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="anonymous" className="font-medium">
                  Anonym erstellen
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Sie erhalten per E-Mail einen öffentlichen Link zum Teilen und einen 
                  privaten Administratorlink zur Verwaltung.
                </p>
                {anonymousCreation && (
                  <Input
                    type="email"
                    value={creatorEmail}
                    onChange={(e) => setCreatorEmail(e.target.value)}
                    placeholder="ihre.email@polly-bayern.de"
                    className="mt-3"
                    required
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          className="polly-button-primary"
          disabled={isLoading || !title.trim() || options.length < 2}
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Erstelle..." : "Terminumfrage erstellen"}
        </Button>
      </div>
    </form>
  );
}
