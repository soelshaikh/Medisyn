import { logger } from "@/common/utils/logger";

/* Lazy import — playwright-core is an optional heavy dep; only loaded when first used */
let _browser: import("playwright").Browser | null = null;

async function getBrowser(): Promise<import("playwright").Browser> {
  if (_browser && _browser.isConnected()) return _browser;

  const { chromium } = await import("playwright");
  _browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  _browser.on("disconnected", () => {
    _browser = null;
    logger.warn("[PlaywrightPdf] browser disconnected — will relaunch on next request");
  });

  return _browser;
}

/**
 * Renders HTML to a PDF buffer using a headless Chromium page.
 * Returns the raw Buffer suitable for streaming as application/pdf.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page    = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({
      format:          "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close().catch(() => null);
  }
}

/** Call on graceful shutdown to close the browser process. */
export async function closePdfBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => null);
    _browser = null;
  }
}
