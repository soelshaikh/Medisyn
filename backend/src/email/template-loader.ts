import path from 'path';
import fs from 'fs/promises';
import Handlebars from 'handlebars';

const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

// Cache compiled templates to avoid repeated disk reads
const subjectCache = new Map<string, HandlebarsTemplateDelegate>();
const bodyCache    = new Map<string, HandlebarsTemplateDelegate>();
let partialsRegistered = false;

async function registerPartials(): Promise<void> {
  if (partialsRegistered) return;

  const partialsDir = path.join(TEMPLATES_DIR, 'partials');
  let entries: string[];
  try {
    entries = await fs.readdir(partialsDir);
  } catch {
    partialsRegistered = true;
    return;
  }

  await Promise.all(
    entries
      .filter((f) => f.endsWith('.hbs'))
      .map(async (f) => {
        const name = path.basename(f, '.hbs');
        const src  = await fs.readFile(path.join(partialsDir, f), 'utf8');
        Handlebars.registerPartial(name, src);
      }),
  );

  partialsRegistered = true;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export async function renderTemplate(
  templateName: string,
  data: Record<string, unknown>,
): Promise<RenderedEmail> {
  await registerPartials();

  const templateDir = path.join(TEMPLATES_DIR, templateName);

  // ── subject ──────────────────────────────────────────────────────────────
  let subjectFn = subjectCache.get(templateName);
  if (!subjectFn) {
    const subjectSrc = await fs.readFile(
      path.join(templateDir, 'subject.txt'),
      'utf8',
    ).catch(() => {
      throw new Error(`Email template '${templateName}': subject.txt not found`);
    });
    subjectFn = Handlebars.compile(subjectSrc.trim(), { strict: true });
    subjectCache.set(templateName, subjectFn);
  }

  // ── body ─────────────────────────────────────────────────────────────────
  let bodyFn = bodyCache.get(templateName);
  if (!bodyFn) {
    const bodySrc = await fs.readFile(
      path.join(templateDir, 'body.hbs'),
      'utf8',
    ).catch(() => {
      throw new Error(`Email template '${templateName}': body.hbs not found`);
    });
    bodyFn = Handlebars.compile(bodySrc, { strict: true });
    bodyCache.set(templateName, bodyFn);
  }

  return {
    subject: subjectFn(data),
    html:    bodyFn(data),
  };
}

/** Clear caches — used in tests or when templates are hot-reloaded in dev. */
export function clearTemplateCache(): void {
  subjectCache.clear();
  bodyCache.clear();
  partialsRegistered = false;
  Handlebars.unregisterPartial('header');
  Handlebars.unregisterPartial('footer');
}
