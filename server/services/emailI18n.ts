/**
 * Localized strings for every email Polly sends.
 *
 * German ("de") is the historical language: its strings must stay byte-identical
 * to the pre-i18n output so existing installations see no change. English ("en")
 * is a complete translation. User-authored content (poll titles, messages,
 * custom templates) is never translated.
 */
import { DEFAULT_EMAIL_LANGUAGE, isEmailLanguage, type EmailLanguage } from '@shared/schema';

export type { EmailLanguage };

export function normalizeEmailLanguage(value: unknown): EmailLanguage | undefined {
  if (typeof value !== 'string') return undefined;
  const short = value.trim().toLowerCase().slice(0, 2);
  return isEmailLanguage(short) ? short : undefined;
}

export function emailLocale(lang: EmailLanguage): string {
  return lang === 'en' ? 'en-GB' : 'de-DE';
}

export type PollTypeKey = 'schedule' | 'survey' | 'organization';

const POLL_TYPE_LABELS: Record<EmailLanguage, Record<PollTypeKey, string>> = {
  de: { schedule: 'Terminumfrage', survey: 'Umfrage', organization: 'Orga-Liste' },
  en: { schedule: 'Schedule Poll', survey: 'Survey', organization: 'Organization List' },
};

export function pollTypeLabel(type: string | undefined, lang: EmailLanguage): string {
  const labels = POLL_TYPE_LABELS[lang];
  if (type === 'schedule' || type === 'organization') return labels[type];
  return labels.survey;
}

/** Formats a confirmed appointment slot for the finalization email. */
export function formatConfirmedSlot(
  slot: { startTime: Date | null; endTime: Date | null; text: string },
  lang: EmailLanguage,
): { confirmedDate: string; confirmedTime: string } {
  const locale = emailLocale(lang);
  const { startTime, endTime } = slot;
  const confirmedDate = startTime
    ? startTime.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : slot.text;

  let confirmedTime = '';
  if (startTime && (startTime.getHours() !== 0 || startTime.getMinutes() !== 0)) {
    const suffix = lang === 'de' ? ' Uhr' : '';
    confirmedTime = startTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (endTime && (endTime.getHours() !== 0 || endTime.getMinutes() !== 0)) {
      confirmedTime += ` \u2013 ${endTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}${suffix}`;
    } else {
      confirmedTime += suffix;
    }
  }
  return { confirmedDate, confirmedTime };
}

function quoteDe(text: string): string {
  return `\u201E${text}\u201C`;
}

function quoteEn(text: string): string {
  return `\u201C${text}\u201D`;
}

const de = {
  quote: quoteDe,
  greeting: (name: string) => (name ? `Hallo ${name}` : 'Hallo'),
  defaultPollType: 'Umfrage',
  someone: 'Jemand',
  privacy: 'Datenschutz',
  openLink: 'Link \u00f6ffnen \u2192',
  organizerMessage: 'Nachricht des Organisators',
  templateError: 'Template-Fehler: Kein Inhalt verf\u00FCgbar',
  pollCreated: {
    sublineRegistered: (greeting: string) => `${greeting} \u2014 unten befinden sich der Direktlink zur Umfrage sowie der Abstimmungslink f\u00FCr die Teilnehmer.`,
    sublineGuest: (greeting: string) => `${greeting} \u2014 unten befinden sich der pers\u00F6nliche Administratorlink sowie der Abstimmungslink f\u00FCr die Teilnehmer.`,
    headlineBefore: 'Umfrage',
    headlineAfter: 'wurde erstellt.',
    noticeTitleRegistered: 'Diese E-Mail dient als Schnellzugriff.',
    noticeTitleGuest: 'Bitte diese E-Mail aufbewahren.',
    noticeBodyRegistered: 'Registrierte Nutzer k\u00F6nnen die Umfrage jederzeit auch unter \u201EMeine Umfragen\u201C verwalten \u2014 nach der Anmeldung.',
    noticeBodyGuest: 'Diese E-Mail enth\u00E4lt den pers\u00F6nlichen Administratorlink \u2014 nur damit l\u00E4sst sich die Umfrage verwalten, bearbeiten und schlie\u00DFen.',
    adminLabel: 'Administratorlink',
    adminTitle: 'Umfrage verwalten',
    adminDescription: 'Bearbeiten, schlie\u00DFen und Ergebnisse einsehen. Nicht weitergeben.',
    adminButton: 'Zur Verwaltung \u2192',
    publicLabel: '\u00D6ffentlicher Link \u00B7 F\u00FCr Teilnehmer',
    publicTitle: 'Abstimmung \u00F6ffnen',
    publicDescription: 'Diesen Link an alle Teilnehmer weiterleiten, damit diese abstimmen k\u00F6nnen.',
    publicButton: 'Zur Abstimmung \u2192',
    // Plain-text replacement for registered creators (default text template).
    textGuestNotice: /Den Administratorlink sicher aufbewahren\. Nur damit l\u00E4sst sich die Umfrage verwalten\./,
    textRegisteredNotice: 'Diese E-Mail dient als Schnellzugriff. Registrierte Nutzer k\u00F6nnen die Umfrage jederzeit auch unter \u201EMeine Umfragen\u201C verwalten.',
  },
  invitation: {
    tag: 'Einladung',
    headline: 'Einladung zur Abstimmung',
    subline: (inviter: string) => `${inviter} l\u00E4dt Sie ein, an dieser Umfrage teilzunehmen.`,
    buttonText: 'Klicken Sie auf den Button, um zur Abstimmung zu gelangen.',
    button: 'Jetzt abstimmen \u2192',
  },
  newVote: {
    participantFallback: 'Ein Teilnehmer',
    tag: 'Neue Abstimmung',
    headline: 'Neue Abstimmung eingegangen',
    subline: (participant: string, pollType: string, quotedTitle: string) => `${participant} hat soeben an Ihrer ${pollType} ${quotedTitle} teilgenommen.`,
    manageLabel: 'Verwaltung',
    manageTitle: 'Umfrage verwalten',
    manageDescription: 'Hier k\u00F6nnen Sie die Umfrage verwalten und alle Stimmen einsehen.',
    manageButton: 'Umfrage verwalten \u2192',
    resultsLabel: 'Ergebnisse',
    resultsTitle: 'Ergebnisse ansehen',
    resultsDescription: 'Sehen Sie sich die aktuellen Ergebnisse der Umfrage an.',
    resultsButton: 'Ergebnisse anzeigen \u2192',
  },
  reminder: {
    currentSelection: 'Ihre aktuelle Auswahl',
    tag: 'Erinnerung',
    headlineBefore: 'Erinnerung an',
    subline: (sender: string) => `${sender} erinnert Sie freundlich an die Teilnahme. Ihre Stimme ist wichtig!`,
    buttonText: 'Bitte nehmen Sie sich kurz Zeit, um abzustimmen.',
    button: 'Jetzt abstimmen \u2192',
    expiry: (formattedDate: string) => `Die Umfrage endet am ${formattedDate} Uhr.`,
  },
  vote: {
    responseLabels: { yes: 'Ja', maybe: 'Vielleicht', no: 'Nein' } as Record<string, string>,
    selection: 'Ihre Auswahl',
    currentSelection: 'Ihre aktuelle Auswahl',
    withdrawText: '\u00DCber diesen Link k\u00F6nnen Sie Ihre Stimme zur\u00FCckziehen.',
    editText: 'Wenn Sie Ihre Auswahl sp\u00E4ter \u00E4ndern m\u00F6chten, k\u00F6nnen Sie daf\u00FCr diesen Link verwenden.',
    withdrawButton: 'Stimme zur\u00FCckziehen \u2192',
    editButton: 'Stimme bearbeiten \u2192',
    withdrawLabel: 'Stimme zur\u00FCckziehen',
    editLabel: 'Stimme bearbeiten',
    confirmationTag: 'Best\u00E4tigung',
    confirmationHeadline: 'Vielen Dank f\u00FCr Ihre Teilnahme!',
    confirmationSubline: (greeting: string, pollType: string, quotedTitle: string) => `${greeting} \u2014 vielen Dank f\u00FCr Ihre Teilnahme an der ${pollType} ${quotedTitle}. Ihre Auswahl wurde erfolgreich gespeichert.`,
    resultsText: 'Mit diesem Link k\u00F6nnen Sie jederzeit zur Umfrage zur\u00FCckkehren oder die aktuellen Ergebnisse einsehen.',
    resultsButton: 'Ergebnisse anzeigen \u2192',
    updatedEditText: 'Wenn Sie Ihre Auswahl erneut \u00E4ndern m\u00F6chten, k\u00F6nnen Sie daf\u00FCr diesen Link verwenden.',
    updatedEditButton: 'Stimme weiter bearbeiten \u2192',
    updatedTag: 'Aktualisiert',
    updatedHeadline: 'Ihre Abstimmung wurde aktualisiert',
    updatedSubline: (greeting: string, pollType: string, quotedTitle: string) => `${greeting} \u2014 Ihre Auswahl f\u00FCr die ${pollType} ${quotedTitle} wurde erfolgreich aktualisiert.`,
  },
  security: {
    tag: 'Sicherheit',
    notRequestedBold: 'Falls Sie diese Anfrage nicht gestellt haben,',
    resetHeadline: 'Passwort zur\u00FCcksetzen',
    resetSubline: (greeting: string) => `${greeting} \u2014 Sie haben angefordert, Ihr Passwort zur\u00FCckzusetzen.`,
    resetButtonText: 'Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben. Dieser Link ist 1 Stunde g\u00FCltig.',
    resetButton: 'Passwort zur\u00FCcksetzen \u2192',
    resetNotice: 'k\u00F6nnen Sie diese E-Mail ignorieren. Ihr Passwort bleibt unver\u00E4ndert.',
    changeHeadline: 'E-Mail-Adresse best\u00E4tigen',
    changeSubline: 'Sie haben angefordert, Ihre E-Mail-Adresse zu \u00E4ndern.',
    oldEmail: 'Alte E-Mail:',
    newEmail: 'Neue E-Mail:',
    changeValidity: 'Dieser Link ist 24 Stunden g\u00FCltig.',
    changeButton: 'E-Mail best\u00E4tigen \u2192',
    changeNotice: 'k\u00F6nnen Sie diese E-Mail ignorieren.',
    changedHeadline: 'Passwort erfolgreich ge\u00E4ndert',
    changedSubline: (greeting: string) => `${greeting} \u2014 Ihr Passwort wurde erfolgreich ge\u00E4ndert.`,
    changedNoticeBold: 'Falls Sie diese \u00C4nderung nicht vorgenommen haben,',
    changedNotice: 'kontaktieren Sie bitte umgehend den Administrator.',
  },
  testReport: {
    tag: 'Testbericht',
    headline: (status: string, runId: string) => `${status} \u2014 Testlauf #${runId}`,
    subline: 'Der automatische Testlauf wurde abgeschlossen.',
    total: 'Gesamte Tests',
    passed: 'Bestanden',
    failed: 'Fehlgeschlagen',
    skipped: '\u00DCbersprungen',
    duration: 'Dauer',
    started: 'Gestartet',
    allPassed: 'Alle Tests bestanden',
    someFailed: (count: number) => `${count} Test(s) fehlgeschlagen`,
    seconds: (count: number) => `${count} Sekunden`,
    unknownDuration: 'Unbekannt',
    failedHeading: (count: number) => `Fehlgeschlagene Tests (${count})`,
    pdfHint: 'Vollst\u00E4ndige Details finden Sie im angeh\u00E4ngten PDF-Bericht.',
    pdfFilename: (runId: number) => `testbericht-${runId}.pdf`,
  },
  welcome: {
    tag: 'Willkommen',
    headline: (siteName: string) => `Willkommen bei ${siteName}!`,
    subline: (greeting: string) => `${greeting} \u2014 vielen Dank f\u00FCr Ihre Registrierung! Ihr Account wurde erfolgreich erstellt.`,
    buttonText: 'Bitte best\u00E4tigen Sie Ihre E-Mail-Adresse, um alle Funktionen nutzen zu k\u00F6nnen.',
    button: 'E-Mail best\u00E4tigen \u2192',
  },
  finalized: {
    goToPoll: 'Zur Umfrage \u2192',
    viewResults: 'Ergebnisse anzeigen \u2192',
    videoConference: 'Videokonferenz:',
    scheduleTag: 'Termin best\u00E4tigt',
    scheduleHeadline: 'Termin festgelegt f\u00FCr',
    date: 'Datum:',
    time: 'Uhrzeit:',
    icsNote: 'Im Anhang finden Sie eine Kalendereinladung (.ics), die Sie direkt in Ihren Kalender importieren k\u00F6nnen.',
    scheduleButtonText: 'Klicken Sie auf den Button, um die Umfrage und Ergebnisse einzusehen.',
    resultsPublicNote: 'Die Ergebnisse sind \u00F6ffentlich einsehbar \u2013 klicken Sie auf den Button, um sie anzuzeigen.',
    resultsPrivateNote: 'Der Ersteller hat die Ergebnisse nicht \u00F6ffentlich gemacht.',
    finalResult: 'Festgelegtes Ergebnis:',
    slotOverview: 'Slot-\u00DCbersicht:',
    endedTag: 'Umfrage beendet',
    endedHeadline: 'Die Umfrage wurde abgeschlossen:',
    pollEndedStatus: 'Umfrage beendet',
    pollCompletedStatus: 'Umfrage abgeschlossen',
    slotFilled: 'belegt',
    moreSlots: (count: number) => `\u2026 und ${count} weitere`,
    orgConfirmedStatus: 'Anmeldung best\u00E4tigt',
    orgConfirmedButton: 'Zur Anmeldeliste \u2192',
    orgSummaryStatus: 'Anmelde\u00FCbersicht',
    orgSummaryButton: 'Anmeldeliste \u00F6ffnen \u2192',
    icsFilename: 'termin.ics',
  },
  withdrawal: {
    subjectOrganizer: (title: string) => `Stimme zur\u00FCckgezogen: ${title}`,
    subjectVoter: (title: string) => `Ihre Stimme wurde zur\u00FCckgezogen: ${title}`,
    headingOrganizer: 'Eine Stimme wurde zur\u00FCckgezogen.',
    headingVoter: 'Ihre Stimme wurde zur\u00FCckgezogen.',
    messageOrganizer: (voter: string, title: string) => `${voter || 'Eine teilnehmende Person'} hat die Teilnahme an \u201E${title}\u201C zur\u00FCckgezogen. Die Antworten werden nicht mehr gez\u00E4hlt.`,
    messageVoter: (voter: string, title: string) => `${voter ? `Hallo ${voter} \u2014 ` : ''}Ihre Antworten f\u00FCr \u201E${title}\u201C wurden entfernt und werden nicht mehr gez\u00E4hlt.`,
    labelOrganizer: 'Umfrage verwalten',
    labelVoter: 'Zur Umfrage',
    tag: 'Zur\u00FCckgezogen',
  },
  virus: {
    subject: (virus: string) => `[Polly Security Alert] Virus erkannt: ${virus}`,
    heading: '\u26A0\uFE0F Sicherheitswarnung: Virus erkannt',
    intro: 'ClamAV hat einen Virus in einer hochgeladenen Datei erkannt.',
    blocked: 'Die Datei wurde automatisch blockiert und nicht gespeichert.',
    virusName: 'Erkannter Virus:',
    filename: 'Dateiname:',
    fileSize: 'Dateigr\u00F6\u00DFe:',
    uploader: 'Uploader:',
    ip: 'IP-Adresse:',
    time: 'Zeitpunkt:',
    anonymous: 'Anonym / Unbekannt',
    notAvailable: 'Nicht verf\u00FCgbar',
    actionBold: '\u2713 Automatische Ma\u00DFnahme:',
    action: 'Die infizierte Datei wurde abgelehnt und nicht im System gespeichert.',
    textTitle: 'POLLY SECURITY ALERT - Virus erkannt!',
    bytes: 'Bytes',
  },
  deletion: {
    subject: 'Neuer L\u00F6schantrag eingegangen',
    heading: 'Neuer L\u00F6schantrag',
    intro: 'Ein Benutzer hat die L\u00F6schung seines Kontos beantragt:',
    user: 'Benutzer:',
    email: 'E-Mail:',
    date: 'Datum:',
    button: 'L\u00F6schantr\u00E4ge verwalten',
  },
  unsubscribeSubject: 'Abbestellen',
};

export type EmailStrings = typeof de;

const en: EmailStrings = {
  quote: quoteEn,
  greeting: (name: string) => (name ? `Hello ${name}` : 'Hello'),
  defaultPollType: 'Poll',
  someone: 'Someone',
  privacy: 'Privacy',
  openLink: 'Open link \u2192',
  organizerMessage: 'Message from the organizer',
  templateError: 'Template error: no content available',
  pollCreated: {
    sublineRegistered: (greeting: string) => `${greeting} \u2014 below you will find the direct link to your poll and the voting link for participants.`,
    sublineGuest: (greeting: string) => `${greeting} \u2014 below you will find your personal administrator link and the voting link for participants.`,
    headlineBefore: 'Poll',
    headlineAfter: 'has been created.',
    noticeTitleRegistered: 'This email is your quick access.',
    noticeTitleGuest: 'Please keep this email.',
    noticeBodyRegistered: 'Registered users can also manage the poll at any time under \u201CMy Polls\u201D \u2014 after signing in.',
    noticeBodyGuest: 'This email contains your personal administrator link \u2014 it is the only way to manage, edit and close the poll.',
    adminLabel: 'Administrator link',
    adminTitle: 'Manage poll',
    adminDescription: 'Edit, close and view results. Do not share.',
    adminButton: 'Manage poll \u2192',
    publicLabel: 'Public link \u00B7 For participants',
    publicTitle: 'Open voting',
    publicDescription: 'Share this link with all participants so they can vote.',
    publicButton: 'Go to voting \u2192',
    textGuestNotice: /Keep the administrator link safe\. It is the only way to manage the poll\./,
    textRegisteredNotice: 'This email is your quick access. Registered users can also manage the poll at any time under \u201CMy Polls\u201D.',
  },
  invitation: {
    tag: 'Invitation',
    headline: 'Invitation to vote',
    subline: (inviter: string) => `${inviter} invites you to take part in this poll.`,
    buttonText: 'Click the button to go to the poll.',
    button: 'Vote now \u2192',
  },
  newVote: {
    participantFallback: 'A participant',
    tag: 'New response',
    headline: 'New response received',
    subline: (participant: string, pollType: string, quotedTitle: string) => `${participant} has just taken part in your ${pollType} ${quotedTitle}.`,
    manageLabel: 'Management',
    manageTitle: 'Manage poll',
    manageDescription: 'Manage the poll and see all responses here.',
    manageButton: 'Manage poll \u2192',
    resultsLabel: 'Results',
    resultsTitle: 'View results',
    resultsDescription: 'Take a look at the current results of the poll.',
    resultsButton: 'View results \u2192',
  },
  reminder: {
    currentSelection: 'Your current selection',
    tag: 'Reminder',
    headlineBefore: 'Reminder for',
    subline: (sender: string) => `${sender} kindly reminds you to take part. Your vote matters!`,
    buttonText: 'Please take a moment to vote.',
    button: 'Vote now \u2192',
    expiry: (formattedDate: string) => `The poll ends on ${formattedDate}.`,
  },
  vote: {
    responseLabels: { yes: 'Yes', maybe: 'Maybe', no: 'No' },
    selection: 'Your selection',
    currentSelection: 'Your current selection',
    withdrawText: 'Use this link to withdraw your vote.',
    editText: 'If you want to change your selection later, you can use this link.',
    withdrawButton: 'Withdraw vote \u2192',
    editButton: 'Edit vote \u2192',
    withdrawLabel: 'Withdraw vote',
    editLabel: 'Edit vote',
    confirmationTag: 'Confirmation',
    confirmationHeadline: 'Thank you for taking part!',
    confirmationSubline: (greeting: string, pollType: string, quotedTitle: string) => `${greeting} \u2014 thank you for taking part in the ${pollType} ${quotedTitle}. Your selection has been saved.`,
    resultsText: 'Use this link to return to the poll or view the current results at any time.',
    resultsButton: 'View results \u2192',
    updatedEditText: 'If you want to change your selection again, you can use this link.',
    updatedEditButton: 'Edit vote again \u2192',
    updatedTag: 'Updated',
    updatedHeadline: 'Your vote has been updated',
    updatedSubline: (greeting: string, pollType: string, quotedTitle: string) => `${greeting} \u2014 your selection for the ${pollType} ${quotedTitle} has been updated.`,
  },
  security: {
    tag: 'Security',
    notRequestedBold: 'If you did not make this request,',
    resetHeadline: 'Reset your password',
    resetSubline: (greeting: string) => `${greeting} \u2014 you requested to reset your password.`,
    resetButtonText: 'Click the button below to choose a new password. This link is valid for 1 hour.',
    resetButton: 'Reset password \u2192',
    resetNotice: 'you can ignore this email. Your password will remain unchanged.',
    changeHeadline: 'Confirm your email address',
    changeSubline: 'You requested to change your email address.',
    oldEmail: 'Old email:',
    newEmail: 'New email:',
    changeValidity: 'This link is valid for 24 hours.',
    changeButton: 'Confirm email \u2192',
    changeNotice: 'you can ignore this email.',
    changedHeadline: 'Password changed successfully',
    changedSubline: (greeting: string) => `${greeting} \u2014 your password has been changed.`,
    changedNoticeBold: 'If you did not make this change,',
    changedNotice: 'please contact the administrator immediately.',
  },
  testReport: {
    tag: 'Test report',
    headline: (status: string, runId: string) => `${status} \u2014 Test run #${runId}`,
    subline: 'The automated test run has finished.',
    total: 'Total tests',
    passed: 'Passed',
    failed: 'Failed',
    skipped: 'Skipped',
    duration: 'Duration',
    started: 'Started',
    allPassed: 'All tests passed',
    someFailed: (count: number) => `${count} test(s) failed`,
    seconds: (count: number) => `${count} seconds`,
    unknownDuration: 'Unknown',
    failedHeading: (count: number) => `Failed tests (${count})`,
    pdfHint: 'Full details are in the attached PDF report.',
    pdfFilename: (runId: number) => `test-report-${runId}.pdf`,
  },
  welcome: {
    tag: 'Welcome',
    headline: (siteName: string) => `Welcome to ${siteName}!`,
    subline: (greeting: string) => `${greeting} \u2014 thank you for registering! Your account has been created.`,
    buttonText: 'Please confirm your email address to use all features.',
    button: 'Confirm email \u2192',
  },
  finalized: {
    goToPoll: 'Go to poll \u2192',
    viewResults: 'View results \u2192',
    videoConference: 'Video conference:',
    scheduleTag: 'Date confirmed',
    scheduleHeadline: 'Date set for',
    date: 'Date:',
    time: 'Time:',
    icsNote: 'A calendar invitation (.ics) is attached, which you can import directly into your calendar.',
    scheduleButtonText: 'Click the button to view the poll and its results.',
    resultsPublicNote: 'The results are public \u2013 click the button to view them.',
    resultsPrivateNote: 'The creator has not made the results public.',
    finalResult: 'Final result:',
    slotOverview: 'Slot overview:',
    endedTag: 'Poll ended',
    endedHeadline: 'The poll has been closed:',
    pollEndedStatus: 'Poll ended',
    pollCompletedStatus: 'Poll completed',
    slotFilled: 'taken',
    moreSlots: (count: number) => `\u2026 and ${count} more`,
    orgConfirmedStatus: 'Sign-up confirmed',
    orgConfirmedButton: 'Go to sign-up list \u2192',
    orgSummaryStatus: 'Sign-up overview',
    orgSummaryButton: 'Open sign-up list \u2192',
    icsFilename: 'appointment.ics',
  },
  withdrawal: {
    subjectOrganizer: (title: string) => `Vote withdrawn: ${title}`,
    subjectVoter: (title: string) => `Your vote has been withdrawn: ${title}`,
    headingOrganizer: 'A vote has been withdrawn.',
    headingVoter: 'Your vote has been withdrawn.',
    messageOrganizer: (voter: string, title: string) => `${voter || 'A participant'} has withdrawn from \u201C${title}\u201D. Their answers no longer count.`,
    messageVoter: (voter: string, title: string) => `${voter ? `Hello ${voter} \u2014 your` : 'Your'} answers for \u201C${title}\u201D have been removed and no longer count.`,
    labelOrganizer: 'Manage poll',
    labelVoter: 'Go to poll',
    tag: 'Withdrawn',
  },
  virus: {
    subject: (virus: string) => `[Polly Security Alert] Virus detected: ${virus}`,
    heading: '\u26A0\uFE0F Security alert: virus detected',
    intro: 'ClamAV detected a virus in an uploaded file.',
    blocked: 'The file was blocked automatically and was not stored.',
    virusName: 'Detected virus:',
    filename: 'File name:',
    fileSize: 'File size:',
    uploader: 'Uploader:',
    ip: 'IP address:',
    time: 'Time:',
    anonymous: 'Anonymous / unknown',
    notAvailable: 'Not available',
    actionBold: '\u2713 Automatic action:',
    action: 'The infected file was rejected and not stored in the system.',
    textTitle: 'POLLY SECURITY ALERT - Virus detected!',
    bytes: 'bytes',
  },
  deletion: {
    subject: 'New account deletion request',
    heading: 'New deletion request',
    intro: 'A user has requested the deletion of their account:',
    user: 'User:',
    email: 'Email:',
    date: 'Date:',
    button: 'Manage deletion requests',
  },
  unsubscribeSubject: 'Unsubscribe',
};

const STRINGS: Record<EmailLanguage, EmailStrings> = { de, en };

export function emailStrings(lang: EmailLanguage | undefined): EmailStrings {
  return STRINGS[lang ?? DEFAULT_EMAIL_LANGUAGE] ?? STRINGS[DEFAULT_EMAIL_LANGUAGE];
}

/** Default footers per language. German matches the legacy footer exactly. */
export const DEFAULT_EMAIL_FOOTERS: Record<EmailLanguage, string> = {
  de: 'Diese E-Mail wurde automatisch von {{siteName}} erstellt.\n{{link:#|Datenschutz}}',
  en: 'This email was sent automatically by {{siteName}}.\n{{link:#|Privacy}}',
};

/**
 * Matches the trailing auto-generated footer line in plain-text templates
 * (either language) so it can be swapped for the configured footer.
 */
export const AUTO_FOOTER_DETECT = /\n---\n(?:Diese E-Mail wurde automatisch vo[nm]|This email was (?:sent|generated) automatically)/;
export const AUTO_FOOTER_REPLACE = /\n---\n(?:Diese E-Mail wurde automatisch vo[nm]|This email was (?:sent|generated) automatically)[^\n]*$/;
