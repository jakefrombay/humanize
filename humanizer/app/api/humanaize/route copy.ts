import { NextResponse } from 'next/server';
import { systemPrompt } from './utils/instr';
import { writingSamples } from './utils/samples';

const apiKey = process.env.AIML_API_KEY;
const TARGET_SCORE = 15;

const criticSystemPrompt = `You are an AI text detection expert trained to identify AI-generated writing patterns. Analyze the given text and score how AI-generated it looks.

Check for these specific patterns:

BANNED PHRASES (flag each one found): Furthermore, Moreover, Additionally, In conclusion, It is important to note, It is worth noting, First and foremost, Last but not least, In today's world, It should be noted.

STRUCTURAL AI SIGNALS:
- All sentences roughly the same length (low burstiness) — humans mix very short sentences with longer ones
- Every paragraph same size — humans vary paragraph length drastically
- Smooth, predictable transitions between every sentence
- No sentence fragments, no rhetorical questions, no em-dash asides
- No contractions (don't, can't, it's, you're, they're)
- No hedging or personal opinion markers (honestly, I think, sort of, kind of, maybe, probably, to be fair)
- Vague generalizations ("many people", "studies show") instead of concrete specifics
- No imperfection, personality, or informal asides

For each issue you find, quote the EXACT sentence or phrase from the text that demonstrates the problem, then explain what must be changed.

You MUST respond with ONLY this JSON — no markdown, no code blocks, no extra text:
{"score":<integer 0-100>,"feedback":"<numbered list of specific issues with exact quotes from the text and what to fix>"}`;


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
            model: "gpt-4o",
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

async function humanize(text: string, feedback?: string): Promise<string> {
    const userContent = feedback
        ? `Your previous rewrite scored too high on AI detection. A critic identified these SPECIFIC problems that you MUST fix:\n\n${feedback}\n\nAddress every single issue listed. Go sentence by sentence through the text and fix each flagged problem. Then rewrite the full text:\n\n${text}`
        : `Rewrite the following text to sound natural and human:\n\n${text}`;

    return callLLM([
        { role: "system", content: systemPrompt },
        ...writingSamples,
        { role: "user", content: userContent },
    ]);
}

async function detectAI(text: string): Promise<{ score: number; feedback: string }> {
    const result = await callLLM(
        [
            { role: "system", content: criticSystemPrompt },
            { role: "user", content: text },
        ],
        0.2,
        512  // critic only needs to return a small JSON object
    );

    // Strip markdown code fences if present
    const cleaned = result.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        const score = Number(parsed.score);
        const feedback = String(parsed.feedback);
        console.log(`[CRITIC] JSON parsed OK — score=${score}`);
        return { score, feedback };
    } catch {
        // Try extracting JSON object with regex as last resort
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
        // Extract a numeric score from the raw text if possible
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

        let currentText = aiText;
        let lastFeedback: string | undefined;
        let finalScore = 100;

        for (let k = 1; ; k++) {
            console.log(`\n${"─".repeat(40)}`);
            console.log(`[k=${k}] HUMANIZER → rewriting${lastFeedback ? " with critic feedback" : ""}...`);

            currentText = await humanize(currentText, lastFeedback);
            console.log(`[k=${k}] HUMANIZER output: ${currentText.trim().split(/\s+/).length} words — "${currentText.slice(0, 120)}..."`);

            console.log(`[k=${k}] CRITIC    → analyzing for AI patterns...`);
            const { score, feedback } = await detectAI(currentText);
            finalScore = score;

            console.log(`[k=${k}] CRITIC    score : ${score}%`);
            console.log(`[k=${k}] CRITIC    issues: ${feedback}`);

            if (score <= TARGET_SCORE) {
                console.log(`\n[DONE] ✓ Target ≤${TARGET_SCORE}% reached at k=${k} (score=${score}%)`);
                break;
            }

            console.log(`[k=${k}] Score ${score}% > ${TARGET_SCORE}% — looping back to humanizer`);
            lastFeedback = feedback;
        }

        return NextResponse.json({ message: currentText, score: finalScore });
    } catch (error) {
        console.error("[ERROR]", error);
        return NextResponse.json({ error: "An error occurred while processing your request." }, { status: 500 });
    }
}
