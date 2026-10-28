import type { Config, Context } from "@netlify/functions";

/**
 * POST /api/scan-inventory
 * Body: { image: base64 (no data: prefix), mimeType: string, catalog: string[] }
 * Returns: { items: [{ name, catalogName, qty, kind, confidence }], model }
 *
 * The Gemini key lives only in the Netlify env var GEMINI_API_KEY
 * (scope must include "Functions"). It is never sent to the browser.
 */

// Tried in order; the first one that exists for this key wins.
// Override with env var GEMINI_MODEL if Google renames/retires models.
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];

const buildPrompt = (catalog: string[]) => `You are counting inventory for Brasão, a Brazilian steakhouse wine cellar and bar.

The photo can be ONE of these (or a mix):
A) A handwritten or printed inventory sheet / count sheet.
B) A photo of actual bottles (on a shelf, in a rack, on a table, behind the bar).

What to do:
- For sheets: read every line that has a product and a quantity. Wine lines often start with a 4-digit bin number (e.g. "1207 Caymus"). Read numbers carefully; fractions like 1/2, ½, .5, 3/4 mean 0.5, 0.75.
- For bottle photos: identify each distinct product from its label (producer, wine/spirit name, varietal). Count how many bottles of each product are visible. For OPENED liquor/spirit bottles, estimate the remaining fill level to the nearest 0.25 (a full sealed bottle = 1). Add up bottles of the same product into one line (e.g. two full + one half = 2.5).
- Never invent products that are not clearly visible. If you cannot read a label, skip it.

Matching (very important): match every product to this catalog. Each catalog line is "Name | Category". If a product clearly matches, set "catalogName" to the EXACT catalog Name (only the part before " | "). If nothing matches, set "catalogName" to "".
CATALOG:
${catalog.join("\n")}

Return ONLY JSON matching the schema. "name" is what you read/recognized in the photo. "kind" is "sheet" or "bottle". "confidence" is 0-1.`;

const responseSchema = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          catalogName: { type: "STRING" },
          qty: { type: "NUMBER" },
          kind: { type: "STRING", enum: ["sheet", "bottle"] },
          confidence: { type: "NUMBER" },
        },
        required: ["name", "catalogName", "qty", "kind", "confidence"],
      },
    },
  },
  required: ["items"],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json(
      { error: "GEMINI_API_KEY is not set in Netlify (Project configuration → Environment variables, scope Functions)." },
      500
    );
  }

  let body: { image?: string; mimeType?: string; catalog?: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { image, mimeType = "image/jpeg", catalog = [] } = body;
  if (!image || typeof image !== "string") return json({ error: "Missing image" }, 400);
  if (image.length > 5_500_000) return json({ error: "Image too large" }, 413);
  if (!Array.isArray(catalog) || catalog.length > 3000) return json({ error: "Invalid catalog" }, 400);

  const envModel = Netlify.env.get("GEMINI_MODEL");
  const models = envModel ? [envModel, ...DEFAULT_MODELS] : DEFAULT_MODELS;

  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: image } },
          { text: buildPrompt(catalog.map(String)) },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  };

  let lastError = "Unknown error";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
      }
    );

    if (res.status === 404) {
      lastError = `Model ${model} not available`;
      continue; // try the next model
    }

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastError = data?.error?.message || `Gemini error ${res.status}`;
      // Bad key / quota won't be fixed by another model
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) break;
      continue;
    }

    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      return json({ items: Array.isArray(items) ? items : [], model });
    } catch {
      lastError = "The AI returned an invalid response";
    }
  }

  return json({ error: lastError }, 502);
};

export const config: Config = {
  path: "/api/scan-inventory",
  method: "POST",
};
