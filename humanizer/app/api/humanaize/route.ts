import { NextResponse } from 'next/server';
import { systemPrompt } from './utils/instr';
import { writingSamples } from './utils/samples';
import { criticExamples } from './utils/criticSamples';

const apiKey = process.env.AIML_API_KEY;
const TARGET_SCORE = 15;

const criticSystemPrompt = `You are an AI text detection expert. Score the text using the rubric below. Each signal has a maximum penalty. Add up the penalties to get the total score (0 = fully human, 100 = fully AI).

You will receive a pre-computed signal report first — treat those numbers as hard evidence.

## SCORING RUBRIC (penalties add up to 100)

### S1 · SENTENCE STRUCTURE VARIETY [max 10 pts]
Check for opener diversity. Each paragraph must rotate through: introductory clauses ("When...", "After...", "Because..."), dependent fragments ("Which is why...", "Even if..."), inverted structures ("What nobody tells you is..."), mid-thought openers ("The weird thing is,"), and fragments ("Simple.", "Right.").
- Two or more consecutive sentences start with the same word: +4 pts each pair
- All sentences in a paragraph follow Subject→Verb→Object: +6 pts per paragraph
- Zero use of inverted structures anywhere: +4 pts

### S2 · BURSTINESS / SENTENCE LENGTH VARIETY [max 10 pts]
Use the pre-computed std dev.
- Std dev ≥ 12: 0 pts
- Std dev 7–11: +3 pts
- Std dev 4–6: +6 pts
- Std dev < 4: +10 pts

### S3 · PREDICTABLE / CLICHÉD PHRASING [max 8 pts]
Flag each instance of safe, overused phrasing: "plays a crucial role", "it is clear that", "it goes without saying", "when it comes to", "significant impact", "in today's world", "a wide range of".
- 1 instance: +3 pts
- 2 instances: +5 pts
- 3+ instances: +8 pts

### S4 · KEYWORD REPETITION [max 6 pts]
Same content word (noun/verb/adjective) used 3+ times in close proximity.
- 1 repeated word cluster: +3 pts
- 2+: +6 pts

### S5 · TRANSITIONAL WORD OVERUSE [max 8 pts]
Any transition from these categories used more than once, or two from the same category back-to-back:
Addition (Furthermore, Moreover, Additionally, Also) | Contrast (However, Nevertheless, On the other hand) | Cause (Therefore, Consequently, Thus, Hence) | Sequence (First, Second, Finally, Subsequently) | Example (For instance, For example, Specifically) | Conclusion (In conclusion, Ultimately, To sum up)
- 1 overused transition: +3 pts
- 2+: +6 pts
- Banned phrase from list (Furthermore, Moreover, In conclusion, It is important to note, etc.): +2 pts each

### S6 · PERSONAL VOICE [max 12 pts]
- No first-person at all (I, my, I've, I'd): +5 pts
- No hedging markers (honestly, I think, sort of, kind of, maybe, probably, I'd argue): +4 pts
- No parenthetical remarks (like this) used informally: +2 pts
- No rhetorical question: +1 pt
Note: em dashes (—) used as asides are NOT expected and should NOT be rewarded. Hyphens are only acceptable in compound words (well-known, data-driven).

### S7 · CONTRACTIONS [max 6 pts]
Use the pre-computed contraction ratio.
- Ratio ≥ 70%: 0 pts
- Ratio 50–69%: +2 pts
- Ratio 30–49%: +4 pts
- Ratio < 30%: +6 pts
Also flag each specific uncontracted form: "do not", "cannot", "it is", "they are", "you are", "we are", "has not", "did not", "will not" → +1 pt each (max +4).

### S8 · HUMAN IMPERFECTION [max 6 pts]
- Zero informal openers, fragments for emphasis, or "And"/"But" sentence starters: +4 pts
- Zero self-corrections ("Actually—", "Wait, no.", "I mean,", "..."): +2 pts

### S9 · EMOTIONAL TONE UNIFORMITY [max 6 pts]
- All paragraphs feel the same neutral/measured tone: +6 pts
- Only slight variation: +3 pts

### S10 · MISSING ANCHORS [max 6 pts]
Use the pre-computed temporal anchor count.
- 0 anchors (no "last year", "when I was", "I remember when", specific event/place): +6 pts
- 1 anchor: +2 pts

### S11 · LEXICAL DIVERSITY [max 6 pts]
Use the pre-computed TTR.
- TTR ≥ 0.60: 0 pts
- TTR 0.45–0.59: +3 pts
- TTR < 0.45: +6 pts

### S12 · PREDICTABLE TEXT STRUCTURE [max 8 pts]
- Opens with a topic sentence previewing the text: +3 pts
- Ends with a summary/conclusion paragraph restating what was said: +3 pts
- All paragraphs are roughly the same length: +2 pts

### S13 · PARAGRAPH OPENERS [max 6 pts]
Use the pre-computed SVO opener count.
- All or most paragraphs start with SVO topic sentence: +6 pts
- Half: +3 pts

### S14 · TECHNICAL LANGUAGE AND JARGON [max 8 pts]
AI text is flagged by Scribbr specifically for "domain-specific terms and overly complex language". Check for:
- Compound noun stacks ("multi-agent orchestration system", "high-performance distributed framework"): +2 pts each (max +4)
- Nominalization ("the implementation of X" instead of "implementing X", "the utilization of" instead of "using"): +2 pts each (max +4)
- Passive voice constructions ("it can be observed that", "is designed to", "are utilized for"): +1 pt each (max +3)
- Over-qualified adjectives ("highly efficient", "significantly improved", "substantially enhanced"): +1 pt each (max +2)

### S15 · OVERLY POLISHED / TOO PERFECT WRITING [max 10 pts]
AI text is flagged by Scribbr for "overly polished / too perfect writing". This means:
- Every sentence is grammatically complete and clean, no trailing thoughts, no restarts: +3 pts
- Zero informal constructions ("That's kind of the whole point.", "Basically, it just works."): +2 pts
- No parenthetical afterthoughts (like this) used naturally: +2 pts
- Text reads like a final draft with zero roughness, every word feels chosen, no filler: +3 pts
- Em dashes (—) or en dashes (–) used as sentence interruptors or informal asides (not as compound-word hyphens): +2 pts each (max +4) — this is a strong AI writing tell
If any humanizing elements are present, reduce the penalty proportionally.

---

## OUTPUT FORMAT

Compute the total penalty. Then respond with ONLY this JSON — no markdown, no code blocks, no extra text:
{"score":<integer 0-100 = total penalty, capped at 100>,"feedback":"<one line per signal that has penalties: [S#·SIGNAL NAME] \\"exact quoted text\\" → specific fix required>"}

Only include signals that have non-zero penalties in the feedback. Be specific — quote exact words, name the exact fix.`;


// ---------------------------------------------------------------------------
// Grammarly-style algorithmic signal analysis
// ---------------------------------------------------------------------------

const BANNED_PHRASES = [
    "furthermore", "moreover", "additionally", "in conclusion",
    "it is important to note", "it is worth noting", "it should be noted",
    "first and foremost", "last but not least", "in today's world",
    "plays a crucial role", "it is clear that", "it goes without saying",
    "when it comes to", "delve into", "comprehensive", "pivotal",
    "navigate", "landscape", "realm", "robust", "leverage", "ecosystem",
    "paradigm", "transformative", "groundbreaking", "revolutionary",
    "holistic", "synergy", "utilize", "facilitate",
];

const PASSIVE_VOICE_RE = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi;
const NOMINALIZATION_RE = /\bthe (implementation|utilization|optimization|enhancement|development|establishment|maintenance|facilitation|demonstration|examination|investigation) of\b/gi;
const OVER_QUALIFIED_RE = /\b(highly|significantly|substantially|notably|considerably|remarkably|exceptionally|profoundly|extensively)\s+(efficient|improved|enhanced|increased|reduced|effective|beneficial|important|valuable|useful)\b/gi;
const POLISHED_INFORMAL_RE = /\b(basically|pretty much|kind of|sort of|you know|I mean|that's just|it's just|just kind of|honestly though|to be fair|I'd say|the thing is)\b/gi;

const EXPANDED_FORMS = [
    /\bdo not\b/gi, /\bcannot\b/gi, /\bit is\b/gi, /\bthey are\b/gi,
    /\byou are\b/gi, /\bwe are\b/gi, /\bhas not\b/gi, /\bdid not\b/gi,
    /\bwill not\b/gi, /\bI am\b/gi, /\bI have\b/gi, /\bI would\b/gi,
    /\bI will\b/gi, /\bshould not\b/gi, /\bcould not\b/gi, /\bwould not\b/gi,
];

const CONTRACTION_RE = /\b\w+'\w+\b/g;
const FIRST_PERSON_RE = /\b(I|I've|I'd|I'm|I'll|my|me|myself|in my experience|I think|I feel|I know|I remember|I noticed|I found)\b/gi;
const HEDGE_RE = /\b(honestly|I think|I'd say|sort of|kind of|maybe|probably|perhaps|to be fair|I'd argue|I guess|I suppose|not sure|I'm not sure|it's complicated|more or less|to some extent)\b/gi;
const SELF_CORRECTION_RE = /\b(actually[—–-]|wait[,.]?\s+no|let me put it differently|I mean[,—]|or rather[,—]|well[,—]|\.\.\.)/gi;
const TEMPORAL_ANCHOR_RE = /\b(last year|last month|last week|a few months ago|a few years ago|recently|I remember when|when I was|back in|in \d{4}|this morning|yesterday|the other day|years ago|months ago|weeks ago|at the time|back then)\b/gi;
const RHETORICAL_Q_RE = /[^.!]*\?/g;

function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function splitParagraphs(text: string): string[] {
    return text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
}

function wordCount(str: string): number {
    return str.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function stdDev(nums: number[]): number {
    if (nums.length < 2) return 0;
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance = nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / nums.length;
    return Math.sqrt(variance);
}

interface TextSignals {
    sentenceCount: number;
    avgSentenceWords: number;
    sentenceLenStdDev: number;
    burstinessLabel: string;
    bannedPhraseHits: string[];
    expandedFormCount: number;
    contractionCount: number;
    contractionRatio: string;
    typeTokenRatio: number;
    lexicalDiversityLabel: string;
    firstPersonCount: number;
    hedgeMarkerCount: number;
    rhetoricalQuestionCount: number;
    selfCorrectionCount: number;
    temporalAnchorCount: number;
    paragraphCount: number;
    suspiciousParagraphOpeners: number;
    repeatedSentenceOpeners: number;
    passiveVoiceCount: number;
    nominalizationCount: number;
    overQualifiedCount: number;
    informalPolishedCount: number;
}

function analyzeTextSignals(text: string): TextSignals {
    const sentences = splitSentences(text);
    const paragraphs = splitParagraphs(text);
    const lowerText = text.toLowerCase();

    // Burstiness
    const sentLengths = sentences.map(wordCount);
    const avgSentenceWords = sentLengths.length
        ? sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length
        : 0;
    const sentenceLenStdDev = stdDev(sentLengths);
    const burstinessLabel =
        sentenceLenStdDev < 4 ? "VERY LOW (AI-like)" :
        sentenceLenStdDev < 7 ? "LOW" :
        sentenceLenStdDev < 12 ? "MODERATE" : "HIGH (human-like)";

    // Banned phrases
    const bannedPhraseHits = BANNED_PHRASES.filter(phrase =>
        lowerText.includes(phrase.toLowerCase())
    );

    // Contractions vs expanded forms
    const expandedFormCount = EXPANDED_FORMS.reduce(
        (count, re) => count + (text.match(re) ?? []).length, 0
    );
    const contractionCount = (text.match(CONTRACTION_RE) ?? []).length;
    const totalFormCount = expandedFormCount + contractionCount;
    const contractionPct = totalFormCount > 0
        ? Math.round((contractionCount / totalFormCount) * 100)
        : 0;
    const contractionRatio = `${contractionPct}% contracted (${contractionCount} contractions, ${expandedFormCount} expanded)`;

    // Lexical diversity (TTR on 4+ letter words)
    const allWords = text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    const uniqueWords = new Set(allWords);
    const typeTokenRatio = allWords.length > 0
        ? Math.round((uniqueWords.size / allWords.length) * 100) / 100
        : 0;
    const lexicalDiversityLabel =
        typeTokenRatio < 0.45 ? "LOW (AI-like)" :
        typeTokenRatio < 0.60 ? "MODERATE" : "HIGH (human-like)";

    // Personal voice signals
    const firstPersonCount = (text.match(FIRST_PERSON_RE) ?? []).length;
    const hedgeMarkerCount = (text.match(HEDGE_RE) ?? []).length;
    const rhetoricalQuestionCount = (text.match(RHETORICAL_Q_RE) ?? []).length;
    const selfCorrectionCount = (text.match(SELF_CORRECTION_RE) ?? []).length;
    const temporalAnchorCount = (text.match(TEMPORAL_ANCHOR_RE) ?? []).length;

    // Paragraph openers — SVO pattern (AI-like topic sentence)
    const svoOpenerRe = /^[A-Z][a-z]+ (is|are|was|were|has|have|can|will|would|should|must|may|might|does|do|did)\b/;
    const suspiciousParagraphOpeners = paragraphs.filter(p => {
        const first = splitSentences(p)[0] ?? '';
        return svoOpenerRe.test(first);
    }).length;

    // Repeated sentence openers — flag consecutive same first-word
    let repeatedSentenceOpeners = 0;
    for (let i = 1; i < sentences.length; i++) {
        const prevFirst = sentences[i - 1].split(/\s+/)[0]?.toLowerCase() ?? '';
        const currFirst = sentences[i].split(/\s+/)[0]?.toLowerCase() ?? '';
        if (prevFirst && currFirst && prevFirst === currFirst) repeatedSentenceOpeners++;
    }

    // Scribbr signals: technical jargon & over-polished writing
    const passiveVoiceCount = (text.match(PASSIVE_VOICE_RE) ?? []).length;
    const nominalizationCount = (text.match(NOMINALIZATION_RE) ?? []).length;
    const overQualifiedCount = (text.match(OVER_QUALIFIED_RE) ?? []).length;
    const informalPolishedCount = (text.match(POLISHED_INFORMAL_RE) ?? []).length;

    return {
        sentenceCount: sentences.length,
        avgSentenceWords: Math.round(avgSentenceWords * 10) / 10,
        sentenceLenStdDev: Math.round(sentenceLenStdDev * 10) / 10,
        burstinessLabel,
        bannedPhraseHits,
        expandedFormCount,
        contractionCount,
        contractionRatio,
        typeTokenRatio,
        lexicalDiversityLabel,
        firstPersonCount,
        hedgeMarkerCount,
        rhetoricalQuestionCount,
        selfCorrectionCount,
        temporalAnchorCount,
        paragraphCount: paragraphs.length,
        suspiciousParagraphOpeners,
        repeatedSentenceOpeners,
        passiveVoiceCount,
        nominalizationCount,
        overQualifiedCount,
        informalPolishedCount,
    };
}

function formatSignalsReport(s: TextSignals): string {
    return `--- ALGORITHMIC SIGNAL ANALYSIS (pre-computed) ---
BURSTINESS: std dev = ${s.sentenceLenStdDev} words across ${s.sentenceCount} sentences (avg ${s.avgSentenceWords}w) → ${s.burstinessLabel}
REPEATED SENTENCE OPENERS: ${s.repeatedSentenceOpeners} consecutive pairs with same first word
BANNED PHRASES found (${s.bannedPhraseHits.length}): ${s.bannedPhraseHits.length ? s.bannedPhraseHits.join(", ") : "none"}
CONTRACTIONS: ${s.contractionRatio}
LEXICAL DIVERSITY (TTR): ${s.typeTokenRatio} → ${s.lexicalDiversityLabel}
FIRST-PERSON signals: ${s.firstPersonCount}
HEDGING markers: ${s.hedgeMarkerCount}
RHETORICAL questions: ${s.rhetoricalQuestionCount}
SELF-CORRECTIONS / false starts: ${s.selfCorrectionCount}
TEMPORAL / personal anchors: ${s.temporalAnchorCount}
PARAGRAPH openers (SVO topic-sentence pattern): ${s.suspiciousParagraphOpeners}/${s.paragraphCount} paragraphs
PASSIVE VOICE constructions: ${s.passiveVoiceCount}
NOMINALIZATIONS ("the X of"): ${s.nominalizationCount}
OVER-QUALIFIED adjectives ("highly efficient" etc.): ${s.overQualifiedCount}
INFORMAL markers (polished-breaking words): ${s.informalPolishedCount}
--- END ANALYSIS ---

Now score the text below using ALL 15 criteria (including S14 TECHNICAL LANGUAGE and S15 OVERLY POLISHED), treating the above measurements as hard evidence:`;
}

// ---------------------------------------------------------------------------

async function callLLM(
    messages: Array<{ role: string; content: string }>,
    temperature = 0.9,
    maxTokens = 4096
): Promise<string> {
    const response = await fetch("https://api.aimlapi.com/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-5.3",
            messages,
            max_tokens: maxTokens,
            temperature,
        }),
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
}

async function humanize(text: string, k: number, feedback?: string, breakthrough = false): Promise<string> {
    let userContent: string;

    if (breakthrough) {
        // Extract which signals are still failing from feedback tags like [S6·PERSONAL VOICE]
        const failingSignals = (feedback ?? '').match(/\[S\d+·[A-Z ]+\]/g) ?? [];
        const signalList = failingSignals.length
            ? failingSignals.map(s => s.replace(/\[|\]/g, '')).join(', ')
            : 'all remaining signals';

        userContent =
            `[BREAKTHROUGH k=${k}] Previous rewrites are stuck at the same score. Start completely fresh from the original text — do NOT try to patch the last version.\n\n` +
            `The critic keeps penalizing these signals: ${signalList}\n\n` +
            `Focus ONLY on fixing these. Ignore signals that are already passing. Be bold:\n` +
            ` - For PERSONAL VOICE: open with a first-person observation. Add "honestly,", "I think", or "I'd say" somewhere. Ask the reader a rhetorical question. Add a parenthetical remark (like this one) instead of a dash.\n` +
            ` - For BURSTINESS: write at least two sentences under 5 words. Write at least one sentence over 28 words. No two consecutive sentences should be within 3 words of each other in length.\n` +
            ` - For STRUCTURE: open with something other than a noun. Use an inverted structure ("What this means is..."). Put a 1-sentence paragraph somewhere unexpected.\n` +
            ` - For CONTRACTIONS: contract every single eligible word. 'it is' → 'it's', 'do not' → 'don't', 'they are' → 'they're'.\n` +
            ` - For ANCHORS: add a personal time reference ('I've seen this', 'last time I checked', 'in my experience').\n\n` +
            `Rewrite the full text from scratch:\n\n${text}`;
    } else if (feedback) {
        userContent =
            `[TURN k=${k}] Your previous rewrite still reads as AI-generated.\n\n` +
            `The critic flagged these SPECIFIC problems — fix EVERY one of them:\n\n` +
            `${feedback}\n\n` +
            `Go sentence by sentence. For each flagged phrase or sentence:\n` +
            ` - Rewrite it using a different sentence opener type (introductory clause, inverted structure, fragment, mid-thought, dependent clause)\n` +
            ` - Break any two consecutive sentences that start with the same word\n` +
            ` - Replace every banned/formal phrase with natural conversational language\n` +
            ` - Add contractions wherever expanded forms appear\n` +
            ` - Ensure sentence lengths vary drastically (mix 3-word and 25-word sentences)\n\n` +
            `Then output the full rewritten text:\n\n${text}`;
    } else {
        userContent = `[TURN k=${k}] Rewrite the following text to sound natural and human:\n\n${text}`;
    }

    // Use higher temperature for breakthrough attempts to force more variation
    const temperature = breakthrough ? 1.1 : 0.9;

    return callLLM(
        [
            { role: "system", content: systemPrompt },
            ...writingSamples,
            { role: "user", content: userContent },
        ],
        temperature
    );
}

async function detectAI(text: string): Promise<{ score: number; feedback: string }> {
    const signals = analyzeTextSignals(text);
    console.log(`[SIGNALS] burstiness=${signals.burstinessLabel} | repeated-openers=${signals.repeatedSentenceOpeners} | TTR=${signals.typeTokenRatio} | banned=${signals.bannedPhraseHits.length} | contractions=${signals.contractionRatio} | 1st-person=${signals.firstPersonCount} | hedges=${signals.hedgeMarkerCount} | rhetorical-q=${signals.rhetoricalQuestionCount} | self-corrections=${signals.selfCorrectionCount} | anchors=${signals.temporalAnchorCount}`);

    const userMessage = `${formatSignalsReport(signals)}\n\n${text}`;

    const result = await callLLM(
        [
            { role: "system", content: criticSystemPrompt },
            ...criticExamples,
            { role: "user", content: userMessage },
        ],
        0.2,
        1024
    );

    const cleaned = result.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        const score = Number(parsed.score);
        const feedback = String(parsed.feedback);
        console.log(`[CRITIC] JSON parsed OK — score=${score}`);
        return { score, feedback };
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                const score = Number(parsed.score);
                const feedback = String(parsed.feedback);
                console.log(`[CRITIC] JSON extracted via regex — score=${score}`);
                return { score, feedback };
            } catch { /* fall through */ }
        }
        console.warn(`[CRITIC] JSON parse failed. Raw response:\n${result}`);
        const scoreMatch = cleaned.match(/\b([0-9]{1,3})\s*%/);
        const score = scoreMatch ? Math.min(100, Number(scoreMatch[1])) : 50;
        return { score, feedback: cleaned };
    }
}

export async function POST(request: Request) {
    console.log("=====================================");
    console.log("POST /api/humanaize — multi-agent loop started");

    try {
        const { aiText } = await request.json();
        console.log(`[INPUT] ${aiText.trim().split(/\s+/).length} words received`);

        const MAX_RETRIES_PER_K = 3;
        const PLATEAU_THRESHOLD = 2; // consecutive k values with no bestScore improvement → breakthrough
        const MAX_K = 10;            // hard cap to prevent runaway loops

        let currentText = aiText;
        let bestText = aiText;
        let bestScore = 100;
        let prevScore = 100;
        let lastFeedback: string | undefined;
        let finalScore = 100;
        let noImprovementStreak = 0;

        for (let k = 1; k <= MAX_K; k++) {
            console.log(`\n${"─".repeat(40)}`);

            const isBreakthrough = noImprovementStreak >= PLATEAU_THRESHOLD;
            if (isBreakthrough) {
                console.log(`[k=${k}] ⚡ PLATEAU DETECTED (${noImprovementStreak} turns without improvement) — switching to BREAKTHROUGH mode`);
            }

            let humanized = '';
            let score = 0;
            let feedback = '';

            for (let retry = 0; retry <= MAX_RETRIES_PER_K; retry++) {
                // Breakthrough: restart from original text to escape local minimum
                const inputText = isBreakthrough ? aiText : (retry === 0 ? currentText : bestText);

                if (retry > 0) {
                    console.log(`[k=${k}] ↺ Regression (${score}% > ${prevScore}%) — restarting k=${k}, retry ${retry}/${MAX_RETRIES_PER_K}`);
                }

                console.log(`[k=${k}] HUMANIZER → rewriting${isBreakthrough ? " [BREAKTHROUGH]" : lastFeedback ? " with critic feedback" : ""}...`);
                humanized = await humanize(inputText, k, lastFeedback, isBreakthrough);
                console.log(`[k=${k}] HUMANIZER output: ${humanized.trim().split(/\s+/).length} words — "${humanized.slice(0, 120)}..."`);

                console.log(`[k=${k}] CRITIC    → analyzing...`);
                ({ score, feedback } = await detectAI(humanized));
                console.log(`[k=${k}] CRITIC    score : ${score}% (prev: ${prevScore}%)`);
                console.log(`[k=${k}] CRITIC    issues: ${feedback}`);

                if (score <= prevScore) {
                    console.log(`[k=${k}] ✓ Score improved or held — accepting`);
                    break;
                }

                if (retry === MAX_RETRIES_PER_K) {
                    console.log(`[k=${k}] All retries exhausted — reverting to best text (score=${bestScore}%)`);
                    humanized = bestText;
                    score = bestScore;
                    feedback = lastFeedback ?? '';
                }
            }

            currentText = humanized;
            finalScore = score;

            if (score < bestScore) {
                bestText = humanized;
                bestScore = score;
                noImprovementStreak = 0;
                console.log(`[k=${k}] ★ New best score: ${bestScore}%`);
            } else {
                noImprovementStreak++;
                console.log(`[k=${k}] No improvement — streak: ${noImprovementStreak}/${PLATEAU_THRESHOLD}`);
            }

            if (score <= TARGET_SCORE) {
                console.log(`\n[DONE] ✓ Target ≤${TARGET_SCORE}% reached at k=${k} (score=${score}%)`);
                break;
            }

            if (k === MAX_K) {
                console.log(`\n[DONE] Max iterations (${MAX_K}) reached — returning best result (score=${bestScore}%)`);
                currentText = bestText;
                finalScore = bestScore;
                break;
            }

            console.log(`[k=${k}] Score ${score}% > ${TARGET_SCORE}% — continuing to k=${k + 1}`);
            prevScore = score;
            lastFeedback = feedback;
        }

        return NextResponse.json({ message: currentText, score: finalScore });
    } catch (error) {
        console.error("[ERROR]", error);
        return NextResponse.json({ error: "An error occurred while processing your request." }, { status: 500 });
    }
}
