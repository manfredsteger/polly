import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

export const testMeta = {
  category: 'ui' as const,
  name: 'Spracheingabe-Konsistenz',
  description: 'Prüft ob beide Spracheingabe-Eingabepunkte (Startseite + Nachfragen) konsistent implementiert sind und visuelles Feedback gewährleistet ist',
  severity: 'high' as const,
};

const CLIENT_SRC = path.resolve(__dirname, '../../../client/src');
const AI_DIR = path.join(CLIENT_SRC, 'components/ai');

function readFile(name: string): string {
  const filePath = path.join(AI_DIR, name);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf-8');
}

describe('Voice Input Consistency', () => {
  const widgetCode = readFile('AiChatWidget.tsx');
  const overlayCode = readFile('VoiceRecordingOverlay.tsx');

  describe('VoiceRecordingOverlay – visual feedback', () => {
    it('should have a canvas element for waveform visualization', () => {
      expect(overlayCode).toContain('canvasRef');
      expect(overlayCode).toContain('<canvas');
    });

    it('should have a fallback animation when waveform is unavailable', () => {
      expect(overlayCode).toMatch(/showFallbackAnimation|fallback.*anim/i);
      expect(overlayCode).toContain('voiceBar');
    });

    it('should resume AudioContext to handle browser autoplay policy', () => {
      expect(overlayCode).toMatch(/audioContext\.resume\s*\(\s*\)/);
    });

    it('should check for suspended AudioContext state', () => {
      expect(overlayCode).toMatch(/state\s*===\s*['"]suspended['"]/);
    });

    it('should have a REC indicator visible during recording', () => {
      expect(overlayCode).toContain('REC');
      expect(overlayCode).toMatch(/bg-red-\d+/);
      expect(overlayCode).toContain('animate-pulse');
    });

    it('should show different states for listening vs transcribing', () => {
      expect(overlayCode).toContain('isTranscribing');
      expect(overlayCode).toContain('isListening');
      expect(overlayCode).toMatch(/aiListening/);
      expect(overlayCode).toMatch(/aiTranscribing/);
    });

    it('should show a loading spinner during transcription', () => {
      expect(overlayCode).toContain('Loader2');
      expect(overlayCode).toContain('animate-spin');
    });

    it('should have an AnalyserNode for audio data', () => {
      expect(overlayCode).toContain('createAnalyser');
      expect(overlayCode).toContain('fftSize');
      expect(overlayCode).toContain('getByteTimeDomainData');
    });

    it('should clean up AudioContext on unmount', () => {
      expect(overlayCode).toMatch(/audioContext(Ref)?\.current\.close\(\)/);
    });
  });

  describe('AiChatWidget – main voice input (Startseite)', () => {
    it('should have a microphone button with Mic icon', () => {
      expect(widgetCode).toContain('voiceTargetRef.current = "main"');
      expect(widgetCode).toContain('toggleListening');
      expect(widgetCode).toContain('<Mic');
    });

    it('should disable mic button while transcribing or submitting', () => {
      expect(widgetCode).toMatch(/disabled=\{isTranscribing\s*\|\|\s*mutation\.isPending\}/);
    });

    it('should show active state with animate-pulse when listening', () => {
      const startIdx = widgetCode.indexOf('voiceTargetRef.current = "main"');
      const endIdx = widgetCode.indexOf('</button>', startIdx) + 20;
      const mainButtonSection = widgetCode.substring(startIdx, endIdx);
      expect(mainButtonSection).toContain('animate-pulse');
    });

    it('should show Loader2 spinner when transcribing', () => {
      const startIdx = widgetCode.indexOf('voiceTargetRef.current = "main"');
      const endIdx = widgetCode.indexOf('</button>', startIdx) + 20;
      const mainButtonSection = widgetCode.substring(startIdx, endIdx);
      expect(mainButtonSection).toContain('Loader2');
    });

    it('should use aiMicTooltip i18n key', () => {
      expect(widgetCode).toContain('t("home.aiMicTooltip")');
    });
  });

  describe('AiChatWidget – follow-up voice input (Nachfragen)', () => {
    it('should have a microphone button with Mic icon for follow-up', () => {
      expect(widgetCode).toContain('toggleFollowUpListening');
      const followUpSection = widgetCode.substring(widgetCode.indexOf('toggleFollowUpListening'));
      expect(followUpSection).toContain('<Mic');
    });

    it('should disable mic button while transcribing or refining', () => {
      expect(widgetCode).toMatch(/disabled=\{isTranscribing\s*\|\|\s*isRefining\}/);
    });

    it('should show active state with animate-pulse when listening in follow-up mode', () => {
      const followUpButtonIdx = widgetCode.indexOf('toggleFollowUpListening');
      const followUpSection = widgetCode.substring(
        followUpButtonIdx,
        widgetCode.indexOf('</button>', followUpButtonIdx + 100) + 20
      );
      expect(followUpSection).toContain('animate-pulse');
    });

    it('should show Loader2 spinner when transcribing in follow-up mode', () => {
      const followUpButtonIdx = widgetCode.indexOf('onClick={toggleFollowUpListening}');
      const followUpSection = widgetCode.substring(
        followUpButtonIdx,
        widgetCode.indexOf('</button>', followUpButtonIdx + 100) + 20
      );
      expect(followUpSection).toContain('Loader2');
    });

    it('should set voiceTargetRef to followup in toggleFollowUpListening', () => {
      expect(widgetCode).toMatch(/voiceTargetRef\.current\s*=\s*["']followup["']/);
    });

    it('should use same aiMicTooltip i18n key as main', () => {
      const followUpSection = widgetCode.substring(widgetCode.indexOf('toggleFollowUpListening'));
      expect(followUpSection).toContain('aiMicTooltip');
    });
  });

  describe('State transition safety (no overlay flicker)', () => {
    it('should NOT set isListening(false) directly in stopRecording', () => {
      const stopRecordingMatch = widgetCode.match(/const stopRecording\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[/);
      expect(stopRecordingMatch).toBeTruthy();
      const stopBody = stopRecordingMatch![1];
      const directSetFalse = stopBody.match(/setIsListening\(false\)/g) || [];
      const hasElseFallback = stopBody.includes('else');
      if (directSetFalse.length > 0) {
        expect(hasElseFallback).toBe(true);
      }
    });

    it('should set isTranscribing(true) BEFORE isListening(false) in onstop handler', () => {
      const onstopMatch = widgetCode.match(/mediaRecorder\.onstop\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\};/);
      expect(onstopMatch).toBeTruthy();
      const onstopBody = onstopMatch![1];
      const transcribingIdx = onstopBody.indexOf('setIsTranscribing(true)');
      const listeningIdx = onstopBody.indexOf('setIsListening(false)');
      expect(transcribingIdx).toBeGreaterThan(-1);
      expect(listeningIdx).toBeGreaterThan(-1);
      expect(transcribingIdx).toBeLessThan(listeningIdx);
    });

    it('should keep VoiceRecordingOverlay visible during both listening and transcribing', () => {
      expect(widgetCode).toMatch(/isVisible=\{isListening\s*\|\|\s*isTranscribing\}/);
    });

    it('should pass audioStream to VoiceRecordingOverlay', () => {
      expect(widgetCode).toMatch(/audioStream=\{audioStream\}/);
    });

    it('should pass isTranscribing and isListening to VoiceRecordingOverlay', () => {
      expect(widgetCode).toMatch(/isTranscribing=\{isTranscribing\}/);
      expect(widgetCode).toMatch(/isListening=\{isListening\}/);
    });
  });

  describe('Shared recording infrastructure', () => {
    it('should use MediaRecorder API for both modes', () => {
      expect(widgetCode).toContain('new MediaRecorder');
      expect(widgetCode).toContain('mediaRecorder.start');
    });

    it('should use same transcribeVoice function for both targets', () => {
      expect(widgetCode).toMatch(/const target = activeRecordingTargetRef\.current/);
      const setters = widgetCode.match(/target === ["']followup["']\s*\?\s*setFollowUpValue\s*:\s*setInputValue/);
      expect(setters).toBeTruthy();
    });

    it('should clean up media stream tracks on stop', () => {
      expect(widgetCode).toMatch(/getTracks\(\)\.forEach.*track\.stop/);
    });

    it('should handle audio/webm and fallback mime types', () => {
      expect(widgetCode).toContain('audio/webm;codecs=opus');
      expect(widgetCode).toContain('audio/webm');
      expect(widgetCode).toContain('audio/mp4');
    });

    it('should use same VoiceRecordingOverlay component for both modes', () => {
      const overlayInstances = widgetCode.match(/<VoiceRecordingOverlay/g);
      expect(overlayInstances).toHaveLength(1);
    });
  });
});
