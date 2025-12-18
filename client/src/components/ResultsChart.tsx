import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Check, 
  X, 
  HelpCircle, 
  Calendar, 
  Clock, 
  Users, 
  Crown,
  Download,
  FileText,
  Mail,
  Pencil,
  Save
} from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useState, useEffect } from "react";
import { Table } from "lucide-react";
import type { PollResults } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { formatScheduleOptionText } from "@/lib/utils";

function FormattedOptionText({ text }: { text: string }) {
  const parsed = formatScheduleOptionText(text);
  if (parsed) {
    return <><span className="font-bold">{parsed.date}</span> {parsed.time}</>;
  }
  return <>{text}</>;
}

interface ResultsChartProps {
  results: PollResults;
  publicToken?: string;
  isAdminAccess?: boolean;
  onCapacityUpdate?: (optionId: number, newCapacity: number | null) => Promise<void>;
}

export function ResultsChart({ results, publicToken, isAdminAccess = false, onCapacityUpdate }: ResultsChartProps) {
  const { poll, options, stats, participantCount } = results;
  const { toast } = useToast();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editingCapacity, setEditingCapacity] = useState<number | null>(null);
  const [capacityValue, setCapacityValue] = useState<string>("");
  const [isSavingCapacity, setIsSavingCapacity] = useState(false);
  const [capacityError, setCapacityError] = useState<string>("");

  const isOrganization = poll.type === 'organization';

  const handleEditCapacity = (optionId: number, currentCapacity: number | null | undefined) => {
    setEditingCapacity(optionId);
    setCapacityValue(currentCapacity ? currentCapacity.toString() : "");
    setCapacityError("");
  };

  const handleSaveCapacity = async (optionId: number) => {
    if (!onCapacityUpdate) return;
    const trimmedValue = capacityValue.trim();
    setCapacityError("");
    
    // Empty value means unlimited (null)
    if (!trimmedValue) {
      setIsSavingCapacity(true);
      try {
        await onCapacityUpdate(optionId, null);
        setEditingCapacity(null);
        setCapacityValue("");
        toast({ title: "Gespeichert", description: "Kapazität auf unbegrenzt gesetzt." });
      } catch (error) {
        toast({ title: "Fehler", description: "Kapazität konnte nicht gespeichert werden.", variant: "destructive" });
      } finally {
        setIsSavingCapacity(false);
      }
      return;
    }
    
    // Strict validation: must be a positive integer only (no decimals, no text)
    if (!/^\d+$/.test(trimmedValue)) {
      setCapacityError("Bitte nur ganze Zahlen eingeben");
      return;
    }
    const newCapacity = parseInt(trimmedValue, 10);
    if (isNaN(newCapacity) || newCapacity < 1) {
      setCapacityError("Bitte eine Zahl >= 1 eingeben");
      return;
    }
    if (newCapacity > 9999) {
      setCapacityError("Maximale Kapazität: 9999");
      return;
    }
    
    setIsSavingCapacity(true);
    try {
      await onCapacityUpdate(optionId, newCapacity);
      setEditingCapacity(null);
      setCapacityValue("");
      toast({ title: "Gespeichert", description: `Kapazität auf ${newCapacity} gesetzt.` });
    } catch (error) {
      toast({ title: "Fehler", description: "Kapazität konnte nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setIsSavingCapacity(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCapacity(null);
    setCapacityValue("");
    setCapacityError("");
  };

  // Reset edit state when results change (e.g., after mutation)
  useEffect(() => {
    setEditingCapacity(null);
    setCapacityValue("");
    setCapacityError("");
  }, [options]);

  // Create slides for images with lightbox
  const imageOptions = options.filter(option => option.imageUrl);
  const slides = imageOptions.map(option => ({
    src: option.imageUrl!,
    title: option.text,
    option: option
  }));

  // Find the best option (highest score) - only for non-organization polls
  const bestOption = stats.reduce((best, current) => 
    current.score > best.score ? current : best
  );
  const bestOptionData = !isOrganization ? options.find(opt => opt.id === bestOption.optionId) : null;

  // Group participants by their voting patterns
  const participantMap = new Map();
  results.votes.forEach(vote => {
    const key = vote.userId ? `user_${vote.userId}` : `anon_${vote.voterName}`;
    if (!participantMap.has(key)) {
      participantMap.set(key, {
        name: vote.voterName,
        votedAt: vote.createdAt,
        votes: []
      });
    }
    participantMap.get(key).votes.push(vote);
  });

  const participants = Array.from(participantMap.values());

  const handleExportCSV = () => {
    if (publicToken) {
      window.open(`/api/v1/polls/${publicToken}/export/csv`, '_blank');
    }
  };

  const handleExportPDF = () => {
    if (publicToken) {
      window.open(`/api/v1/polls/${publicToken}/export/pdf`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Export Options */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {isOrganization ? 'Eintragungen' : 'Ergebnisse'}
          </h2>
          <p className="text-muted-foreground">
            {isOrganization 
              ? `${participantCount} ${participantCount === 1 ? 'Person hat' : 'Personen haben'} sich eingetragen`
              : `${participantCount} ${participantCount === 1 ? 'Person hat' : 'Personen haben'} abgestimmt`
            }
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleExportCSV}>
            <FileText className="w-4 h-4 mr-2" />
            CSV Export
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            PDF Export
          </Button>
        </div>
      </div>

      {/* Total Votes Summary */}
      <Card className="kita-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {isOrganization ? 'Gesamte Eintragungen' : 'Gesamte Abstimmungen'}
            </span>
            <span className="text-sm font-medium text-foreground">
              {isOrganization 
                ? `${results.votes.length} ${results.votes.length === 1 ? 'Eintragung' : 'Eintragungen'}`
                : `${participantCount} ${participantCount === 1 ? 'Stimme' : 'Stimmen'}`
              }
            </span>
          </div>
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-kita-blue" />
              <span className="text-sm text-muted-foreground">Teilnehmer: {participantCount}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm text-muted-foreground">
                {isOrganization 
                  ? `Gesamte Eintragungen: ${results.votes.length}`
                  : `Gesamte Stimmen: ${results.votes.length}`
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Option Highlight */}
      {bestOptionData && (
        <Card className={`${
          poll.type === 'schedule' 
            ? 'border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-600' 
            : 'border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-600'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-2">
              <Crown className={poll.type === 'schedule' ? 'w-5 h-5 text-orange-600 dark:text-orange-400' : 'w-5 h-5 text-teal-600 dark:text-teal-400'} />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Beliebteste Option</h3>
              <Badge className={poll.type === 'schedule' ? 'kita-badge-schedule' : 'kita-badge-survey'}>
                {bestOption.score} Punkte
              </Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Bewertung: Ja = 2 Punkte, Vielleicht = 1 Punkt, Nein = 0 Punkte
            </p>
            <div className="flex items-center space-x-3 mb-2">
              {bestOptionData.imageUrl && (
                <img
                  src={bestOptionData.imageUrl}
                  alt={bestOptionData.altText || bestOptionData.text}
                  className="w-12 h-12 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    const imageIndex = imageOptions.findIndex(opt => opt.id === bestOptionData.id);
                    if (imageIndex >= 0) {
                      setLightboxIndex(imageIndex);
                      setLightboxOpen(true);
                    }
                  }}
                />
              )}
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {bestOptionData.text}
              </h4>
            </div>
            {bestOptionData.startTime && bestOptionData.endTime && (
              <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(bestOptionData.startTime).toLocaleDateString('de-DE')}
                <Clock className="w-4 h-4 ml-3 mr-1" />
                {new Date(bestOptionData.startTime).toLocaleTimeString('de-DE', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })} - {new Date(bestOptionData.endTime).toLocaleTimeString('de-DE', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Matrix View - Participants as rows, Options as columns */}
      {!isOrganization && participants.length > 0 && (
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Table className="w-5 h-5 mr-2" />
              Stimmabgaben zur Umfrage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="matrix-view-table">
                <thead>
                  <tr>
                    <th className="text-right py-2 px-3 font-medium text-foreground border-b border-border min-w-[150px]">
                      Teilnehmer
                    </th>
                    {options.map((option) => {
                      const isSchedule = poll.type === 'schedule' && option.startTime && option.endTime;
                      return (
                        <th 
                          key={option.id} 
                          className="text-center py-2 px-2 font-medium text-foreground border-b border-border min-w-[100px]"
                        >
                          {isSchedule ? (
                            <div className="flex flex-col items-center text-xs">
                              <span className="font-semibold">
                                {new Date(option.startTime!).toLocaleDateString('de-DE', { 
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: '2-digit'
                                })}
                              </span>
                              <span className="text-muted-foreground">
                                {new Date(option.startTime!).toLocaleTimeString('de-DE', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })} - {new Date(option.endTime!).toLocaleTimeString('de-DE', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs"><FormattedOptionText text={option.text} /></span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {participants.map((participant, pIndex) => (
                    <tr 
                      key={pIndex} 
                      className={pIndex % 2 === 0 ? 'bg-muted/30' : 'bg-background'}
                      data-testid={`matrix-row-${pIndex}`}
                    >
                      <td className="text-right py-2 px-3 font-medium text-foreground border-r border-border">
                        {participant.name}
                      </td>
                      {options.map((option) => {
                        const vote = participant.votes.find((v: any) => v.optionId === option.id);
                        const response = vote?.response;
                        
                        let cellBg = '';
                        let cellContent = null;
                        
                        if (response === 'yes') {
                          cellBg = 'bg-green-100 dark:bg-green-900/30';
                          cellContent = <Check className="w-4 h-4 text-green-600 dark:text-green-400" />;
                        } else if (response === 'maybe') {
                          cellBg = 'bg-yellow-100 dark:bg-yellow-900/30';
                          cellContent = <HelpCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
                        } else if (response === 'no') {
                          cellBg = 'bg-red-100 dark:bg-red-900/30';
                          cellContent = <X className="w-4 h-4 text-red-600 dark:text-red-400" />;
                        }
                        
                        return (
                          <td 
                            key={option.id} 
                            className={`text-center py-2 px-2 ${cellBg}`}
                          >
                            <div className="flex items-center justify-center">
                              {cellContent}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-medium">
                    <td className="text-right py-2 px-3 text-sm text-muted-foreground">
                      Gesamt
                    </td>
                    {options.map((option) => {
                      const stat = stats.find(s => s.optionId === option.id);
                      const yesCount = stat?.yesCount || 0;
                      return (
                        <td key={option.id} className="text-center py-2 px-2">
                          <div className="flex items-center justify-center space-x-1">
                            <Check className="w-3 h-3 text-green-600" />
                            <span className="text-sm font-semibold">{yesCount}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matrix View for Organization Polls - Participants as rows, Slots as columns */}
      {isOrganization && options.length > 0 && (
        <Card className="kita-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Table className="w-5 h-5 mr-2" />
              Übersicht Eintragungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="orga-matrix-view-table">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-foreground border-b border-border min-w-[150px]">
                      Teilnehmer
                    </th>
                    {options.map((option) => {
                      const slotVotes = results.votes.filter(v => v.optionId === option.id && v.response === 'yes');
                      const capacity = option.maxCapacity || 0;
                      const signupCount = slotVotes.length;
                      const isFull = capacity > 0 && signupCount >= capacity;
                      
                      return (
                        <th 
                          key={option.id} 
                          className="text-center py-2 px-2 font-medium text-foreground border-b border-border min-w-[120px]"
                        >
                          <div className="flex flex-col items-center text-xs">
                            <span className="font-semibold"><FormattedOptionText text={option.text} /></span>
                            {option.startTime && option.endTime && (
                              <span className="text-muted-foreground">
                                {new Date(option.startTime).toLocaleDateString('de-DE', { 
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: '2-digit'
                                })}
                                <br />
                                {new Date(option.startTime).toLocaleTimeString('de-DE', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })} - {new Date(option.endTime).toLocaleTimeString('de-DE', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            )}
                            <Badge 
                              className={`mt-1 text-xs ${isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                            >
                              {signupCount}/{capacity || '∞'}
                            </Badge>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {participants.length > 0 ? (
                    participants.map((participant, idx) => (
                      <tr 
                        key={idx} 
                        className={idx % 2 === 0 ? 'bg-muted/30' : ''}
                      >
                        <td className="py-2 px-3 text-sm font-medium text-foreground border-b border-border">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-primary text-xs font-semibold">
                              {participant.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                            </div>
                            <span>{participant.name}</span>
                          </div>
                        </td>
                        {options.map((option) => {
                          const vote = participant.votes.find((v: any) => v.optionId === option.id && v.response === 'yes');
                          return (
                            <td key={option.id} className="text-center py-2 px-2 border-b border-border">
                              {vote ? (
                                <div className="flex flex-col items-center">
                                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  </div>
                                  {vote.comment && (
                                    <span className="text-xs text-muted-foreground mt-1 max-w-[100px] truncate" title={vote.comment}>
                                      {vote.comment}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                                  <X className="w-3 h-3 text-gray-400" />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={options.length + 1} className="py-4 text-center text-muted-foreground text-sm italic">
                        Noch keine Eintragungen vorhanden
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-medium">
                    <td className="text-left py-2 px-3 text-sm text-muted-foreground">
                      Gesamt
                    </td>
                    {options.map((option) => {
                      const slotVotes = results.votes.filter(v => v.optionId === option.id && v.response === 'yes');
                      return (
                        <td key={option.id} className="text-center py-2 px-2">
                          <div className="flex items-center justify-center space-x-1">
                            <Users className="w-3 h-3 text-green-600" />
                            <span className="text-sm font-semibold">{slotVotes.length}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Results - Different view for organization polls */}
      {isOrganization ? (
        <Card className="kita-card">
          <CardHeader>
            <CardTitle>Slots und Eintragungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {options.map((option) => {
                const slotVotes = results.votes.filter(v => v.optionId === option.id && v.response === 'yes');
                const capacity = option.maxCapacity || 0;
                const signupCount = slotVotes.length;
                const fillPercent = capacity > 0 ? Math.min((signupCount / capacity) * 100, 100) : 0;
                const isFull = capacity > 0 && signupCount >= capacity;
                
                return (
                  <div key={option.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-medium text-foreground"><FormattedOptionText text={option.text} /></div>
                        {option.startTime && option.endTime && (
                          <div className="text-sm text-muted-foreground mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {new Date(option.startTime).toLocaleDateString('de-DE')}
                            <Clock className="w-3 h-3 inline ml-2 mr-1" />
                            {new Date(option.startTime).toLocaleTimeString('de-DE', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })} - {new Date(option.endTime).toLocaleTimeString('de-DE', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {editingCapacity === option.id ? (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center space-x-1">
                              <span className="text-sm">{signupCount} /</span>
                              <Input
                                type="number"
                                min={1}
                                max={9999}
                                step={1}
                                value={capacityValue}
                                onChange={(e) => {
                                  setCapacityValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                                  setCapacityError("");
                                }}
                                className={`w-16 h-7 text-sm ${capacityError ? 'border-destructive' : ''}`}
                                data-testid={`input-capacity-${option.id}`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCapacity(option.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                placeholder="∞"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleSaveCapacity(option.id)}
                                disabled={isSavingCapacity}
                                data-testid={`button-save-capacity-${option.id}`}
                              >
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={handleCancelEdit}
                                data-testid={`button-cancel-capacity-${option.id}`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            {capacityError && (
                              <span className="text-xs text-destructive mt-1">{capacityError}</span>
                            )}
                          </div>
                        ) : (
                          <>
                            <Badge className={isFull ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                              {signupCount} / {capacity || '∞'}
                              {isFull && <span className="ml-1">voll</span>}
                            </Badge>
                            {isAdminAccess && onCapacityUpdate && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleEditCapacity(option.id, option.maxCapacity)}
                                data-testid={`button-edit-capacity-${option.id}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    {capacity > 0 && (
                      <Progress value={fillPercent} className="h-2 mb-3" />
                    )}
                    
                    {slotVotes.length > 0 ? (
                      <div className="space-y-2">
                        {slotVotes.map((vote, idx) => (
                          <div key={idx} className="flex items-center space-x-3 p-2 bg-muted rounded-lg">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                              {vote.voterName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-foreground">{vote.voterName}</span>
                              {vote.comment && (
                                <span className="text-sm text-muted-foreground ml-2">- {vote.comment}</span>
                              )}
                            </div>
                            {vote.voterEmail && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Mail className="w-3 h-3 mr-1" />
                                {vote.voterEmail}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Noch keine Eintragungen</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="kita-card">
          <CardHeader>
            <CardTitle>Detaillierte Ergebnisse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-foreground">
                      Option
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-foreground w-24">
                      <div className="flex items-center justify-center space-x-1">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Ja</span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-foreground w-24">
                      <div className="flex items-center justify-center space-x-1">
                        <HelpCircle className="w-4 h-4 text-yellow-600" />
                        <span>Vielleicht</span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-foreground w-24">
                      <div className="flex items-center justify-center space-x-1">
                        <X className="w-4 h-4 text-red-600" />
                        <span>Nein</span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-foreground w-32">
                      <div className="flex flex-col items-center">
                        <span>Punkte</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          (Ja=2, Vielleicht=1, Nein=0)
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.map((stat) => {
                    const option = options.find(opt => opt.id === stat.optionId);
                    if (!option) return null;

                    const total = stat.yesCount + stat.maybeCount + stat.noCount;
                    const yesPercent = total > 0 ? (stat.yesCount / total) * 100 : 0;
                    const maybePercent = total > 0 ? (stat.maybeCount / total) * 100 : 0;
                    const noPercent = total > 0 ? (stat.noCount / total) * 100 : 0;

                    return (
                      <tr key={stat.optionId} className="hover:bg-muted/50">
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            {/* Show image if available */}
                            {option.imageUrl && (
                              <img
                                src={option.imageUrl}
                                alt={option.altText || option.text}
                                className="w-16 h-16 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  const imageIndex = imageOptions.findIndex(opt => opt.id === option.id);
                                  if (imageIndex >= 0) {
                                    setLightboxIndex(imageIndex);
                                    setLightboxOpen(true);
                                  }
                                }}
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-foreground">
                                <FormattedOptionText text={option.text} />
                              </div>
                              {option.startTime && option.endTime && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {new Date(option.startTime).toLocaleDateString('de-DE')} • {' '}
                                  {new Date(option.startTime).toLocaleTimeString('de-DE', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })} - {new Date(option.endTime).toLocaleTimeString('de-DE', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-semibold text-green-600">
                              {stat.yesCount}
                            </span>
                            <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                              <div 
                                className="bg-green-600 h-1 rounded-full"
                                style={{ width: `${yesPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-semibold text-yellow-600">
                              {stat.maybeCount}
                            </span>
                            <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                              <div 
                                className="bg-yellow-600 h-1 rounded-full"
                                style={{ width: `${maybePercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-semibold text-red-600">
                              {stat.noCount}
                            </span>
                            <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                              <div 
                                className="bg-red-600 h-1 rounded-full"
                                style={{ width: `${noPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <Badge 
                              variant={stat.optionId === bestOption.optionId ? "default" : "secondary"}
                              className={stat.optionId === bestOption.optionId ? "bg-green-100 text-green-800" : ""}
                            >
                              {stat.score}
                              {stat.optionId === bestOption.optionId && (
                                <Crown className="w-3 h-3 ml-1" />
                              )}
                            </Badge>
                            {stat.optionId === bestOption.optionId && (
                              <span className="text-xs text-green-600 font-medium mt-1">Sieger</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Participants List */}
      <Card className="kita-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Teilnehmer-Übersicht ({participantCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participants.map((participant, index) => (
              <div 
                key={index}
                className="flex items-center space-x-3 p-3 bg-muted rounded-lg"
              >
                <div className="w-8 h-8 bg-kita-orange rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {participant.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {participant.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Abgestimmt: {new Date(participant.votedAt).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox for Results Images */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, .9)" },
        }}
        render={{
          buttonPrev: slides.length <= 1 ? () => null : undefined,
          buttonNext: slides.length <= 1 ? () => null : undefined,
          slide: ({ slide, offset, rect }) => {
            const currentSlideIndex = slides.findIndex(s => s.src === slide.src);
            const currentOption = slides[currentSlideIndex >= 0 ? currentSlideIndex : lightboxIndex]?.option;
            const currentStat = stats.find(stat => stat.optionId === currentOption?.id);
            
            if (!currentOption || !currentStat) return null;

            return (
              <div style={{
                position: 'relative',
                width: rect.width,
                height: rect.height,
              }}>
                <img
                  src={slide.src}
                  alt={currentOption.altText || currentOption.text}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
                
                {/* Title overlay */}
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: '600',
                  textAlign: 'center',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {currentOption.text}
                </div>

                {/* Voting stats overlay - matching voting interface style */}
                <div style={{
                  position: 'absolute',
                  bottom: '30px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0, 0, 0, 0.9)',
                  borderRadius: '16px',
                  padding: '20px',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {/* Ja Button Style */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '16px 20px',
                      border: '2px solid #10b981',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      minWidth: '80px'
                    }}>
                      <span style={{ fontSize: '24px', color: '#10b981' }}>✓</span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{currentStat.yesCount}</span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#10b981' }}>Ja</span>
                    </div>
                    
                    {/* Vielleicht Button Style */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '16px 20px',
                      border: '2px solid #f59e0b',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      minWidth: '80px'
                    }}>
                      <span style={{ fontSize: '24px', color: '#f59e0b' }}>~</span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{currentStat.maybeCount}</span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#f59e0b' }}>Vielleicht</span>
                    </div>
                    
                    {/* Nein Button Style */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '16px 20px',
                      border: '2px solid #ef4444',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      minWidth: '80px'
                    }}>
                      <span style={{ fontSize: '24px', color: '#ef4444' }}>✗</span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{currentStat.noCount}</span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#ef4444' }}>Nein</span>
                    </div>
                  </div>
                  
                  {/* Score display */}
                  <div style={{
                    marginTop: '16px',
                    textAlign: 'center',
                    padding: '8px 16px',
                    background: 'rgba(251, 191, 36, 0.2)',
                    border: '1px solid #fbbf24',
                    borderRadius: '8px'
                  }}>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: '#fbbf24' }}>
                      Punkte: {currentStat.score}
                    </span>
                  </div>
                </div>
              </div>
            );
          }
        }}
        on={{
          view: ({ index }) => {
            setLightboxIndex(index);
          },
        }}
      />
    </div>
  );
}
