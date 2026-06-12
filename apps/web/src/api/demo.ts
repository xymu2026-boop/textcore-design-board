import type { CourseState } from "./types";

const demoClassicalBody = `
## 线索、明线与暗线
- 文章的线索，就是贯穿前后、把材料串起来的东西。
- 《偷钱》的明线是“偷钱事件如何发生、如何被发现、如何处理”，暗线是孩子从侥幸、羞愧到重新建立自尊的心理变化。
- 好的阅读不能只看情节，还要看作者把人物心理藏在哪里、让读者在什么时候意识到主题。

## 犯错后的教育方式
- 这篇文章真正值得讨论的地方，不只是“偷钱”这件事，而是大人怎样处理孩子的错误。
- 老师把处理方式概括为几个层次：先定性错误，再保护尊严，随后给出惩罚，同时保留爱与宽容，最后用正向方式帮助孩子回到正轨。
- 文章中的父母没有把孩子彻底否定掉，这让“改错”成为可能。

## 《醉叟传》的开头
- 文言文部分进入袁宏道《醉叟传》。开头“不知何地人，亦不言其姓字”，有意制造神秘感。
- “醉叟”不是普通人物传记的正统主人公，而是一个带有奇人气质的小人物。
- 读这类文章，要先锁定人物身份、称呼由来，再看作者为什么愿意为这样的人立传。
`;

const demoClassicalConcise = `
## 线索、明线与暗线
《偷钱》的阅读重点，是看清文章的两条线索：明线写偷钱事件的发生、发展和解决，暗线写孩子在欲望、侥幸、羞愧、自尊之间的心理变化。老师提醒，阅读文章时不能只复述情节，还要追问“作者为什么这样安排”。

## 犯错教育
课程把家庭处理错误的方法整理为五步：严肃定性，保护尊严，承担后果，表达爱与宽容，最后用正向激励帮助孩子回到正轨。这个部分既能用于阅读理解，也能变成成长类作文素材。

## 文言文《醉叟传》
后半节进入袁宏道《醉叟传》。开头用“不知何地人，亦不言其姓字”制造神秘感，说明这不是普通人物介绍，而是一篇带有奇人传记色彩的小品文。阅读时要保留原文，翻译和讲解可以整理。
`;

const demoStudyBody = `
## 课堂笔记
- 明线：偷钱这件事从发生到被处理的过程。
- 暗线：孩子对错误的认识变化，以及父母如何维护他的自尊。
- 阅读方法：先抓题目和事件，再抓人物心理，最后回到文章主题。
- 作文素材：犯错并不可怕，关键是被怎样引导，以及自己能不能从错误中长大。
- 文言文：《醉叟传》开头用“不知姓名”写人物神秘感，适合学习人物传记开篇。
`;

const demoOutlineBody = `
- 《偷钱》的线索结构：明线写事件，暗线写心理。
- 犯错教育：定性、尊严、惩罚、爱、正向激励。
- 《醉叟传》：袁宏道，小人物传记，开头制造神秘感。
`;

export const DEMO_COURSES: CourseState[] = [
  {
    course_id: "course_2026_4662818f",
    schema_version: "1.0",
    status: "completed",
    source: {
      file: "五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1.docx",
      imported_at: "2026-06-10T20:05:22+08:00",
      detected_meta: {
        course_title: "五上寒假第三/四讲：隐显·偷钱 + 文言文·醉叟传",
        teacher: "张老师",
        student_group: "五上",
        content_type_candidates: ["现代文阅读", "作文方法", "文言文"],
      },
    },
    course_types: {
      dominant_type: "modern_reading",
      mixed: true,
      types: [
        { type: "modern_reading", confidence: 0.83 },
        { type: "classical_chinese", confidence: 0.64 },
      ],
    },
    paragraphs: [
      {
        pid: "p0001",
        source_order: 1,
        speaker: "老师",
        ts: "00:00:09",
        text: "今天进入第三讲，主题叫隐显。我们先看《偷钱》这篇文章的线索、明线和暗线。",
      },
      {
        pid: "p0042",
        source_order: 42,
        speaker: "老师",
        ts: "00:16:40",
        text: "前面一部分主要讲偷钱事件的来龙去脉，以及孩子犯错之后大人如何引导。",
      },
      {
        pid: "p0084",
        source_order: 84,
        speaker: "老师",
        ts: "00:34:10",
        text: "后面我们进入文言文《醉叟传》，先看作者袁宏道，再看第一段如何制造人物的神秘感。",
      },
    ],
    chunks: [
      { chunk_id: "c001", paragraph_range: ["p0001", "p0042"], primary_type: "modern_reading" },
      { chunk_id: "c002", paragraph_range: ["p0043", "p0084"], primary_type: "modern_reading" },
      {
        chunk_id: "c003",
        paragraph_range: ["p0085", "p0126"],
        primary_type: "classical_chinese",
        context_before: "从《偷钱》的阅读讲评转入文言文《醉叟传》。",
        must_preserve_spans: [
          {
            text: "醉叟者，不知何地人，亦不言其姓字，以其常醉，呼曰「醉叟」。",
            reason: "classical_text",
          },
        ],
      },
    ],
    classics_refs: [
      {
        ref_id: "ref_zuicou",
        chunk_id: "c003",
        matched: true,
        source: "gushiwen",
        title: "醉叟传",
        writer: "袁宏道",
        dynasty: "明代",
        canonical_text: "醉叟者，不知何地人，亦不言其姓字，以其常醉，呼曰「醉叟」。",
        translation: "醉叟这个人，不知道是哪里人，也不说自己的姓名字号，因为他常常喝醉，人们就称他为“醉叟”。",
        remark: "叟：年老男子。以：因为。呼曰：称呼为。",
        shangxi: "开篇不交代姓名籍贯，反而突出“常醉”这一特征，让人物带上奇人气质。",
        diffs: [{ pid: "p0085", raw: "罪首", canonical: "醉叟" }],
        confidence: 0.91,
        ref_url: "https://www.gushiwen.cn/",
      },
    ],
    global: {
      course_summary:
        "本课前半围绕吴祖光《偷钱》分析明线、暗线和犯错后的家庭教育方式；后半进入袁宏道《醉叟传》，整理作者背景、人物传记写法和第一段字词翻译。",
      main_themes: ["明线暗线", "犯错教育", "爱与宽容", "袁宏道", "醉叟传", "文言字词"],
      outline_tree: [
        { title: "《偷钱》：明线、暗线与犯错教育", level: 2, anchor: "c001", chunk_ids: ["c001"] },
        { title: "《醉叟传》：作者背景与人物开头", level: 2, anchor: "c003", chunk_ids: ["c003"] },
      ],
    },
    versions: {
      faithful: { body_md: demoClassicalBody, char_count: 31500, compression: 0.92 },
      concise: { body_md: demoClassicalConcise, char_count: 11100, compression: 0.32 },
      study: { body_md: demoStudyBody, char_count: 3300, compression: 0.1 },
      outline: { body_md: demoOutlineBody, char_count: 1600, compression: 0.05 },
    },
    default_version: "concise",
    knowledge_cards: [
      {
        card_id: "kc_line",
        title: "明线与暗线",
        type: "method",
        summary: "明线是表面可见的事件发展，暗线是隐藏在背后的心理变化或主题推进。",
        core_points: ["明线写事件", "暗线写心理", "两条线索交织形成结构"],
        example: "《偷钱》的明线是偷钱事件，暗线是孩子对错误的认识变化。",
        related_themes: ["阅读方法", "文章结构", "明线暗线"],
        source_chunks: ["c001"],
      },
      {
        card_id: "kc_yuan",
        title: "袁宏道",
        type: "person",
        summary: "明代文学家，公安派代表人物，主张独抒性灵、不拘格套。",
        core_points: ["公安派", "性灵说", "反对拟古"],
        related_persons: ["袁宏道"],
        related_themes: ["文言文", "文学史"],
        source_chunks: ["c003"],
        classics_ref_id: "ref_zuicou",
      },
      {
        card_id: "kc_zuicou",
        title: "《醉叟传》",
        type: "work",
        summary: "袁宏道所作人物传记，写一位以常醉得名的奇人，开头有意制造神秘感。",
        core_points: ["人物传记", "小人物", "神秘开篇"],
        related_persons: ["袁宏道"],
        related_themes: ["人物传记", "文言文"],
        source_chunks: ["c003"],
        classics_ref_id: "ref_zuicou",
      },
    ],
    writing_materials: [
      {
        material_id: "wm_wrong",
        title: "犯错后的爱与宽容",
        theme: ["成长", "家庭", "宽容"],
        usable_expression: "一个错误并不必然摧毁孩子，真正重要的是大人如何帮助他重新看见自己。",
        teacher_comment: "适合成长类、亲情类作文。",
        usage_suggestion: "可用于写“错误与成长”“教育的温度”等主题。",
        source_chunks: ["c001", "c002"],
      },
    ],
    review_flags: [
      {
        flag_id: "rf_zuicou",
        pid: "p0085",
        chunk_id: "c003",
        text: "罪首",
        suggestion: "醉叟",
        reason: "疑似文言文篇名转写错误，需按参考原文核对。",
        category: "classical_typo",
        severity: "medium",
        status: "open",
      },
    ],
    quality: { coverage: "good", quality_score: 0.86, recommended_human_review: true },
  },
  {
    course_id: "course_2026_652f24cc",
    schema_version: "1.0",
    status: "completed",
    source: {
      file: "五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2.docx",
      imported_at: "2026-06-10T22:16:01+08:00",
      detected_meta: {
        course_title: "五上寒假第七讲：现代文阅读 + 作文点评",
        teacher: "张老师",
        student_group: "五上",
        content_type_candidates: ["现代文阅读", "作文点评"],
      },
    },
    course_types: {
      dominant_type: "essay_feedback",
      mixed: true,
      types: [
        { type: "modern_reading", confidence: 0.7 },
        { type: "essay_feedback", confidence: 0.62 },
      ],
    },
    paragraphs: [
      {
        pid: "p0001",
        source_order: 1,
        speaker: "老师",
        ts: "00:00:10",
        text: "这一讲围绕现代文阅读和作文点评展开，重点是阅读三步法、概括题和写景语言。",
      },
    ],
    chunks: [
      { chunk_id: "c001", paragraph_range: ["p0001", "p0042"], primary_type: "modern_reading" },
      { chunk_id: "c002", paragraph_range: ["p0043", "p0084"], primary_type: "composition" },
    ],
    global: {
      course_summary: "本课围绕现代文阅读题型和作文语言修改，整理阅读三步法、概括题步骤、引用作用和写景语言的减法。",
      main_themes: ["阅读三步法", "概括题", "引用作用", "写景语言"],
      outline_tree: [
        { title: "现代文阅读三步法", level: 2, anchor: "c001", chunk_ids: ["c001"] },
        { title: "作文点评：写景语言更新", level: 2, anchor: "c002", chunk_ids: ["c002"] },
      ],
    },
    versions: {
      faithful: { body_md: "## 现代文阅读三步法\n老师围绕浏览全文、细读题干、回到文本三个步骤展开讲解。", char_count: 30900, compression: 0.91 },
      concise: { body_md: "## 阅读与作文整理\n本课把阅读题解题步骤和作文语言修改放在一起整理。", char_count: 10800, compression: 0.32 },
      study: { body_md: "## 学习整理\n- 阅读三步法\n- 概括题三步走\n- 作文语言做减法", char_count: 3600, compression: 0.11 },
      outline: { body_md: "- 阅读三步法\n- 概括题\n- 引用作用\n- 作文语言", char_count: 2200, compression: 0.07 },
    },
    default_version: "concise",
    knowledge_cards: [
      {
        card_id: "kc_read",
        title: "阅读三步法",
        type: "method",
        summary: "先浏览全文，再细读题干，最后回到文本找依据。",
        core_points: ["浏览全文", "细读题干", "回归文本"],
        related_themes: ["阅读方法"],
        source_chunks: ["c001"],
      },
    ],
    writing_materials: [
      {
        material_id: "wm_scene",
        title: "写景语言做减法",
        theme: ["作文语言", "写景"],
        usage_suggestion: "删掉拖慢节奏的词，让语言更凝练、更有跳跃感。",
        source_chunks: ["c002"],
      },
    ],
    review_flags: [],
    quality: { coverage: "good", quality_score: 0.82, recommended_human_review: false },
  },
];
