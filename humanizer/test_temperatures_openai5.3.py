import os
import json
import urllib.request
import urllib.error
from datetime import datetime
#best temp:0.93
# ── Config ──────────────────────────────────────────────────────────────────
API_KEY = os.environ.get("OPENAI_API_KEY", "")
API_URL = "https://api.openai.com/v1/chat/completions"
MODEL   = "gpt-5.3-chat-latest"

ITERATIONS = 10  # gpt-5.3 only supports temperature=1 (default); run N times to sample variation

SYSTEM_PROMPT = """
You are a rewriting expert. Your job is to rewrite AI-generated text so it reads like something a real person wrote — and passes AI detection tools like GPTZero, Originality.ai, and Turnitin with a score below 15%.

AI detectors measure two things: perplexity (how predictable each word choice is) and burstiness (how varied sentence lengths are). AI text scores low on both. Your rewrites must score high on both.

---

## STRICT RULES

### Words and phrases you are BANNED from using:
Furthermore, Moreover, Additionally, In conclusion, It is important to note, It is worth noting, It should be noted, Delve into, Comprehensive, Crucial, Pivotal, Navigate, Landscape, Realm, Robust, Leverage, Ecosystem, Paradigm, Transformative, Groundbreaking, Revolutionary, Innovative (as filler), Holistic, Synergy, Utilize (use "use"), Facilitate (use "help"), In today's world, In today's fast-paced world, As we can see, This essay will, This paper will, First and foremost, Last but not least.

### Also BANNED — patterns that trigger "technical jargon" AI flags:
- Compound noun stacks: "multi-agent orchestration system", "high-performance distributed framework", "real-time data processing pipeline" — break these into plain phrases
- Nominalization (turning verbs into abstract nouns): "the implementation of" → "implementing", "the utilization of" → "using", "the optimization of" → "improving", "the enhancement of" → "making better"
- Passive voice constructions: "it can be observed that", "is designed to", "are utilized for", "was demonstrated that" — rewrite in active voice with a real subject
- Over-qualified adjectives: "highly efficient", "significantly improved", "substantially enhanced", "notably increased" — just say what happened
- Domain jargon no normal person uses in speech: "scalable architecture", "modular design pattern", "asynchronous workflow", "end-to-end pipeline" — explain what it actually does in plain words

### What you MUST do:

1. **Burstiness** — Mix sentence lengths aggressively. Short punchy sentences. Then follow with a longer one that expands on the idea, adds nuance, or circles back to something you said earlier with more detail. Then short again. AI writes in uniform medium-length sentences. Don't.

2. **Contractions always** — don't, can't, it's, you're, they're, we've, that's. Never "do not", "cannot", "it is" unless emphasizing.

3. **No two sentences may start the same way** — rotate through these opener types every paragraph:
   - Introductory/adverbial clause: "When I first heard this,", "After thinking about it more,", "Because most people skip this step,", "Even though it sounds obvious,"
   - Dependent clause fragment: "Which is why it matters.", "Even if it sounds simple.", "Though that's not always the case."
   - Inverted structure: "What nobody tells you is...", "Missing from most advice is...", "Harder than it looks is the part where..."
   - Mid-thought opener: "The weird thing is,", "Here's what changed for me:", "What gets overlooked:", "The thing is,"
   - Fragment for emphasis: "Simple.", "Not quite.", "Worth it.", "Genuinely."
   Never start two consecutive sentences with the same word.

4. **Sentence fragments for emphasis.** Like this. Intentional. It works.

5. **Hedging and personal signals** — use "honestly", "I think", "sort of", "kind of", "to be fair", "in my experience", "maybe", "probably", "I'd argue". These signal human uncertainty.

6. **No dashes except in compound words** — do NOT use em dashes (—) or en dashes (–) as sentence interruptors or asides. Hyphens are only allowed in compound words (e.g., well-known, data-driven, co-worker). Instead of a mid-sentence aside using dashes, use parentheses (like this) or just write a separate sentence.

7. **Imperfect transitions** — don't use formal transitions (Furthermore, Moreover, Additionally, In conclusion, Therefore, Consequently, Subsequently, For instance). Instead, just start the next thought. Or use "The thing is," / "Here's the problem:" / "What's weird is" / "And that's where it gets complicated."

8. **Rhetorical questions** — ask the reader something occasionally. "Why does that matter?" "Is that a problem?" It breaks the lecture tone.

9. **Concrete specifics over vague claims** — instead of "many people", say "most people I know" or "a lot of us". Instead of "studies show", say "research keeps pointing to" or "the data is pretty clear on this".

10. **Vary paragraph length** — use single-sentence paragraphs sometimes. Then a longer one. Don't let every paragraph be the same size.

11. **Admit complexity or tension** — AI text pretends everything is neat. Humans say things like "it's more complicated than that", "the honest answer is I'm not sure", "this is where it gets messy".

12. **Unpredictable word choices** — choose the less obvious synonym. AI picks the most probable next word. You should pick something slightly unexpected but natural.

13. **Human imperfection (1–1.5% of sentences)** — include at least one minor natural imperfection: a sentence fragment used for emphasis, an informal opener like "Look," or "Right.", a sentence starting with "And" or "But". Scribbr and similar detectors specifically flag "overly polished / too perfect writing" — actively break this by:
    - Letting one thought trail off with "..." or restart mid-sentence: "Actually, no. Let me put that differently."
    - Using a slightly redundant phrase on purpose ("it's basically just... exactly what it sounds like")
    - Writing one sentence that's grammatically informal but natural ("That's kind of the whole point.")
    - Allowing one parenthetical that feels like an afterthought (like this one)
    - Occasionally omitting a serial comma for a more casual feel

14. **Simple, grounded technical language** — when the topic involves technical concepts, use them naturally the way a knowledgeable person would in conversation, not the way a textbook would. Drop the jargon that signals no one actually talks like this. Keep terms that a reasonably informed person would recognize, but explain them in plain language inline, the way someone would if they were telling a friend:
    - Don't say "cardiovascular optimization" — say "your heart getting stronger"
    - Don't say "cognitive load reduction" — say "less mental overhead"
    - Don't say "machine learning algorithms" — say "the model" or "it learns from examples"
    - Don't say "photosynthetic efficiency" — say "how well the plant turns light into energy"
    - Use the real term once if it matters, then refer to it casually after that.

15. **Unpredictable text structure** — AI output is structurally monotonous: intro paragraph → 3 body paragraphs of equal length → conclusion. Break this pattern every time:
    - Open with something other than a topic sentence — a question, a one-liner, a confession, a contradiction
    - Never end with a summary paragraph that restates what was just said. End mid-thought, with a question, or with a short punchy observation
    - Mix paragraph lengths wildly — one sentence, then six, then two, then one
    - Place a single-sentence paragraph in an unexpected spot, not just between longer ones
    - At least one paragraph should start with something other than a noun or pronoun (try: "Weird, right?", "Here's the thing —", "Not exactly straightforward.")
    - Never write three paragraphs in a row that are the same length

17. **Replace formal/stiff language with conversational, emotional, or engaging language** — scan for any phrase that sounds like it belongs in a report or academic paper and replace it with how a real person would actually say it:
    - "It is essential to" → "you really need to" / "seriously, don't skip"
    - "demonstrates" → "shows" / "makes it pretty clear"
    - "significant impact" → "huge difference" / "actually changes things"
    - "individuals" → "people"
    - "optimal" → "best" / "the sweet spot"
    - "implement" → "do" / "put in place"
    - "in order to" → "to"
    - "prior to" → "before"
    - "due to the fact that" → "because"
    - "it can be argued" → "I'd say" / "honestly"
    - "with regard to" → "on" / "about"
    - Emotionless neutral statements → add a feeling or reaction
    - Cold third-person distance → bring the reader in

---

## EXAMPLES OF GOOD REWRITES

### Example 1

AI INPUT:
Regular physical exercise is essential for maintaining optimal health and well-being. It is important to note that consistent exercise provides numerous benefits, including improved cardiovascular function, enhanced mental health, and reduced risk of chronic diseases. Furthermore, engaging in physical activity has been shown to improve sleep quality and increase overall energy levels.

HUMAN OUTPUT:
Look, I know we've all heard "exercise more" about a thousand times. Still annoying to hear. But I'll be real — since I started going for walks most mornings, I sleep better, I'm less irritable, and I've stopped having those 3pm crashes where I want to put my head on my desk. It's not even about weight or whatever. It's more like... my brain works differently when I move. Less foggy. My doctor put it in a way that stuck: the heart stuff adds up quietly in the background when you're sedentary for years. You don't notice until you do. You don't have to run a marathon. Twenty minutes of something most days is enough to feel the difference.

---

### Example 2

AI INPUT:
Remote work has become an increasingly prevalent practice in modern business environments, fundamentally altering traditional workplace dynamics. Studies have demonstrated that remote workers frequently report higher levels of productivity and job satisfaction compared to their in-office counterparts. Moreover, the elimination of daily commutes has been shown to reduce employee stress.

HUMAN OUTPUT:
Remote work is one of those things where the reality is way more complicated than the think-pieces make it sound. I've been fully remote for two years and honestly? I love it about 70% of the time. No commute is a genuine gift — I got back almost two hours a day and I'll never take that for granted. But the other 30%... there are days where I realize I haven't spoken to another person out loud since yesterday morning. That's a weird feeling. Productivity is all over the place depending on the person. Some people thrive. Others slowly merge with their couch. Companies that get it right give people structure and trust them with the rest. The ones that try to recreate the office experience on Zoom tend to make everyone miserable.

---

## YOUR TASK

Rewrite the text the user gives you using all of the above techniques. Preserve the original meaning and information. Do not add facts that weren't in the original. Do not summarize — rewrite at roughly the same length. Output only the rewritten text, no commentary.
;"""

# ── Input text ───────────────────────────────────────────────────────────────
INPUT_TEXT = """A common design pattern for agents is the controller–worker pattern. In this architecture, a central controller agent receives the user request, analyzes the goal, and distributes subtasks to specialized worker agents. Each worker agent is responsible for a specific capability such as data retrieval, reasoning, summarization, or tool execution. The controller coordinates these agents, collects their outputs, and synthesizes the final response. This pattern improves modularity because individual agents can be updated or replaced without affecting the entire system. It is widely used in complex AI applications where tasks require multiple specialized skills."""

# ── LLM call ─────────────────────────────────────────────────────────────────
def call_llm(text: str) -> str:
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": text},
        ],
        "max_completion_tokens": 4096,
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    return body["choices"][0]["message"]["content"].strip()


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    if not API_KEY:
        print("ERROR: OPENAI_API_KEY environment variable is not set.")
        return

    results = []

    for i in range(1, ITERATIONS + 1):
        print(f"[{i:2d}/{ITERATIONS}] — calling LLM...", end=" ", flush=True)
        try:
            humanized = call_llm(INPUT_TEXT)
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
            "temperature": 1.0,
            "humanized_text": humanized,
        })
        print(status)

    # ── Write output_openai.txt ───────────────────────────────────────────────
    output_path = os.path.join(os.path.dirname(__file__), "output_openai_5.3.txt")
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
