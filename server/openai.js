/* ============================================================
   OpenAI API 래퍼 — vision 판정 / 텍스트 교정 (structured outputs),
   Whisper 음성 인식, 임베딩. 동시 호출 제한 포함.
   ============================================================ */
import OpenAI from "openai";
import fs from "fs";

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5-mini";
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

let _client = null;
export function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다 (.env 파일을 확인하세요)");
  }
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

/* ---- 동시 호출 제한 (전역 세마포어) ---- */
const MAX_CONCURRENT = 4;
let active = 0;
const queue = [];
async function withLimit(fn) {
  if (active >= MAX_CONCURRENT) await new Promise((r) => queue.push(r));
  active++;
  try { return await fn(); }
  finally { active--; queue.shift()?.(); }
}

// gpt-5 / o 계열은 reasoning_effort 지원, temperature 미지원
function isReasoningModel(model) {
  return /^(gpt-5|o\d)/.test(model);
}

async function chatJSON({ model, system, userContent, schemaName, schema, effort = "low", maxTokens = 4096 }) {
  return withLimit(async () => {
    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      max_completion_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
    };
    if (isReasoningModel(model)) body.reasoning_effort = effort;
    const res = await client().chat.completions.create(body);
    const msg = res.choices[0]?.message;
    if (!msg?.content) throw new Error(`OpenAI 응답이 비어 있습니다 (finish: ${res.choices[0]?.finish_reason})`);
    return JSON.parse(msg.content);
  });
}

function imagePart(filePath) {
  const b64 = fs.readFileSync(filePath).toString("base64");
  return { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "low" } };
}

/* ---- 이미지 + 텍스트 → 구조화 JSON ---- */
export function visionJSON({ system, text, imagePaths, schemaName, schema, effort, maxTokens }) {
  const userContent = [
    { type: "text", text },
    ...imagePaths.map(imagePart),
  ];
  return chatJSON({ model: VISION_MODEL, system, userContent, schemaName, schema, effort, maxTokens });
}

/* ---- 텍스트 → 구조화 JSON ---- */
export function textJSON({ system, text, schemaName, schema, effort, maxTokens }) {
  return chatJSON({ model: TEXT_MODEL, system, userContent: text, schemaName, schema, effort, maxTokens });
}

/* ---- 임베딩 ---- */
export async function embed(texts) {
  return withLimit(async () => {
    const res = await client().embeddings.create({ model: EMBEDDING_MODEL, input: texts });
    return res.data.map((d) => Float32Array.from(d.embedding));
  });
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
