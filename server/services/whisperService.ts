import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

const SUPPORTED_FORMATS = [
  "audio/wav", "audio/x-wav", "audio/wave",
  "audio/mp3", "audio/mpeg", "audio/mp4", "audio/flac",
];
const NEEDS_CONVERSION = ["audio/webm", "audio/ogg"];

const HALLUCINATIONS = [
  "vielen dank fürs zuschauen",
  "vielen dank für's zuschauen",
  "danke fürs zuschauen",
  "bis zum nächsten mal",
  "thank you for watching",
  "thanks for watching",
  "...",
  "…",
];

interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  duration?: number;
  language?: string;
}

interface WhisperApiResponse {
  text: string;
  language?: string;
}

function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
  };
  return map[mimeType] || "webm";
}

async function convertToMp3(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const baseMimeType = mimeType.split(";")[0].trim();
  if (SUPPORTED_FORMATS.includes(baseMimeType)) {
    return { buffer: audioBuffer, mimeType };
  }

  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tmpDir, `polly_input_${timestamp}.webm`);
  const outputPath = path.join(tmpDir, `polly_output_${timestamp}.mp3`);

  try {
    await fs.promises.writeFile(inputPath, audioBuffer);
    await execAsync(
      `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -b:a 64k "${outputPath}" 2>/dev/null`
    );
    const mp3Buffer = await fs.promises.readFile(outputPath);
    console.log(
      `[Whisper] Converted ${mimeType} (${audioBuffer.length} bytes) → MP3 (${mp3Buffer.length} bytes)`
    );
    return { buffer: mp3Buffer, mimeType: "audio/mpeg" };
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(outputPath).catch(() => {});
  }
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = "audio/webm",
  languageOverride?: string
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  if (audioBuffer.length < 1024) {
    return { success: true, text: "", duration: 0, language: "de" };
  }

  const { getAiSettings, getEffectiveApiKey, getEffectiveApiUrl } = await import("./aiService");
  const whisperSettings = await getAiSettings();
  const apiUrl = getEffectiveApiUrl(whisperSettings);
  const apiKey = getEffectiveApiKey(whisperSettings);
  const apiKeyFallback = process.env.AI_API_KEY_FALLBACK || whisperSettings.apiKeyFallback || "";

  if (!apiKey) {
    return { success: false, error: "API nicht konfiguriert" };
  }

  const transcriptionUrl = `${apiUrl}/audio/transcriptions`;

  let processedBuffer = audioBuffer;
  let processedMimeType = mimeType;

  const baseMimeType = mimeType.split(";")[0].trim();
  if (NEEDS_CONVERSION.includes(baseMimeType)) {
    try {
      const converted = await convertToMp3(audioBuffer, mimeType);
      processedBuffer = converted.buffer;
      processedMimeType = converted.mimeType;
    } catch (conversionError) {
      console.error("[Whisper] Audio conversion failed:", conversionError);
      return { success: false, error: "Audio-Konvertierung fehlgeschlagen." };
    }
  }

  const extension = getExtensionFromMimeType(processedMimeType);
  const filename = `audio.${extension}`;
  const language = languageOverride || "de";

  function buildFormData(buf: Buffer, mime: string): FormData {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buf)], { type: mime });
    formData.append("file", blob, filename);
    formData.append("model", "whisper-large-v2");
    formData.append("language", language);
    formData.append("response_format", "json");
    return formData;
  }

  try {
    let response = await fetch(transcriptionUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: buildFormData(processedBuffer, processedMimeType),
    });

    if (response.status === 429 && apiKeyFallback) {
      console.log("[Whisper] Rate limit hit, retrying with fallback key...");
      response = await fetch(transcriptionUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKeyFallback}` },
        body: buildFormData(processedBuffer, processedMimeType),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Whisper] API Error:", response.status, errorText);
      return {
        success: false,
        error: `Transkription fehlgeschlagen (${response.status})`,
      };
    }

    const result: WhisperApiResponse = await response.json();
    const duration = Date.now() - startTime;
    const transcribedText = result.text?.trim() || "";

    const lowerText = transcribedText.toLowerCase();
    const isHallucination =
      HALLUCINATIONS.some((h) => lowerText.includes(h)) ||
      transcribedText.length < 2;

    if (isHallucination) {
      console.log("[Whisper] Hallucination filtered:", transcribedText);
      return { success: true, text: "", duration, language: result.language || "de" };
    }

    console.log(`[Whisper] Transcribed in ${duration}ms: "${transcribedText.substring(0, 80)}..."`);
    return {
      success: true,
      text: transcribedText,
      duration,
      language: result.language || "de",
    };
  } catch (error) {
    console.error("[Whisper] Transcription error:", error);
    return { success: false, error: "Spracherkennung fehlgeschlagen." };
  }
}

const MAX_CHUNK_SIZE_MB = 20;
const CHUNK_DURATION_SECONDS = 150;

export async function transcribeLargeFile(
  audioBuffer: Buffer,
  mimeType: string,
  languageOverride?: string
): Promise<TranscriptionResult> {
  const fileSizeMB = audioBuffer.length / (1024 * 1024);

  if (fileSizeMB <= MAX_CHUNK_SIZE_MB) {
    return transcribeAudio(audioBuffer, mimeType, languageOverride);
  }

  console.log(`[Whisper] Large file (${fileSizeMB.toFixed(1)} MB), splitting into chunks...`);
  const tempDir = path.join(os.tmpdir(), `polly_whisper_${Date.now()}`);

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });

    const ext = getExtensionFromMimeType(mimeType.split(";")[0].trim());
    const inputPath = path.join(tempDir, `input.${ext}`);
    const outputPattern = path.join(tempDir, `chunk_%03d.${ext}`);

    await fs.promises.writeFile(inputPath, audioBuffer);
    await execAsync(
      `ffmpeg -i "${inputPath}" -f segment -segment_time ${CHUNK_DURATION_SECONDS} -c copy "${outputPattern}" -y`,
      { timeout: 300000 }
    );

    const chunkFiles: string[] = [];
    for (let i = 0; i < 100; i++) {
      const p = path.join(tempDir, `chunk_${String(i).padStart(3, "0")}.${ext}`);
      if (fs.existsSync(p)) chunkFiles.push(p);
      else break;
    }

    if (chunkFiles.length === 0) {
      return transcribeAudio(audioBuffer, mimeType, languageOverride);
    }

    const texts: string[] = [];
    for (let i = 0; i < chunkFiles.length; i++) {
      console.log(`[Whisper] Transcribing chunk ${i + 1}/${chunkFiles.length}...`);
      const chunkBuffer = await fs.promises.readFile(chunkFiles[i]);
      const result = await transcribeAudio(chunkBuffer, mimeType, languageOverride);
      if (result.success && result.text) texts.push(result.text);
    }

    return {
      success: true,
      text: texts.join(" ").trim(),
      language: languageOverride || "de",
    };
  } catch (error) {
    console.error("[Whisper] Chunk transcription error:", error);
    return { success: false, error: "Verarbeitung der großen Datei fehlgeschlagen." };
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        const files = await fs.promises.readdir(tempDir);
        for (const f of files) {
          await fs.promises.unlink(path.join(tempDir, f)).catch(() => {});
        }
        await fs.promises.rmdir(tempDir).catch(() => {});
      }
    } catch {}
  }
}
