import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PollTypeBadge } from "@/components/ui/PollTypeBadge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Check, 
  X, 
  HelpCircle, 
  ChevronDown,
  ChevronRight,
  Calendar, 
  CalendarDays,
  Clock, 
  Users, 
  Crown,
  Download,
  FileText,
  Mail,
  Pencil,
  Save,
  ClipboardList,
  Lock,
  Unlock,
  CalendarCheck,
  Loader2,
  Video,
  ExternalLink
} from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { Table } from "lucide-react";
import type { PollResults } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatScheduleOptionWithWeekday } from "@/lib/utils";

function FormattedOptionText({ text, startTime, locale = 'en' }: { text: string; startTime?: Date | string | null; locale?: string }) {
  const startTimeStr = startTime instanceof Date ? startTime.toISOString() : startTime;
  const formatted = formatScheduleOptionWithWeekday(text, startTimeStr, locale);
  if (formatted.isSchedule) {
    return <><span className="font-bold">{formatted.dateWithWeekday}</span> {formatted.time}</>;
  }
  return <>{text}</>;
}

interface ResultsChartProps {
  results: PollResults;
  publicToken?: string;
  adminToken?: string;
  isAdminAccess?: boolean;
  isOwner?: boolean;
  onCapacityUpdate?: (optionId: number, newCapacity: number | null) => Promise<void>;
  onFinalize?: () => void;
}

export function ResultsChart({ results, publicToken, adminToken, isAdminAccess = false, isOwner = false, onCapacityUpdate, onFinalize }: ResultsChartProps) {
  const { poll, options, stats, participantCount } = results;
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editingCapacity, setEditingCapacity] = useState<number | null>(null);
  const [capacityValue, setCapacityValue] = useState<string>("");
  const [isSavingCapacity, setIsSavingCapacity] = useState(false);
  const [capacityError, setCapacityError] = useState<string>("");

  const isOrganization = poll.type === 'organization';
  const isSchedule = poll.type === 'schedule';
  const isFinalized = poll.finalOptionId != null && poll.finalOptionId > 0;
  const isOrgFinalized = isOrganization && poll.finalOptionId === -1;
  const [isFinalizingOption, setIsFinalizingOption] = useState<number | null>(null);
  const [confirmDialogOptionId, setConfirmDialogOptionId] = useState<number | null>(null);
  const [finalizeClosePoll, setFinalizeClosePoll] = useState(true);
  const [finalizeNotify, setFinalizeNotify] = useState(true);
  const [orgConfirmDialogOpen, setOrgConfirmDialogOpen] = useState(false);
  const [orgFinalizeClosePoll, setOrgFinalizeClosePoll] = useState(true);
  const [orgFinalizeNotify, setOrgFinalizeNotify] = useState(true);
  const [isDetailedResultsOpen, setIsDetailedResultsOpen] = useState(false);
  const detailedResultsRef = useRef<HTMLDivElement>(null);
  const localeCode = i18n.language === 'de' ? 'de-DE' : 'en-US';

  const openAndScrollToDetailedResults = () => {
    setIsDetailedResultsOpen(true);
    window.setTimeout(() => {
      detailedResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleFinalize = async (optionId: number) => {
    if (!adminToken) return;
    setIsFinalizingOption(optionId);
    try {
      await apiRequest('POST', `/api/v1/polls/admin/${adminToken}/finalize`, {
        optionId,
        closePoll: finalizeClosePoll,
        notifyParticipants: finalizeNotify,
      });
      const parts: string[] = [isSchedule ? t('resultsChart.dateConfirmed') : t('resultsChart.resultConfirmed')];
      if (finalizeClosePoll) parts.push(t('resultsChart.pollClosed'));
      if (finalizeNotify) parts.push(t('resultsChart.participantsNotified'));
      toast({ title: t('common.success'), description: parts.join(' ') });
      onFinalize?.();
    } catch (error) {
      toast({ title: t('common.error'), description: t('resultsChart.finalizeFailed'), variant: "destructive" });
    } finally {
      setIsFinalizingOption(null);
      setConfirmDialogOptionId(null);
    }
  };

  const handleUnfinalize = async () => {
    if (!adminToken) return;
    setIsFinalizingOption(0);
    try {
      await apiRequest('POST', `/api/v1/polls/admin/${adminToken}/finalize`, { optionId: 0 });
      toast({ title: t('common.success'), description: isOrgFinalized ? t('resultsChart.signupsUnconfirmed') : (isSchedule ? t('resultsChart.dateUnconfirmed') : t('resultsChart.resultUnconfirmed')) });
      onFinalize?.();
    } catch (error) {
      toast({ title: t('common.error'), description: t('resultsChart.finalizeFailed'), variant: "destructive" });
    } finally {
      setIsFinalizingOption(null);
    }
  };

  const handleOrgFinalize = async () => {
    if (!adminToken) return;
    setIsFinalizingOption(-1);
    try {
      await apiRequest('POST', `/api/v1/polls/admin/${adminToken}/finalize`, {
        optionId: 0,
        orgFinalize: true,
        closePoll: orgFinalizeClosePoll,
        notifyParticipants: orgFinalizeNotify,
      });
      const parts: string[] = [t('resultsChart.signupsConfirmed')];
      if (orgFinalizeClosePoll) parts.push(t('resultsChart.pollClosed'));
      if (orgFinalizeNotify) parts.push(t('resultsChart.participantsNotified'));
      toast({ title: t('common.success'), description: parts.join(' ') });
      onFinalize?.();
    } catch (error) {
      toast({ title: t('common.error'), description: t('resultsChart.finalizeFailed'), variant: "destructive" });
    } finally {
      setIsFinalizingOption(null);
      setOrgConfirmDialogOpen(false);
    }
  };

  const handleExportICS = async () => {
    if (!publicToken) return;
    try {
      const response = await fetch(`/api/v1/polls/${publicToken}/export/ics?lang=${i18n.language}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast({
          title: t('common.error'),
          description: data?.error || t('results.icsExportError'),
          variant: "destructive",
        });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      a.download = filenameMatch?.[1] || 'poll.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: t('common.error'),
        description: t('results.icsExportError'),
        variant: "destructive",
      });
    }
  };

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
        toast({ title: t('common.success'), description: t('resultsChart.capacityUnlimited') });
      } catch (error) {
        toast({ title: t('common.error'), description: t('resultsChart.capacitySaveError'), variant: "destructive" });
      } finally {
        setIsSavingCapacity(false);
      }
      return;
    }
    
    // Strict validation: must be a positive integer only (no decimals, no text)
    if (!/^\d+$/.test(trimmedValue)) {
      setCapacityError(t('resultsChart.integerOnly'));
      return;
    }
    const newCapacity = parseInt(trimmedValue, 10);
    if (isNaN(newCapacity) || newCapacity < 1) {
      setCapacityError(t('resultsChart.minCapacity'));
      return;
    }
    if (newCapacity > 9999) {
      setCapacityError(t('resultsChart.maxCapacity'));
      return;
    }
    
    setIsSavingCapacity(true);
    try {
      await onCapacityUpdate(optionId, newCapacity);
      setEditingCapacity(null);
      setCapacityValue("");
      toast({ title: t('common.success'), description: t('resultsChart.capacitySet', { count: newCapacity }) });
    } catch (error) {
      toast({ title: t('common.error'), description: t('resultsChart.capacitySaveError'), variant: "destructive" });
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

  // Find the best option(s) (highest score) - only for non-organization polls.
  // A "best option" only exists when at least one option has a positive score.
  const bestOption = stats.length > 0
    ? stats.reduce((best, current) => (current.score > best.score ? current : best))
    : null;
  const hasBestOption = !!bestOption && bestOption.score > 0;
  // Check if there are multiple options with the same highest score (tie)
  const tiedOptions = hasBestOption && bestOption
    ? stats.filter(stat => stat.score === bestOption.score)
    : [];
  const isTie = tiedOptions.length > 1;
  const bestOptionData = !isOrganization && hasBestOption && bestOption
    ? options.find(opt => opt.id === bestOption.optionId)
    : null;
  const tiedOptionData = !isOrganization && hasBestOption
    ? tiedOptions
        .map(stat => options.find(opt => opt.id === stat.optionId))
        .filter((opt): opt is NonNullable<typeof opt> => Boolean(opt))
    : [];
  const rankedStats = useMemo(
    () =>
      [...stats].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.yesCount !== a.yesCount) return b.yesCount - a.yesCount;
        return a.optionId - b.optionId;
      }),
    [stats]
  );
  const voteSummaryTotals = useMemo(() => {
    return stats.reduce(
      (acc, stat) => {
        acc.yes += stat.yesCount;
        acc.maybe += stat.maybeCount;
        acc.no += stat.noCount;
        return acc;
      },
      { yes: 0, maybe: 0, no: 0 }
    );
  }, [stats]);
  const statsByOptionId = useMemo(() => {
    const map = new Map<number, (typeof stats)[number]>();
    stats.forEach((s) => map.set(s.optionId, s));
    return map;
  }, [stats]);

  const getMatrixHeatmapStyle = (optionId: number, response?: 'yes' | 'maybe' | 'no') => {
    if (!response || participantCount <= 0) return undefined;
    const stat = statsByOptionId.get(optionId);
    if (!stat) return undefined;

    const rawCount =
      response === 'yes' ? stat.yesCount :
      response === 'maybe' ? stat.maybeCount :
      stat.noCount;

    const ratio = Math.max(0, Math.min(1, rawCount / participantCount));
    const alpha = 0.12 + (ratio * 0.33);

    if (response === 'yes') return { backgroundColor: `rgba(34, 197, 94, ${alpha})` };
    if (response === 'maybe') return { backgroundColor: `rgba(234, 179, 8, ${alpha})` };
    return { backgroundColor: `rgba(239, 68, 68, ${alpha})` };
  };

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
  const adminComments = isAdminAccess
    ? Array.from(
        new Map(
          results.votes
            .filter((v) => v.comment && v.comment.trim())
            .map((v) => [
              v.userId ? `user_${v.userId}` : `anon_${v.voterEmail || v.voterName}`,
              {
                voterName: v.voterName,
                voterEmail: v.voterEmail,
                comment: v.comment!.trim(),
                createdAt: v.createdAt,
              },
            ])
        ).values()
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const handleExportCSV = () => {
    if (publicToken) {
      window.open(`/api/v1/polls/${publicToken}/export/csv?lang=${i18n.language}`, '_blank');
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
            {isOrganization ? t('results.entries') : t('results.resultsTitle')}
          </h2>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleExportCSV}>
            <FileText className="w-4 h-4 mr-2" />
            {t('results.csvExport')}
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            {t('results.pdfExport')}
          </Button>
          {isSchedule && isFinalized && (
            <Button variant="outline" onClick={handleExportICS}>
              <CalendarCheck className="w-4 h-4 mr-2" />
              {t('results.icsExport')}
            </Button>
          )}
        </div>
      </div>

      {/* Total summary card hidden for now by request */}

      {/* Finalized Option Banner */}
      {isFinalized && (() => {
        const finalOption = options.find(opt => opt.id === poll.finalOptionId);
        if (!finalOption) return null;
        return (
          <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                      {isSchedule ? t('resultsChart.confirmedDate') : t('resultsChart.confirmedResult')}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      <FormattedOptionText text={finalOption.text} startTime={finalOption.startTime} locale={i18n.language} />
                    </p>
                    {poll.videoConferenceUrl && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        <Video className="w-3 h-3 inline mr-1" />
                        <a href={poll.videoConferenceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800 dark:hover:text-green-200">
                          {t('resultsChart.videoConferenceLink')}
                          <ExternalLink className="w-3 h-3 inline ml-1" />
                        </a>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isSchedule && (
                    <Button variant="outline" size="sm" onClick={handleExportICS} className="border-green-500 text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900">
                      <CalendarCheck className="w-4 h-4 mr-1" />
                      {t('results.icsExport')}
                    </Button>
                  )}
                  {(isAdminAccess || isOwner) && adminToken && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleUnfinalize}
                      disabled={isFinalizingOption !== null}
                      className="border-orange-400 text-orange-700 hover:bg-orange-50 dark:text-orange-300 dark:hover:bg-orange-900"
                    >
                      {isFinalizingOption === 0 ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Unlock className="w-4 h-4 mr-1" />}
                      {t('resultsChart.undoConfirmation')}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Org: Registration Confirmed / Closed banner */}
      {isOrgFinalized && (
        <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    {poll.isActive === false
                      ? t('resultsChart.registrationClosed')
                      : t('resultsChart.registrationConfirmed')}
                  </h3>
                </div>
              </div>
              {(isAdminAccess || isOwner) && adminToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnfinalize}
                  disabled={isFinalizingOption !== null}
                  className="border-orange-400 text-orange-700 hover:bg-orange-50 dark:text-orange-300 dark:hover:bg-orange-900"
                >
                  {isFinalizingOption === 0 ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Unlock className="w-4 h-4 mr-1" />}
                  {t('resultsChart.undoConfirmation')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Org: Confirm Sign-ups button (shown when not yet confirmed) */}
      {isOrganization && !isOrgFinalized && (isAdminAccess || isOwner) && adminToken && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrgConfirmDialogOpen(true)}
            disabled={isFinalizingOption !== null}
            className="border-teal-500 text-teal-700 hover:bg-teal-100 dark:border-teal-600 dark:text-teal-400 dark:hover:bg-teal-950"
          >
            {isFinalizingOption === -1 ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-2" />}
            {t('resultsChart.confirmSignups')}
          </Button>
        </div>
      )}

      {/* Best Option Highlight */}
      {(bestOptionData || tiedOptionData.length > 0) && (
        <Card className={`${
          poll.type === 'schedule' 
            ? 'border border-orange-300 bg-orange-50/70 dark:bg-orange-950/20 dark:border-orange-700' 
            : 'border border-teal-300 bg-teal-50/70 dark:bg-teal-950/20 dark:border-teal-700'
        }`}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center space-x-3 mb-2">
                  <Crown className={poll.type === 'schedule' ? 'w-5 h-5 text-orange-600 dark:text-orange-400' : 'w-5 h-5 text-teal-600 dark:text-teal-400'} />
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {isTie ? t('results.bestOptionTie') : t('results.bestOption')}
                  </h3>
                </div>
                {isTie ? (
                  <div className="space-y-3">
                    {tiedOptionData.map((option) => (
                      <div key={option.id} className="min-w-0">
                        {option.startTime && option.endTime ? (
                          <div className="flex items-center text-base text-gray-700 dark:text-gray-300">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(option.startTime).toLocaleDateString(localeCode, {
                              weekday: 'short',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                            <Clock className="w-4 h-4 ml-3 mr-1" />
                            {new Date(option.startTime).toLocaleTimeString(localeCode, {
                              hour: '2-digit',
                              minute: '2-digit'
                            })} - {new Date(option.endTime).toLocaleTimeString(localeCode, {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3">
                            {option.imageUrl && (
                              <img
                                src={option.imageUrl}
                                alt={option.altText || option.text}
                                className="w-12 h-12 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  const imageIndex = imageOptions.findIndex(opt => opt.id === option.id);
                                  if (imageIndex >= 0) {
                                    setLightboxIndex(imageIndex);
                                    setLightboxOpen(true);
                                  }
                                }}
                              />
                            )}
                            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                              {option.text}
                            </h4>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : bestOptionData?.startTime && bestOptionData.endTime && (
                  <div className="flex items-center text-base text-gray-700 dark:text-gray-300">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(bestOptionData.startTime).toLocaleDateString(localeCode, {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                    <Clock className="w-4 h-4 ml-3 mr-1" />
                    {new Date(bestOptionData.startTime).toLocaleTimeString(localeCode, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })} - {new Date(bestOptionData.endTime).toLocaleTimeString(localeCode, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
                {!isTie && bestOptionData && !(bestOptionData.startTime && bestOptionData.endTime) && (
                  <div className="flex items-center space-x-3">
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
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={openAndScrollToDetailedResults}
                className="w-full md:w-auto md:min-w-[220px] h-12 text-base justify-between border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                {t('results.seeDetailedResultsTip')}
                <ChevronRight className="w-5 h-5 ml-3" />
              </Button>
            </div>
            {poll.videoConferenceUrl && (
              <div className="flex items-center text-sm text-gray-700 dark:text-gray-300 mt-1">
                <Video className="w-4 h-4 mr-1" />
                <a href={poll.videoConferenceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900 dark:hover:text-gray-100">
                  {t('resultsChart.videoConferenceLink')}
                  <ExternalLink className="w-3 h-3 inline ml-1" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Matrix View - Participants as rows, Options as columns (only non-freetext options) */}
      {!isOrganization && participants.length > 0 && options.filter((o: any) => !o.isFreeText).length > 0 && (
        <Card className="polly-card">
          <CardHeader className="pb-3 border-b border-orange-300/60">
            <CardTitle className="flex items-center">
              <Table className="w-5 h-5 mr-2" />
              {t('results.votesForPoll')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="matrix-view-table">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground border-b border-border min-w-[170px]">
                      {t('voting.participant')}
                    </th>
                    {options.filter((o: any) => !o.isFreeText).map((option) => {
                      const isSchedule = poll.type === 'schedule' && option.startTime && option.endTime;
                      return (
                        <th 
                          key={option.id} 
                          className="text-center py-3 px-3 font-medium text-foreground border-b border-border min-w-[210px]"
                        >
                          {isSchedule ? (
                            <div className="flex flex-col items-center text-xs">
                              <span className="font-semibold">
                                {new Date(option.startTime!).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US', { 
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: '2-digit'
                                })}
                              </span>
                              <span className="text-muted-foreground">
                                {new Date(option.startTime!).toLocaleTimeString(i18n.language === 'de' ? 'de-DE' : 'en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })} - {new Date(option.endTime!).toLocaleTimeString(i18n.language === 'de' ? 'de-DE' : 'en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs"><FormattedOptionText text={option.text} startTime={option.startTime} locale={i18n.language} /></span>
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
                      className="bg-background border-b border-border/70"
                      data-testid={`matrix-row-${pIndex}`}
                    >
                      <td className="text-left py-3 px-4 font-medium text-foreground border-r border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-polly-orange flex items-center justify-center text-xs font-semibold text-white">
                            {participant.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                          </div>
                          <div className="min-w-0">
                            <div>{participant.name}</div>
                            <div className="text-xs text-muted-foreground font-normal">
                              {t('resultsChart.votedAt')}: {new Date(participant.votedAt).toLocaleDateString(localeCode)}
                            </div>
                          </div>
                        </div>
                      </td>
                      {options.filter((o: any) => !o.isFreeText).map((option) => {
                        const vote = participant.votes.find((v: any) => v.optionId === option.id);
                        const response = vote?.response;
                        
                        let cellContent = null;
                        let cellClass = "bg-muted/20";
                        
                        if (response === 'yes') {
                          cellClass = "bg-green-100/60 dark:bg-green-900/25";
                          cellContent = (
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          );
                        } else if (response === 'maybe') {
                          cellClass = "bg-yellow-100/45 dark:bg-yellow-900/20";
                          cellContent = (
                            <HelpCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          );
                        } else if (response === 'no') {
                          cellClass = "bg-red-100/55 dark:bg-red-900/20";
                          cellContent = (
                            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                          );
                        }
                        
                        return (
                          <td 
                            key={option.id} 
                            className={`text-center py-3 px-3 ${cellClass}`}
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
                  <tr className="border-t-2 border-border font-medium bg-muted/30">
                    <td className="text-left py-3 px-4 text-sm text-muted-foreground border-r border-border">
                      <div className="inline-flex items-center rounded-md border border-border/60 bg-background/60 px-2 py-1">
                        <span className="pr-2 font-medium text-foreground">{t('results.total')}</span>
                        <span className="mx-2 h-4 border-l border-border/80" aria-hidden="true" />
                        <span className="pl-2 text-xs text-muted-foreground font-medium">
                          {participantCount} {participantCount === 1 ? t('results.participantSingular') : t('results.participantsPlural')}
                        </span>
                      </div>
                    </td>
                    {options.filter((o: any) => !o.isFreeText).map((option) => {
                      const stat = stats.find(s => s.optionId === option.id);
                      const yesCount = stat?.yesCount || 0;
                      return (
                        <td key={option.id} className="text-center py-3 px-3">
                          <div className="flex items-center justify-center">
                            <Badge className={yesCount === participantCount ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700"}>
                              {yesCount}/{participantCount} {t('results.votedLabel')}
                            </Badge>
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

      {/* Free-text answers section for survey polls */}
      {poll.type === 'survey' && options.some((o: any) => o.isFreeText) && (
        <div className="space-y-4">
          {options.filter((o: any) => o.isFreeText).map((option: any) => {
            const answers = results.votes
              .filter((v: any) => v.optionId === option.id && v.response === 'freetext' && v.freeTextAnswer)
              .map((v: any) => ({ name: v.voterName, text: v.freeTextAnswer as string }));
            return (
              <Card key={option.id} className="polly-card border-l-4 border-l-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-base">
                    <MessageSquare className="w-4 h-4 mr-2 text-primary/70" />
                    {option.text}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t('results.openAnswers')} · {answers.length} {answers.length === 1 ? t('voting.participant') : t('polls.participants')}</p>
                </CardHeader>
                <CardContent>
                  {answers.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">{t('results.noAnswersYet')}</p>
                  ) : (
                    <ol className="space-y-2">
                      {answers.map((a, i) => (
                        <li key={i} className="text-sm bg-muted/30 rounded-lg px-4 py-2">
                          <span className="font-medium text-foreground/70 text-xs mr-2">{i + 1}.</span>
                          {poll.resultsPublic && (
                            <span className="text-xs text-muted-foreground mr-2">[{a.name}]</span>
                          )}
                          {a.text}
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Matrix View for Organization Polls - Participants as rows, Slots as columns */}
      {isOrganization && options.length > 0 && (
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Table className="w-5 h-5 mr-2" />
              {t('organization.overview')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="orga-matrix-view-table">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-foreground border-b border-border min-w-[150px]">
                      {t('polls.participants')}
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
                            <span className="font-semibold"><FormattedOptionText text={option.text} startTime={option.startTime} locale={i18n.language} /></span>
                            {option.startTime && option.endTime && (
                              <span className="text-muted-foreground">
                                {new Date(option.startTime).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US', { 
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: '2-digit'
                                })}
                                <br />
                                {new Date(option.startTime).toLocaleTimeString(i18n.language === 'de' ? 'de-DE' : 'en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })} - {new Date(option.endTime).toLocaleTimeString(i18n.language === 'de' ? 'de-DE' : 'en-US', { 
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
                        {t('results.noEntriesYet')}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-medium">
                    <td className="text-left py-2 px-3 text-sm text-muted-foreground">
                      {t('results.total')}
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
      {isOrganization && (
        <Card className="polly-card">
          <CardHeader>
            <CardTitle>{t('results.slotsAndEntries')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {options.map((option) => {
                const slotVotes = results.votes.filter(v => v.optionId === option.id && v.response === 'yes');
                const capacity = option.maxCapacity || 0;
                const signupCount = slotVotes.length;
                const fillPercent = capacity > 0 ? Math.min((signupCount / capacity) * 100, 100) : 0;
                const isFull = capacity > 0 && signupCount >= capacity;
                
                const slotTitle = (() => {
                  const sep = option.text.indexOf(' – ');
                  if (sep !== -1) return option.text.slice(sep + 3).trim();
                  const dash = option.text.indexOf(' - ');
                  if (dash !== -1 && dash < option.text.length / 2) return option.text.slice(dash + 3).trim();
                  return option.text;
                })();
                const localeCode = i18n.language === 'de' ? 'de-DE' : 'en-US';
                const slotDate = option.startTime ? new Date(option.startTime).toLocaleDateString(localeCode, { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
                const slotWeekday = option.startTime ? new Date(option.startTime).toLocaleDateString(localeCode, { weekday: 'long' }) : null;
                const slotTimeStart = option.startTime ? new Date(option.startTime).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }) : null;
                const slotTimeEnd = option.endTime ? new Date(option.endTime).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }) : null;

                return (
                  <div key={option.id} className="border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground text-base">
                            <ClipboardList className="w-4 h-4 text-primary shrink-0" />
                            {slotTitle}
                          </span>
                          {slotDate && (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground text-base">
                              <Calendar className="w-4 h-4 text-primary shrink-0" />
                              {slotDate}
                            </span>
                          )}
                          {slotWeekday && (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground text-base">
                              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                              {slotWeekday}
                            </span>
                          )}
                          {slotTimeStart && (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground text-base">
                              <Clock className="w-4 h-4 text-primary shrink-0" />
                              {slotTimeStart}{slotTimeEnd ? ` – ${slotTimeEnd}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
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
                            <Badge className={isFull ? "bg-red-100 text-red-900" : "bg-green-100 text-green-900"}>
                              {signupCount} / {capacity || '∞'}
                              {isFull && <span className="ml-1">{t('results.full')}</span>}
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
                      <Progress value={fillPercent} className="h-1.5 mb-3" />
                    )}
                    
                    {slotVotes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {slotVotes.map((vote, idx) => (
                          <div key={idx} className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm">
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0">
                              {vote.voterName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'}
                            </div>
                            <span className="font-medium text-foreground">{vote.voterName}</span>
                            {vote.voterEmail && (
                              <span className="text-muted-foreground text-xs hidden sm:inline">
                                <Mail className="w-3 h-3 inline mr-0.5" />{vote.voterEmail}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">{t('results.noEntriesYet')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {isAdminAccess && (
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-primary" />
              {t('results.participantComments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{t('results.commentsAdminOnly')}</p>
            {adminComments.length > 0 ? (
              <div className="space-y-2">
                {adminComments.map((entry, idx) => (
                  <div key={`${entry.voterEmail}-${idx}`} className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <span className="font-medium">{entry.voterName}</span>
                    {entry.voterEmail ? <span className="text-muted-foreground"> ({entry.voterEmail})</span> : null}
                    <span className="text-muted-foreground">: </span>
                    <span>{entry.comment}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('results.noEntriesYet')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {!isOrganization && (
        <div ref={detailedResultsRef}>
        <Card className="polly-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('results.detailedResults')}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-sm bg-sky-100/60 text-slate-600 hover:bg-sky-100 hover:text-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-slate-100"
                onClick={() => setIsDetailedResultsOpen((prev) => !prev)}
                aria-label={isDetailedResultsOpen ? t('results.collapseDetailedResults') : t('results.expandDetailedResults')}
              >
                <ChevronDown className={`h-8 w-8 transition-transform ${isDetailedResultsOpen ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          {isDetailedResultsOpen && (
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs tracking-wide uppercase font-semibold text-muted-foreground">
                      {t('results.option')}
                    </th>
                    <th className="text-center py-3 px-4 text-xs tracking-wide uppercase font-semibold text-muted-foreground w-24">
                      {t('voting.yes')}
                    </th>
                    <th className="text-center py-3 px-4 text-xs tracking-wide uppercase font-semibold text-muted-foreground w-24">
                      {t('voting.maybe')}
                    </th>
                    <th className="text-center py-3 px-4 text-xs tracking-wide uppercase font-semibold text-muted-foreground w-24">
                      {t('voting.no')}
                    </th>
                    <th className="text-center py-3 px-4 text-xs tracking-wide uppercase font-semibold text-muted-foreground w-32">
                      <div className="flex flex-col items-center leading-tight">
                        <span>{t('results.pointsHeader')}</span>
                        <span className="text-[10px] normal-case font-normal text-muted-foreground">
                          ({t('voting.yes')}=2, {t('voting.maybe')}=1, {t('voting.no')}=0)
                        </span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 text-xs tracking-wide uppercase font-semibold text-muted-foreground w-36">
                      {t('results.status')}
                    </th>
                    {(isAdminAccess || isOwner) && adminToken && (
                      <th className="text-center py-3 px-4 text-xs tracking-wide uppercase font-semibold text-muted-foreground w-36">
                        {isSchedule ? t('resultsChart.confirmColumn') : t('resultsChart.setResultColumn')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rankedStats.map((stat) => {
                    const option = options.find(opt => opt.id === stat.optionId);
                    if (!option) return null;

                    const isFinalOption = isFinalized && poll.finalOptionId === stat.optionId;
                    const isWinnerRow = hasBestOption && stat.score === bestOption?.score && stat.score > 0;

                    return (
                      <tr key={stat.optionId} className={isWinnerRow ? "bg-green-50/60 dark:bg-green-950/20 border-l-4 border-l-green-500" : "hover:bg-muted/50"}>
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
                                <FormattedOptionText text={option.text} startTime={option.startTime} locale={i18n.language} />
                              </div>
                              {option.startTime && option.endTime && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {new Date(option.startTime).toLocaleDateString(localeCode)} • {" "}
                                  {new Date(option.startTime).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })} - {new Date(option.endTime).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 min-w-10 justify-center">
                            {stat.yesCount}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700 min-w-10 justify-center">
                            {stat.maybeCount}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 min-w-10 justify-center">
                            {stat.noCount}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-lg font-semibold text-foreground">{stat.score}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {isWinnerRow ? (
                            <Badge className="bg-emerald-600 text-white">
                              <Crown className="w-3 h-3 mr-1" />
                              {isTie ? t('resultsChart.tie') : t('resultsChart.winner')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-200 text-slate-700">
                              {t('results.lowFit')}
                            </Badge>
                          )}
                        </td>
                        {(isAdminAccess || isOwner) && adminToken && (
                          <td className="py-4 px-4 text-center">
                            {isFinalOption ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <Lock className="w-3 h-3 mr-1" />
                                {t('resultsChart.confirmed')}
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmDialogOptionId(stat.optionId)}
                                disabled={isFinalizingOption !== null || stat.score <= 0}
                                className="text-xs"
                              >
                                {isFinalizingOption === stat.optionId ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <CalendarCheck className="w-3 h-3 mr-1" />
                                )}
                                {isSchedule ? t('resultsChart.confirmDate') : t('resultsChart.setResult')}
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
          )}
        </Card>
        </div>
      )}

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
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#10b981' }}>{t('voting.yes')}</span>
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
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#f59e0b' }}>{t('voting.maybe')}</span>
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
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#ef4444' }}>{t('voting.no')}</span>
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
                      {t('results.pointsLabel', { count: currentStat.score })}
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

      <AlertDialog open={confirmDialogOptionId !== null} onOpenChange={(open) => { if (!open) setConfirmDialogOptionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isSchedule ? t('resultsChart.confirmDialogTitle') : t('resultsChart.confirmResultDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {(() => {
                    if (confirmDialogOptionId === null) return '';
                    const opt = options.find(o => o.id === confirmDialogOptionId);
                    if (!opt) return '';
                    const localeCode = i18n.language === 'de' ? 'de-DE' : 'en-US';
                    const dateStr = opt.startTime ? new Date(opt.startTime).toLocaleDateString(localeCode, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : opt.text;
                    const timeStr = opt.startTime && opt.endTime 
                      ? `${new Date(opt.startTime).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })} – ${new Date(opt.endTime).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })}`
                      : '';
                    return isSchedule 
                      ? t('resultsChart.confirmDialogDescription', { date: dateStr, time: timeStr })
                      : t('resultsChart.confirmResultDialogDescription', { option: opt.text });
                  })()}
                </p>
                <div className="space-y-2 pt-2 border-t">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={finalizeClosePoll}
                      onChange={(e) => setFinalizeClosePoll(e.target.checked)}
                      className="rounded border-gray-300 w-4 h-4 accent-primary"
                    />
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t('resultsChart.closePollOption')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={finalizeNotify}
                      onChange={(e) => setFinalizeNotify(e.target.checked)}
                      className="rounded border-gray-300 w-4 h-4 accent-primary"
                    />
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t('resultsChart.notifyParticipantsOption')}</span>
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmDialogOptionId !== null) handleFinalize(confirmDialogOptionId); }}
              disabled={isFinalizingOption !== null}
            >
              {isFinalizingOption !== null ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CalendarCheck className="w-4 h-4 mr-1" />}
              {isSchedule ? t('resultsChart.confirmDate') : t('resultsChart.setResult')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Org: Confirm Sign-ups dialog */}
      <AlertDialog open={orgConfirmDialogOpen} onOpenChange={(open) => { if (!open) setOrgConfirmDialogOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('resultsChart.confirmSignupsDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {t('resultsChart.confirmSignupsDialogDescription', {
                    count: new Set(
                      (results.votes ?? [])
                        .filter((v: any) => v.response === 'yes')
                        .map((v: any) => v.voterName)
                    ).size,
                  })}
                </p>
                {/* Slot-by-slot occupancy breakdown */}
                {options.length > 0 && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 max-h-40 overflow-y-auto">
                    {options.map((option: any) => {
                      const filled = (results.votes ?? []).filter((v: any) => v.optionId === option.id && v.response === 'yes').length;
                      const capacity = option.maxCapacity || 0;
                      const isFull = capacity > 0 && filled >= capacity;
                      return (
                        <div key={option.id} className="flex items-center justify-between text-xs gap-2">
                          <span className="truncate text-foreground">
                            <FormattedOptionText text={option.text} startTime={option.startTime} locale={i18n.language} />
                          </span>
                          <span className={`shrink-0 font-medium tabular-nums ${isFull ? 'text-red-600 dark:text-red-400' : filled > 0 ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                            {filled}{capacity > 0 ? `/${capacity}` : ''} {t('results.entriesPlural')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-2 pt-2 border-t">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={orgFinalizeClosePoll}
                      onChange={(e) => setOrgFinalizeClosePoll(e.target.checked)}
                      className="rounded border-gray-300 w-4 h-4 accent-primary"
                    />
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t('resultsChart.closeRegistrationOption')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={orgFinalizeNotify}
                      onChange={(e) => setOrgFinalizeNotify(e.target.checked)}
                      className="rounded border-gray-300 w-4 h-4 accent-primary"
                    />
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t('resultsChart.notifySignupsOption')}</span>
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOrgFinalize}
              disabled={isFinalizingOption !== null}
            >
              {isFinalizingOption !== null ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-1" />}
              {t('resultsChart.confirmSignups')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
