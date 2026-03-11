// Few-shot examples for the critic agent — calibrated to the rubric scoring system

export const criticExamples = [
    // Example 1 — heavily AI, score 82
    {
        role: "user" as const,
        content: `Regular physical exercise is essential for maintaining optimal health and well-being. It is important to note that consistent exercise provides numerous benefits, including improved cardiovascular function, enhanced mental health, and reduced risk of chronic diseases. Furthermore, engaging in physical activity has been shown to improve sleep quality and increase overall energy levels. Moreover, exercise contributes to healthy weight management and strengthens the immune system. In conclusion, incorporating regular exercise into one's daily routine is one of the most effective strategies for achieving long-term health outcomes.`
    },
    {
        role: "assistant" as const,
        content: `{"score":82,"feedback":"[S1·STRUCTURE] Every sentence follows Subject→Verb→Object with zero variation across all 5 sentences — +6 pts. No inverted structures anywhere — +4 pts. [S2·BURSTINESS] All sentences are 18–28 words, std dev ~3 — +10 pts. Add a 3-word sentence like 'It adds up.' [S3·CLICHÉS] 'most effective strategies' and 'It is important to note' are predictable safe phrases — +5 pts. [S5·TRANSITIONS] 'Furthermore', 'Moreover', 'In conclusion' all used — banned phrases +6 pts, overused transitions +6 pts. [S6·PERSONAL VOICE] Zero first-person (I, my), zero hedging (honestly, I think), no em-dash asides, no rhetorical question — +12 pts. [S7·CONTRACTIONS] 'one's daily routine' should be 'your routine'; no contractions anywhere — +6 pts. [S8·IMPERFECTION] Grammatically flawless, zero fragments, zero 'And'/'But' starters — +4 pts. [S10·ANCHORS] No personal or time references anywhere — +6 pts. [S12·STRUCTURE] Opens with topic sentence previewing text; ends with 'In conclusion' summary — +6 pts. [S13·OPENERS] All paragraphs open with SVO topic sentence — +6 pts."}`,
    },

    // Example 2 — partially humanized, score 38
    {
        role: "user" as const,
        content: `Honestly, exercise is something most of us know we should do but don't always get around to. I've noticed that when I work out regularly, I sleep better and feel less anxious — it's one of those things where the science backs up what your body already tells you. There are real cardiovascular benefits, reduced risk of chronic disease, and better mental health outcomes. Regular physical activity also contributes to weight management and immune function. You don't need to run a marathon to see results. Even small amounts of consistent movement make a difference over time.`
    },
    {
        role: "assistant" as const,
        content: `{"score":38,"feedback":"[S1·STRUCTURE] 'Regular physical activity also contributes...' and 'You don't need to run a marathon...' are back-to-back SVO sentences — +4 pts. No inverted structures used — +4 pts. [S2·BURSTINESS] Sentences 3 and 4 are both medium-length with similar rhythm, std dev ~5 — +6 pts. [S3·CLICHÉS] 'make a difference over time' is a safe predictable close — +3 pts. [S4·REPETITION] 'results' and 'difference' are both vague outcome words in adjacent sentences — +3 pts. [S8·IMPERFECTION] Text is grammatically clean throughout, zero self-corrections — +2 pts. [S10·ANCHORS] No specific time or personal anchor — +6 pts. [S12·STRUCTURE] Final sentence 'make a difference over time' is a summary close — +3 pts."}`,
    },

    // Example 4 — technical text, well humanized, score 12
    {
        role: "user" as const,
        content: `A common design pattern for agents is the controller, worker pattern. In this setup, a central controller agent receives the user's request and decides how to handle the task. Instead of doing all the work, the controller hands off specific subtasks to specialized worker agents. These workers focus on narrow tasks like data retrieval, reasoning, summarization, or tool usage. Each worker processes its assigned task and sends the results back to the controller. The controller then combines the outputs into a final response. This structure makes it easier to scale because you can add more workers as new tasks arise without changing the main controller logic.`
    },
    {
        role: "assistant" as const,
        content: `{"score":12,"feedback":"[S1·STRUCTURE] 'The controller' starts sentences 5 and 6 back-to-back — +4 pts. Consider varying one opener. [S4·REPETITION] 'controller' and 'worker' repeat frequently as required by the technical subject — acceptable in domain-specific writing, minor flag only — +3 pts. All other signals pass: technical terms used conversationally ('hands off', 'focus on', 'sends the results back'), sentence variety present, no banned transitions, natural flow throughout."}`,
    },

    // Example 3 — well humanized, score 9
    {
        role: "user" as const,
        content: `Look, I know we've all heard 'exercise more' a thousand times. Still annoying. But I'll be real — since I started going for walks most mornings, I sleep better, I'm less irritable, and I've stopped having those 3pm crashes. It's not even about weight or whatever. My brain just works differently when I move. Less foggy. My doctor put it in a way that stuck: the heart stuff adds up quietly when you're sedentary for years — you don't notice until you do. And here's the thing nobody mentions: you don't have to love it. Twenty minutes of something you merely tolerate? Still works.`
    },
    {
        role: "assistant" as const,
        content: `{"score":9,"feedback":"[S3·CLICHÉS] 'you don't notice until you do' is slightly predictable — consider a sharper close — +3 pts. [S4·REPETITION] 'works' ends both the penultimate and final sentences — vary one — +4 pts. All other signals pass: strong burstiness (std dev ~8), first-person and hedging present, em-dash asides used, fragment openers ('Still annoying.', 'Less foggy.'), personal anchor ('since I started going for walks most mornings'), varied paragraph lengths, no banned transitions."}`,
    },
];
