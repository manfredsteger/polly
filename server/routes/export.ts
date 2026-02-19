import { Router } from "express";
import { storage } from "../storage";
import { randomBytes } from "crypto";
import { extractUserId, requireAuth, API_VERSION } from "./common";
import { pdfService } from "../services/pdfService";
import { qrService } from "../services/qrService";
import { icsService } from "../services/icsService";

const router = Router();

function safeContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// Generate QR code for poll (returns base64 data URL)
router.get('/polls/:token/qr', async (req, res) => {
  try {
    const poll = await storage.getPollByPublicToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const format = (req.query.format as string) === 'svg' ? 'svg' : 'png';
    
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const pollUrl = `${baseUrl}/poll/${req.params.token}`;
    
    const qrCode = await qrService.generateQRCode(pollUrl, format);
    res.json({ qrCode, format, pollUrl });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download QR code as file (PNG or SVG)
router.get('/polls/:token/qr/download', async (req, res) => {
  try {
    const poll = await storage.getPollByPublicToken(req.params.token);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const format = (req.query.format as string) === 'svg' ? 'svg' : 'png';
    
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const pollUrl = `${baseUrl}/poll/${req.params.token}`;
    
    const buffer = await qrService.generateQRCodeBuffer(pollUrl, format);
    
    const sanitizedTitle = poll.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, '_').substring(0, 50);
    const filename = `QR_${sanitizedTitle}.${format}`;
    
    res.setHeader('Content-Type', format === 'svg' ? 'image/svg+xml' : 'image/png');
    res.setHeader('Content-Disposition', safeContentDisposition(filename));
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading QR code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export poll results as PDF
router.get('/polls/:token/export/pdf', async (req, res) => {
  try {
    let poll;
    let isAdmin = false;
    
    poll = await storage.getPollByAdminToken(req.params.token);
    if (poll) {
      isAdmin = true;
    } else {
      poll = await storage.getPollByPublicToken(req.params.token);
    }
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (!poll.resultsPublic && !isAdmin) {
      const userId = await extractUserId(req);
      const isCreator = userId && poll.userId === userId;
      
      if (!isCreator) {
        return res.status(403).json({ 
          error: 'Ergebnisse sind nur für den Ersteller sichtbar',
          resultsPrivate: true 
        });
      }
    }

    const results = await storage.getPollResults(poll.id);
    
    const customization = await storage.getCustomizationSettings();
    
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const pollUrl = `${baseUrl}/poll/${poll.publicToken}`;
    
    const qrCodeDataUrl = await qrService.generateQRCode(pollUrl, 'png');
    
    const pdfOptions = {
      logoUrl: customization.branding?.logoUrl || undefined,
      siteName: customization.branding?.siteName || 'Poll',
      siteNameAccent: customization.branding?.siteNameAccent || 'y',
      qrCodeDataUrl,
      pollUrl,
    };
    
    const pdfBuffer = await pdfService.generatePollResultsPDF(results, pdfOptions);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', safeContentDisposition(`${poll.title}_results.pdf`));
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export poll results as CSV (participant × option matrix)
router.get('/polls/:token/export/csv', async (req, res) => {
  try {
    let poll;
    let isAdmin = false;
    
    poll = await storage.getPollByAdminToken(req.params.token);
    if (poll) {
      isAdmin = true;
    } else {
      poll = await storage.getPollByPublicToken(req.params.token);
    }
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (!poll.resultsPublic && !isAdmin) {
      const userId = await extractUserId(req);
      const isCreator = userId && poll.userId === userId;
      
      if (!isCreator) {
        return res.status(403).json({ 
          error: 'Ergebnisse sind nur für den Ersteller sichtbar',
          resultsPrivate: true 
        });
      }
    }

    const lang = (req.query.lang as string) || 'de';
    const labels = lang === 'en'
      ? { yes: 'Yes', maybe: 'Maybe', no: 'No', unknown: 'Unknown' }
      : { yes: 'Ja', maybe: 'Vielleicht', no: 'Nein', unknown: 'Unbekannt' };

    const results = await storage.getPollResults(poll.id);
    const options = results.options;

    const deduped = new Map<string, typeof results.votes[0]>();
    for (const vote of results.votes) {
      const voterKey = vote.userId ? `user_${vote.userId}` : `email_${vote.voterEmail || vote.voterName}`;
      const key = `${voterKey}__${vote.optionId}`;
      const existing = deduped.get(key);
      if (!existing || (vote.updatedAt && existing.updatedAt && vote.updatedAt > existing.updatedAt) || (!existing.updatedAt && vote.id > existing.id)) {
        deduped.set(key, vote);
      }
    }

    const participantMap = new Map<string, { name: string; responses: Map<number, string> }>();
    for (const vote of deduped.values()) {
      const voterKey = vote.userId ? `user_${vote.userId}` : `email_${vote.voterEmail || vote.voterName}`;
      if (!participantMap.has(voterKey)) {
        participantMap.set(voterKey, { name: vote.voterName || vote.voterEmail || '', responses: new Map() });
      }
      participantMap.get(voterKey)!.responses.set(vote.optionId, vote.response);
    }

    const csvEscape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const sep = ';';
    const rows: string[] = [];

    const hasScheduleDates = options.some(o => o.startTime);
    if (hasScheduleDates) {
      const dateLocale = lang === 'en' ? 'en-GB' : 'de-DE';
      const dateRow = [''].concat(options.map(o => {
        if (o.startTime) {
          return csvEscape(new Date(o.startTime).toLocaleDateString(dateLocale));
        }
        return '""';
      }));
      rows.push(dateRow.join(sep));
    }

    const participantLabel = lang === 'en' ? 'Participant' : 'Teilnehmer';
    const totalLabel = lang === 'en' ? 'Total' : 'Gesamt';

    const headerRow = [csvEscape(participantLabel)].concat(options.map(o => csvEscape(o.text)));
    rows.push(headerRow.join(sep));

    for (const [, participant] of participantMap) {
      const row = [csvEscape(participant.name)];
      for (const option of options) {
        const response = participant.responses.get(option.id);
        if (response === 'yes') row.push(csvEscape(labels.yes));
        else if (response === 'maybe') row.push(csvEscape(labels.maybe));
        else if (response === 'no') row.push(csvEscape(labels.no));
        else row.push('');
      }
      rows.push(row.join(sep));
    }

    const totalRow = [csvEscape(totalLabel)];
    for (const option of options) {
      const stat = results.stats.find(s => s.optionId === option.id);
      totalRow.push(String(stat ? stat.yesCount + stat.maybeCount : 0));
    }
    rows.push(totalRow.join(sep));

    const csv = '\uFEFF' + rows.join('\n') + '\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', safeContentDisposition(`${poll.title}_results.csv`));
    res.send(csv);
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export poll results as ICS (calendar file)
router.get('/polls/:token/export/ics', async (req, res) => {
  try {
    let poll;
    
    poll = await storage.getPollByAdminToken(req.params.token);
    if (!poll) {
      poll = await storage.getPollByPublicToken(req.params.token);
    }
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const results = await storage.getPollResults(poll.id);
    const calendarSettings = await storage.getCalendarSettings();
    
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    
    const language = (req.query.lang as 'de' | 'en') || 'de';
    const voterEmail = req.query.email as string | undefined;
    
    const icsContent = icsService.generatePollIcs(
      poll,
      results.options,
      results.votes,
      baseUrl,
      {
        settings: calendarSettings,
        language,
        voterEmail,
      }
    );
    
    const sanitizedTitle = poll.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, '_').substring(0, 50);
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', safeContentDisposition(`${sanitizedTitle}.ics`));
    res.send(icsContent);
  } catch (error) {
    console.error('Error generating ICS:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get calendar subscription token for authenticated user
router.get('/calendar/token', requireAuth, async (req, res) => {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let calendarToken = user.calendarToken;
    
    if (!calendarToken) {
      calendarToken = randomBytes(32).toString('hex');
      await storage.updateUser(userId, { calendarToken });
    }

    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const webcalUrl = `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/${API_VERSION}/calendar/${calendarToken}/feed.ics`;
    const httpsUrl = `${baseUrl}/api/${API_VERSION}/calendar/${calendarToken}/feed.ics`;

    res.json({ 
      calendarToken,
      webcalUrl,
      httpsUrl
    });
  } catch (error) {
    console.error('Error getting calendar token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Regenerate calendar subscription token
router.post('/calendar/token/regenerate', requireAuth, async (req, res) => {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }

    const calendarToken = randomBytes(32).toString('hex');
    await storage.updateUser(userId, { calendarToken });

    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    const webcalUrl = `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/${API_VERSION}/calendar/${calendarToken}/feed.ics`;
    const httpsUrl = `${baseUrl}/api/${API_VERSION}/calendar/${calendarToken}/feed.ics`;

    res.json({ 
      calendarToken,
      webcalUrl,
      httpsUrl
    });
  } catch (error) {
    console.error('Error regenerating calendar token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Calendar subscription feed (public endpoint with token auth)
router.get('/calendar/:calendarToken/feed.ics', async (req, res) => {
  try {
    const { calendarToken } = req.params;
    
    const user = await storage.getUserByCalendarToken(calendarToken);
    if (!user) {
      return res.status(404).json({ error: 'Invalid calendar token' });
    }

    const participations = await storage.getUserParticipations(user.id, user.email);
    const calendarSettings = await storage.getCalendarSettings();
    
    const { getBaseUrl } = await import('../utils/baseUrl');
    const baseUrl = getBaseUrl();
    
    const language = (user.languagePreference as 'de' | 'en') || 'de';
    
    const icsContent = icsService.generateUserCalendarFeed(
      participations,
      user.name,
      baseUrl,
      {
        settings: calendarSettings,
        language,
      }
    );
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(icsContent);
  } catch (error) {
    console.error('Error generating calendar feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
