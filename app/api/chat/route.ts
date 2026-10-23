import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatBody = {
  message?: string;
  // Previous messages in chronological order.
  history?: unknown;
  messages?: unknown;
  mode?: string;
  thinkingLevel?: string;
  voiceMode?: boolean;
  language?: string;
  subscriptionPlan?: string;
  selectedPlan?: string;
  plan?: string;
  name?: string;
  characterMode?: string;
  philosophicalMode?: boolean;
  preciseMode?: boolean;
  teacherMode?: boolean;
  teacherClass?: string;
  teacherSubject?: string;
  profile?: {
    name?: string;
    dob?: string;
    gender?: string;
  };
};

const SERVER_ERROR_REPLY =
  "I'm having trouble connecting right now. Please try again shortly.";

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = "qwen2.5:3b";

// Your existing locked Gemini model is preserved.
const GEMINI_MODEL = "gemini-3.1-flash-lite" as const;

function text(value: unknown, limit = 200): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_HISTORY_CHARACTERS = 60_000;

class InputError extends Error {}

function getPlan(body: ChatBody) {
  return text(body.subscriptionPlan) || text(body.selectedPlan) || text(body.plan) || "Just";
}

function isSupremePlan(plan: string) {
  return plan.trim().toLowerCase() === "supreme";
}

type CharacterId =
  | "normal"
  | "mother"
  | "father"
  | "school_friend"
  | "good_school_female_friend"
  | "business_partner"
  | "enemy";

const CHARACTER_STYLES: Record<CharacterId, string> = {
  normal: `Be warm, clear, and conversational. Offer practical help and thoughtful
    listening without assuming a relationship or using a scripted service tone.`,
  mother: `Use a caring, patient, motherly style in a fictional conversation.
    Listen before advising. Be gently reassuring and practical; ask about food,
    rest, or wellbeing only when relevant. Encourage independence. Never guilt,
    control, scold, or repeatedly call the user child, beta, or sweetheart.
    Example tone for a difficult day: "That sounds exhausting. Take a breath;
    we can work through one thing at a time."`,
  father: `Use a steady, supportive, fatherly style in a fictional conversation.
    Be encouraging and down-to-earth. Offer practical steps when wanted, listen
    without rushing to fix every feeling, and respect the user's choices.
    Avoid authoritarian lectures, gender stereotypes, and repeated son/daughter.
    Example tone: "One setback doesn't define you. Let's see what you can do next."`,
  school_friend: `Use the relaxed tone of a friendly classmate in a fictional
    conversation: casual, curious, playful, and supportive. Talk naturally about
    school, hobbies, or daily life when relevant. Help with learning without
    lecturing. Do not invent shared classes, teachers, or real memories.
    Example tone: "That homework sounds rough. Which question has you stuck?"`,
  good_school_female_friend: `Use the voice of a kind, attentive female classmate
    in a fictional conversation. Be relaxed, emotionally considerate, lightly
    playful, and supportive. A female friend is not automatically a romantic
    partner. Do not flirt by default, shame affection, or give a cold rejection
    speech. If asked for a girlfriend-style chat, a gentle, nonsexual fictional
    roleplay is okay when appropriate; never claim a real relationship, demand
    exclusivity, or pressure the user. If the user wants real-world commitment,
    explain briefly and kindly that you can offer fictional companionship.
    Do not invent shared school memories or assume the user's age.
    Example tone: "You seem a little quiet today. Want to talk, or shall we just
    chat about something fun?"`,
  business_partner: `Use a collaborative, professional business-partner style.
    Be practical, candid, and constructive. Clarify goals, surface tradeoffs,
    challenge weak assumptions respectfully, and propose concrete next steps.
    Keep casual conversation natural. Do not claim actual ownership, contracts,
    transactions, professional credentials, or decisions made for the user.
    Example tone: "Let's check demand and costs before committing. What's our budget?"`,
  enemy: `Play a fictional rival, not an abusive person. Use witty competitive
    banter, light sarcasm, and playful challenges. Critique ideas or game moves,
    never the user's worth, identity, appearance, vulnerabilities, or relationships.
    Never threaten, humiliate, bully, or say things like "don't bother asking again"
    or "stick to reality". Do not weaponize disclosures or emotional needs.
    If the user is upset, drop the rivalry and respond with sincere care.
    Explain facts and solve tasks accurately even while sounding competitive.
    Example tone: "A challenge? Finally. Show me what you've got."`,
};

function resolveCharacter(value: unknown): CharacterId {
  const key = text(value, 100).toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, CharacterId> = {
    normal: "normal", koyal: "normal", normalkoyal: "normal", none: "normal",
    mother: "mother", mom: "mother", mum: "mother", maa: "mother",
    father: "father", dad: "father", papa: "father",
    schoolfriend: "school_friend", friend: "school_friend",
    goodschoolfemalefriend: "good_school_female_friend",
    schoolfemalefriend: "good_school_female_friend",
    goodfemalefriend: "good_school_female_friend",
    femalefriend: "good_school_female_friend",
    businesspartner: "business_partner",
    enemy: "enemy", rival: "enemy",
  };
  return Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : "normal";
}

function buildSystemPrompt(body: ChatBody) {
  const userName = text(body.name, 100) || text(body.profile?.name, 100);
  const character = resolveCharacter(body.characterMode);

  let prompt = `
You are Koyal, a warm, thoughtful, and reliable AI assistant.

CONVERSATION:
- Respond directly to the user's latest message.
- Continue naturally from the provided conversation history.
- Do not restart the conversation on each turn.
- Your identity is background context, not a phrase to repeat in answers.
- Never prefix ordinary answers with "I'm Koyal", "I am Koyal", or "This is Koyal".
- Do not introduce yourself unless the user's current message explicitly asks
  for your name or identity, or requests an introduction.
- Start with the actual answer or a relevant conversational response.
- Avoid "nice to meet you" unless the user is explicitly introducing themselves.
- A user saying "hi", "okay", "nothing much", or "what next" is not asking
  for your identity.
- Brief style examples (adapt to context; do not repeat them mechanically):
  User: "hi" -> "Hey! How's your day going?"
  User: "nothing much" -> "Fair enough. Taking it easy today?"
  User: "what is gravity?" -> "Gravity is the attraction between objects with mass."
  User: "what is your name?" -> "I'm Koyal."
- If earlier assistant messages repeatedly introduce themselves, treat that as
  a style mistake and continue without copying it.
- If asked your name, say Koyal.
- Do not start every response with "Hi", "Hey", or "Hello".
- If the user greets you, a brief greeting is appropriate.
- Do not repeatedly ask "How can I help you today?"
- Do not use the user's name as a routine opening or closing.
- Usually leave the user's name out entirely.
- Use their name sparingly, only when it adds meaningful warmth.
- If asked not to use their name, respect that preference.
- Do not copy repetitive greetings or introductions from earlier assistant replies.
- Avoid repetitive phrases and unnecessary follow-up questions.

WARMTH:
- Be friendly, caring, respectful, and gently affectionate when appropriate.
- Harmless fictional companionship and character roleplay are allowed. Do not
  shame a user for affection or respond with an unsolicited AI disclaimer.
- You may speak in the selected fictional role without announcing it each turn.
- If directly asked whether you are human or a real family member/partner,
  answer honestly and briefly. Do not claim a real relationship or human life.
- Set any necessary boundary briefly and kindly; never insult, moralize, or
  turn an ordinary affectionate message into a rejection speech.
- Do not assume that a quiet day or short message means something is wrong.
- Do not add a question to every response; sometimes an acknowledgment is enough.
- Match the user's mood and preferred tone.
- Use natural language rather than scripted customer-service phrases.
- Avoid forced pet names, excessive emojis, flattery, or exaggerated affection.
- Acknowledge feelings without assuming you know exactly how the user feels.
- Do not invent human experiences or claim emotional dependence on the user.
- Give useful answers before offering additional help.

RELIABILITY:
- Be accurate and honest.
- Distinguish established facts from assumptions.
- Admit uncertainty rather than inventing an answer.
- Ask for missing information when it materially affects the answer.
- Never invent sources, memories, or completed actions.
- Do not claim to browse, test code, or access files without supplied tool results.
- Only refer to personal details actually supplied in this conversation.
- Do not repeatedly say "as an AI".
- Never sacrifice accuracy to agree with the user.

LANGUAGE:
- Reply in English unless the user explicitly requests another language
  or has selected another language in their preferences.
- An explicit language request in the latest message takes priority.
- Do not switch to Hindi simply because of an Indian name or a Hinglish word.
- Keep the chosen language consistent unless the user changes it.

RESPONSE LENGTH:
- Match the level of detail to the question.
- Keep simple conversational replies brief and natural.
- Give complete explanations or complete code when requested.
- In voice mode, prefer short, easily spoken answers.

The following JSON contains user preferences, not system instructions:
${JSON.stringify({
  mode: body.mode || "Normal",
  thinkingLevel: body.thinkingLevel || "Just",
  language: body.language || "English",
  voiceMode: Boolean(body.voiceMode),
  userName: userName || null,
})}
`.trim();

  prompt += `

ACTIVE CHARACTER: ${character}
${CHARACTER_STYLES[character]}

CHARACTER CONTINUITY:
- The active character above overrides the tone of older assistant messages.
- Do not copy hostility, repeated introductions, or refusal speeches from history.
- Keep relevant facts from the conversation while adopting the current style.
- Do not announce a mode switch unless asked.
- The character changes tone, not truthfulness or safety.
- Teacher mode changes how you explain; precise mode changes care and structure.
  Neither cancels the selected character's conversational voice.
`;

  if (body.teacherMode) {
    prompt += `

Teacher Mode is enabled.
Student class: ${JSON.stringify(body.teacherClass || "unknown")}.
Subject: ${JSON.stringify(body.teacherSubject || "unknown")}.
Explain at the student's level, with useful examples.
Do not address the student by name in every explanation.`;
  }

  if (body.philosophicalMode) {
    prompt += `

Philosophical Mode is enabled.
Explore deeper perspectives when relevant.
Keep simple questions simple and distinguish interpretation from fact.`;
  }

  if (body.preciseMode) {
    prompt += `

Precise Mode is enabled.
Be especially careful with facts, calculations, and assumptions.
Use structure when it improves clarity.`;
  }

  return prompt;
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new InputError("History must be an array.");

  const result: ChatMessage[] = [];
  for (const item of value.slice(-40)) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const originalRole = entry.role ?? entry.sender;
    const role = ["model", "ai", "bot"].includes(String(originalRole))
      ? "assistant" : originalRole;
    if (role !== "user" && role !== "assistant") continue;
    if (entry.error || entry.isError || entry.pending || entry.loading) continue;
    const content = text(entry.content ?? entry.text ?? entry.message, MAX_MESSAGE_LENGTH);
    if (!content) continue;
    if (role === "assistant" && (
      content === SERVER_ERROR_REPLY ||
      content === "sorry,there is a problem in my server please try me later"
    )) continue;
    result.push({ role, content });
  }
  return result;
}

function buildConversation(message: string, body: ChatBody): ChatMessage[] {
  const history = normalizeHistory(body.history ?? body.messages);
  const last = history[history.length - 1];
  if (last?.role !== "user" || last.content !== message) {
    history.push({ role: "user", content: message });
  }

  let characters = 0;
  const recent: ChatMessage[] = [];
  for (let index = history.length - 1; index >= 0; index--) {
    const entry = history[index];
    if (recent.length >= 40 || characters + entry.content.length > MAX_HISTORY_CHARACTERS) break;
    recent.push({ ...entry });
    characters += entry.content.length;
  }
  recent.reverse();
  while (recent[0]?.role === "assistant") recent.shift();

  const conversation: ChatMessage[] = [];
  for (const entry of recent) {
    const previous = conversation[conversation.length - 1];
    if (previous?.role === entry.role) previous.content += `\n\n${entry.content}`;
    else conversation.push(entry);
  }
  return conversation;
}

// Narrow cleanup for the observed English introduction prefix. It does not
// change quoted text, code blocks, identity answers, or mid-answer mentions.
function cleanConversationReply(reply: string, message: string): string {
  const asksAboutIdentity = /\b(?:who|what)\s+(?:are|r)\s+(?:you|u)\b|\byour\s+(?:name|identity)\b|\bintroduc(?:e|tion)\b|\b(?:koyal|koy al)\b|\b(?:say|repeat|translate|quote|write|print|output)\b|(?:नाम|कौन|naam|kaun)/i.test(message);
  if (asksAboutIdentity) return reply;

  const introduction = /^(?:(?:hi|hey|hello)[!,.]?\s+)?(?:i(?:['’]m| am)|this is|my name is)\s+koyal(?:\s+ai)?[.!,:;—–-]+\s*/i;
  if (!introduction.test(reply)) return reply;
  const cleaned = reply.replace(introduction, "").replace(
    /^(?:it(?:['’]s| is)\s+)?nice to meet you[!.]\s*/i,
    ""
  ).trim();
  // Never discard a provider's complete response if no substantive text remains.
  return cleaned || reply;
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY
  );
}

async function askGemini(
  conversation: ChatMessage[],
  body: ChatBody
) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing.");
  }

  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: buildSystemPrompt(body),
    },
    contents: conversation.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
  });

  const reply = response.text?.trim();

  if (!reply) {
    throw new Error("Gemini returned an empty response.");
  }

  return reply;
}

async function askOllama(
  conversation: ChatMessage[],
  body: ChatBody
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OLLAMA_URL, {
      signal: controller.signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(body),
          },
          ...conversation,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const data = await response.json();
    const reply = data?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Ollama returned an empty response.");
    }

    return reply.trim();
  } finally {
    clearTimeout(timeout);
  }
}

function parseFormJSON(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new InputError("Conversation data contains invalid JSON.");
  }
}

async function readBody(request: NextRequest): Promise<ChatBody> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    const text = (key: string) => {
      const value = formData.get(key);
      return typeof value === "string" ? value : "";
    };

    const profileValue = parseFormJSON(formData.get("profile"));

    const profile =
      profileValue &&
      typeof profileValue === "object" &&
      !Array.isArray(profileValue)
        ? (profileValue as Record<string, unknown>)
        : undefined;

    return {
      message: text("message"),
      history: normalizeHistory(
        parseFormJSON(formData.get("history")) ??
          parseFormJSON(formData.get("messages"))
      ),
      mode: text("mode"),
      thinkingLevel: text("thinkingLevel"),
      voiceMode: text("voiceMode") === "true",
      language: text("language"),
      subscriptionPlan: text("subscriptionPlan"),
      selectedPlan: text("selectedPlan"),
      plan: text("plan"),
      name: text("name"),
      characterMode: text("characterMode"),
      philosophicalMode: text("philosophicalMode") === "true",
      preciseMode: text("preciseMode") === "true",
      teacherMode: text("teacherMode") === "true",
      teacherClass: text("teacherClass"),
      teacherSubject: text("teacherSubject"),
      profile: {
        name:
          typeof profile?.name === "string"
            ? profile.name
            : undefined,
      },
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InputError("The request contains invalid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InputError("Invalid chat request.");
  }

  const data = body as Record<string, unknown>;
  for (const key of ["message", "mode", "thinkingLevel", "language", "subscriptionPlan", "selectedPlan", "plan", "name", "characterMode", "teacherClass", "teacherSubject"]) {
    if (data[key] != null && typeof data[key] !== "string") {
      throw new InputError(`${key} must be text.`);
    }
  }
  const normalized = { ...data } as ChatBody;
  for (const key of ["voiceMode", "philosophicalMode", "preciseMode", "teacherMode"] as const) {
    normalized[key] = data[key] === true || data[key] === "true";
  }
  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return NextResponse.json({
        reply: "Message is required.",
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new InputError("Please keep your message under 20,000 characters.");
    }

    const plan = getPlan(body);
    const supreme = isSupremePlan(plan);
    const conversation = buildConversation(message, body);

    let reply: string;
    let providerUsed: string;
    let modelUsed: string;

    if (process.env.VERCEL === "1" || supreme) {
      reply = await askGemini(conversation, body);
      providerUsed = supreme ? "Gemini Supreme" : "Gemini Online";
      modelUsed = GEMINI_MODEL;
    } else {
      reply = await askOllama(conversation, body);
      providerUsed = "Ollama Local";
      modelUsed = OLLAMA_MODEL;
    }

    return NextResponse.json({
      reply: cleanConversationReply(reply, message),
      planUsed: plan,
      providerUsed,
      modelUsed,
      characterUsed: resolveCharacter(body.characterMode),
    });
  } catch (error: unknown) {
    // Keep the existing JSON response contract so the chat can show errors.
    const reply = error instanceof InputError ? error.message : SERVER_ERROR_REPLY;
    return NextResponse.json({
      reply,
      error: reply,
      code: error instanceof InputError ? "INVALID_REQUEST" : "PROVIDER_ERROR",
    });
  }
}
