import os
import json
import urllib.request
import urllib.error
from datetime import datetime

# ── Config ──────────────────────────────────────────────────────────────────
API_KEY = "e6424c3f62a544a5a21cee39c593824b"
API_URL = "https://api.aimlapi.com/chat/completions"
MODEL   = "gpt-4o"

TEMPERATURES = [0.75, 0.8, 0.85, 0.90, 0.91, 0.92, 0.93, 0.94, 0.95, 1.0]

SYSTEM_PROMPT = """You are a rewriting expert. Your job is to rewrite AI-generated text so it reads like something a real person wrote — and passes AI detection tools like GPTZero, Originality.ai, and Turnitin with a score below 15%.

AI detectors measure two things: perplexity (how predictable each word choice is) and burstiness (how varied sentence lengths are). AI text scores low on both. Your rewrites must score high on both.

---

## STRICT RULES

### Words and phrases you are BANNED from using:
Furthermore, Moreover, Additionally, In conclusion, It is important to note, It is worth noting, It should be noted, Delve into, Comprehensive, Crucial, Pivotal, Navigate, Landscape, Realm, Robust, Leverage, Ecosystem, Paradigm, Transformative, Groundbreaking, Revolutionary, Innovative (as filler), Holistic, Synergy, Utilize (use "use"), Facilitate (use "help"), In today's world, In today's fast-paced world, As we can see, This essay will, This paper will, First and foremost, Last but not least.

### Also BANNED — patterns that trigger "technical jargon" AI flags:
- Compound noun stacks: break into plain phrases
- Nominalization: "the implementation of" → "implementing"
- Passive voice: rewrite in active voice
- Over-qualified adjectives: "highly efficient" → just say what happened
- Domain jargon: explain in plain words

### What you MUST do:

1. **Burstiness** — Mix sentence lengths aggressively. Short punchy sentences. Then a longer one. Then short again.

2. **Contractions always** — don't, can't, it's, you're, they're, we've, that's.

3. **No two sentences may start the same way** — rotate opener types every paragraph.

4. **Sentence fragments for emphasis.** Like this. Intentional.

5. **Hedging and personal signals** — use "honestly", "I think", "sort of", "kind of", "to be fair", "in my experience", "maybe", "probably", "I'd argue".

6. **No dashes except in compound words** — do NOT use em dashes (—) or en dashes (–). Use parentheses instead.

7. **Imperfect transitions** — don't use formal transitions. Use "The thing is," / "Here's the problem:" / "What's weird is".

8. **Rhetorical questions** — ask the reader something occasionally.

9. **Concrete specifics over vague claims** — "most people I know" not "many people".

10. **Vary paragraph length** — single-sentence paragraphs sometimes.

11. **Admit complexity or tension** — "it's more complicated than that", "the honest answer is I'm not sure".

12. **Unpredictable word choices** — choose the less obvious synonym.

13. **Human imperfection (1–1.5% of sentences)** — minor natural imperfection: fragment, informal opener, sentence starting with "And" or "But".

14. **Simple, grounded technical language** — use terms naturally in conversation, not textbook style.

15. **Unpredictable text structure** — open with something other than a topic sentence; never end with a summary paragraph.

---

Output only the rewritten text, no commentary."""

# ── Input text ───────────────────────────────────────────────────────────────
INPUT_TEXT = """A common design pattern for agents is the controller-worker pattern. In this setup, a central controller agent receives the user's request and decides how to handle the task. Instead of doing all the work, the controller hands off specific subtasks to specialized worker agents. These workers focus on narrow tasks like data retrieval, reasoning, summarization, or tool usage. Each worker processes its assigned task and sends the results back to the controller. The controller then combines the outputs into a final response. This structure makes it easier to scale because you can add more workers as new tasks arise without changing the main controller logic."""

# ── LLM call ─────────────────────────────────────────────────────────────────
def call_llm(text: str, temperature: float) -> str:
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": text},
        ],
        "temperature": temperature,
        "max_tokens": 4096,
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    return body["choices"][0]["message"]["content"].strip()


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    if not API_KEY:
        print("ERROR: AIML_API_KEY environment variable is not set.")
        return

    results = []

    for i, temp in enumerate(TEMPERATURES, start=1):
        print(f"[{i:2d}/10] temperature={temp:.1f} — calling LLM...", end=" ", flush=True)
        try:
            humanized = call_llm(INPUT_TEXT, temp)
            status = "OK"
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode("utf-8")
            except Exception:
                err_body = "(could not read body)"
            humanized = f"ERROR: HTTP {e.code} — {e.reason}\n{err_body}"
            status = "FAIL"
            print(f"\n  -> {err_body[:200]}", flush=True)
        except Exception as e:
            humanized = f"ERROR: {e}"
            status = "FAIL"

        results.append({
            "iteration_count": i,
            "temperature": temp,
            "humanized_text": humanized,
        })
        print(status)

    # ── Write output.txt ──────────────────────────────────────────────────────
    output_path = os.path.join(os.path.dirname(__file__), "output.txt")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Model: {MODEL}\n")
        f.write("=" * 80 + "\n\n")

        for r in results:
            f.write(f"iteration_count: {r['iteration_count']}\n")
            f.write(f"temperature: {r['temperature']}\n")
            f.write(f"humanized_text:\n{r['humanized_text']}\n")
            f.write("\n" + "-" * 80 + "\n\n")

    print(f"\nDone. Results written to {output_path}")


if __name__ == "__main__":
    main()
