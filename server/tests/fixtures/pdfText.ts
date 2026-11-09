import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ExtractedPdfText {
  /** Text of each page, items joined by single spaces. */
  pages: string[];
  /** All pages joined, with whitespace collapsed for robust substring checks. */
  text: string;
}

/**
 * Extracts the visible text layer of a PDF so tests can assert what a reader
 * would actually find in the exported document (titles, options, results).
 */
export async function extractPdfText(pdf: Buffer): Promise<ExtractedPdfText> {
  const loadingTask = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const document = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pages.push(normalizeWhitespace(pageText));
    }
    return { pages, text: normalizeWhitespace(pages.join(' ')) };
  } finally {
    await loadingTask.destroy();
  }
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export interface ExtractedPdfLines {
  /** Page count reported by the PDF's page tree. */
  pageCount: number;
  /** Non-empty text items of each page, trimmed, in content-stream order. */
  pages: string[][];
}

/**
 * Extracts each page's text items individually, preserving drawing order, so
 * tests can check where content lands (which page, which order, which table
 * row) rather than only whether it exists somewhere in the document.
 *
 * Chromium draws one text item per wrapped line or table cell, so assertions
 * should target short labels that do not wrap. Elements painted as
 * transparency groups (e.g. CSS opacity) are drawn at the end of their page.
 */
export async function extractPdfLines(pdf: Buffer): Promise<ExtractedPdfLines> {
  const loadingTask = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const document = await loadingTask.promise;
  try {
    const pages: string[][] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ('str' in item ? item.str.trim() : ''))
          .filter((text) => text.length > 0)
      );
    }
    return { pageCount: document.numPages, pages };
  } finally {
    await loadingTask.destroy();
  }
}
