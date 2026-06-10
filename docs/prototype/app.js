const courses = [
  {
    id: "sample-classical",
    title: "五上寒假第三/四讲",
    subtitle: "《偷钱》线索讲评 + 文言文《醉叟传》",
    teacher: "张老师",
    type: "阅读 + 文言文",
    status: "已完成",
    updated: "样例试处理",
    reviewCount: 9,
  },
  {
    id: "sample-essay",
    title: "五上寒假第七讲",
    subtitle: "现代文阅读 + 作文点评",
    teacher: "张老师",
    type: "阅读作文",
    status: "已完成",
    updated: "样例试处理",
    reviewCount: 7,
  },
  {
    id: "lesson-8",
    title: "五上秋季第八讲",
    subtitle: "古诗词讲评",
    teacher: "陈老师",
    type: "古诗词",
    status: "有待复核",
    updated: "周一 19:44",
    reviewCount: 8,
  },
  {
    id: "lesson-9",
    title: "五上秋季第九讲",
    subtitle: "现代文阅读 + 应试作文",
    teacher: "陈老师",
    type: "阅读作文",
    status: "处理中",
    updated: "刚刚",
    reviewCount: 0,
  },
];

const lessonSamples = {
  "sample-classical": {
    title: "五上寒假第三/四讲",
    subtitle: "《偷钱》线索讲评 + 文言文《醉叟传》",
    teacher: "张老师",
    type: "阅读 + 文言文",
    sourceFile: "五上-人文综合涵养-寒假-第三讲-隐显-偷钱+第四讲-文言文-醉叟传1.docx",
    stats: "357 段 / 约 3.43 万字",
    reviewCount: 9,
    summary: "本课前半讲吴祖光《偷钱》，重点分析明线、暗线、儿童犯错与家庭教育方式；后半进入袁宏道《醉叟传》，讲作者背景、人物传记写法和第一段字词翻译。该样例主要测试混合课切分、阅读讲评保留、文言文原文保护和疑似转写错误标记。",
    rawExcerpt: `
      <p>陈细影 00:00:09</p>
      <p>今天进入第三讲，大主题叫“隐显”。在写作构思中，文章常常会设置线索。更复杂一点的文章，会有一条明线、一条暗线。</p>
      <p>这篇《偷钱》很明显有明线和暗线，两条线索交织起来，构成文章结构。它背后涉及孩子犯错和成年人态度这个教育话题。</p>
      <p>第四讲开始进入文言文部分。史传类文章选了明朝散文家袁宏道写的《醉叟传》，文章有难度，但内容很有趣。</p>
      <p class="review-mark">[原文疑似转写：多处“罪首/最手/醉手”应复核为“醉叟”。]</p>
    `,
    versions: {
      clean: `
        <h2>一、《偷钱》：明线、暗线与犯错后的教育</h2>
        <p>本讲先进入第三讲“隐显”。老师说明，文章的线索是贯穿全文、把前后内容关联起来的东西。稍复杂的文章常常有明线和暗线：明线是表面可见的事件发展，暗线是隐藏在事件背后的情感、观念或主题推进。</p>
        <p>吴祖光的《偷钱》正适合观察这一点。文章表面写“我”小时候偷家里的钱，从偶然拿一小部分，到逐渐形成习惯，最后被母亲发现。这是明线。暗线则是一个孩子在犯错后的心理变化，以及父母、祖母如何处理错误。</p>
        <div class="quote-block">
          老师提醒：标题“偷钱”本身带有悬念，会让读者追问“谁偷钱、为什么偷、后来怎样”。这也是标题的吸引力。
        </div>
        <p>文章开头交代偷钱的背景：“时常和母亲要钱，又说不出个正经的用处”，这不是贫穷导致的偷窃，而是孩子想要用钱自由，却又不愿向大人解释。老师借此补充，童年并不总是轻松自由的，很多事情都要向大人交代。</p>
        <p>第一次偷钱发生在清早，桌上放着一叠铜子，“我”见猎心喜，只拿了一小部分。这说明孩子一方面有欲望，一方面还有分寸和害怕。随后“略微有些不安”，但因为没人发现，侥幸心理逐渐增长，最终从一次偶然变成日常习惯。</p>
        <p>事情败露后，母亲“半晌无话，看了我许久”，老师分析这里不是简单的愤怒，而是不可置信：一个书香家庭的孩子，平时要钱也不是不给，为什么会偷？母亲随后把事情定性为“偷钱”，但没有当着弟妹羞辱孩子。</p>
        <p>祖母、母亲和父亲的处理共同构成教育重点：事情要定性，错误要承担后果，但不能伤害孩子的自尊。父亲最后把孩子想买的乒乓球拍放在枕边，说“又不是不给他钱，一定要偷，多难为情”，这句话既指出错误，也保留爱与宽容。</p>
        <p>老师进一步引申：严厉惩罚未必能让人反思，爱与包容反而可能让孩子产生安全感，从而有空间真正面对自己的错误。课堂后半也让同学分享自己犯错后的经历，用来理解文章的教育主题。</p>

        <h2>二、文言文《醉叟传》：人物传记的开头</h2>
        <p>课程后半进入第四讲文言文。老师介绍作者袁宏道，他是晚明“公安派”代表人物，文章强调独抒性灵、反对模拟古人。袁宏道的散文游记和人物传记都很有代表性。</p>
        <p>本课开讲《醉叟传》第一段。标题中的“叟”指年老男子，“醉叟”可理解为“醉酒的老者”或“老酒鬼”。老师提醒，转写稿中多次出现“罪首”“最手”等，需复核为“醉叟”。</p>
        <div class="quote-block">
          原文片段：醉叟者，不知何地人，亦不言其姓字，以其常醉，呼曰“醉叟”。<br />
          <span class="review-mark">[需复核：原 Word 多处写作“罪首/最手”，本样例按语境暂校为“醉叟”。]</span>
        </div>
        <p>老师逐字解释：“何地”是哪里；“姓字”指姓名字号；“以”在这里表示因为；“呼曰”即称呼为。醉叟的来历、姓名都不清楚，只因常醉，被人称为醉叟，这样的开头制造了人物的神秘感。</p>
        <p>后文继续写醉叟每年游于“京、离”之间，年约五十余，孑然一身，没有伴侣子弟，手提黄竹篮，整日沉醉。篮中装着干蜈蚣等异物下酒，街市上的人见了非常惊骇。这些细节共同塑造了一个奇异、传奇、让人好奇的人物形象。</p>
      `,
      study: `
        <h2>课程摘要</h2>
        <p>这是一节“阅读讲评 + 文言文开篇”的混合课。前半围绕吴祖光《偷钱》，学习如何从明线、暗线理解文章结构，并把“偷钱”事件读成一个关于犯错、羞耻、自尊、爱与宽容的教育故事。后半进入袁宏道《醉叟传》，重点是作者背景、标题含义、第一段句读和字词翻译。</p>

        <h2>一、阅读方法：从“线索”进入文章结构</h2>
        <h3>1. 什么是线索</h3>
        <p>线索是贯穿文章前后的东西，它能让文章显得紧凑，把分散的情节、人物和主题关联起来。较复杂的文章常常有明线和暗线。</p>
        <ul>
          <li><strong>明线：</strong>表面可见的事件发展。</li>
          <li><strong>暗线：</strong>隐藏在事件背后的心理变化、情感推进或主题发展。</li>
        </ul>

        <h3>2. 《偷钱》的明线与暗线</h3>
        <p><strong>明线</strong>是“偷钱”事件本身：想用钱却不愿解释；第一次拿一小部分；没人发现后形成习惯；最后把一大叠铜元全拿走，被母亲发现。</p>
        <p><strong>暗线</strong>是孩子的心理和家庭教育方式：欲望、道德模糊、侥幸心理、被发现后的羞耻与不安，以及家人如何在定性错误的同时维护孩子的尊严。</p>

        <h2>二、文章主题：犯错之后，成年人怎样引导</h2>
        <h3>1. 犯错不是简单的“坏”</h3>
        <p>老师强调，孩子犯错背后常有复杂原因。《偷钱》中，“我”不是因为贫穷偷钱，而是因为想获得用钱自由，又不愿反复向大人解释。第一次偷钱后，“略微有些不安”，说明道德感并未消失，只是进入了模糊区。</p>

        <h3>2. 家人的处理方式</h3>
        <ul>
          <li><strong>母亲：</strong>发现后不可置信，但没有在弟妹面前羞辱孩子。</li>
          <li><strong>祖母：</strong>强调错误需要惩罚，但最后并未真正伤害孩子。</li>
          <li><strong>父亲：</strong>把孩子想买的乒乓球拍放在枕边，用一句“又不是不给他钱，一定要偷，多难为情”完成提醒。</li>
        </ul>

        <h3>3. 教育重点</h3>
        <p>这篇文章真正打动人的地方，不是孩子偷钱这个情节，而是家人在错误面前既有原则，又保留爱。老师把它概括为：<strong>定性错误、维护尊严、保留惩罚意识，同时让孩子感受到爱与宽容。</strong></p>
        <p>爱与包容不等于纵容。它的价值在于给孩子安全感，让他不必把注意力都放在辩解和反抗上，而能真正回到自己的错误本身。</p>

        <h2>三、文言文：《醉叟传》第一段整理</h2>
        <h3>1. 作者背景</h3>
        <p>袁宏道是晚明“公安派”代表人物，主张文章应有真性情，反对一味模拟古人。他的游记和人物传记都很有特色。《醉叟传》属于人物传记，写的是一个来历奇特、行为怪异的老者。</p>

        <h3>2. 标题和人物身份</h3>
        <p>“叟”是年老男子。“醉叟”就是经常喝醉的老者。标题可以理解为“醉酒老者的传记”。</p>
        <div class="quote-block">
          原文保护：醉叟者，不知何地人，亦不言其姓字，以其常醉，呼曰“醉叟”。<br />
          <span class="review-mark">[需复核：转写稿里出现“罪首、最手、醉手”等，按语境应为“醉叟”。]</span>
        </div>

        <h3>3. 字词解释</h3>
        <ul>
          <li><strong>何地：</strong>哪里。</li>
          <li><strong>姓字：</strong>姓名字号。</li>
          <li><strong>以：</strong>因为。</li>
          <li><strong>呼曰：</strong>称呼为。</li>
          <li><strong>可：</strong>大约，如“年可五十余”。</li>
          <li><strong>弟子：</strong>这里不是学生，指家中子弟、小辈。</li>
          <li><strong>酣沉：</strong>沉醉，喝得很深。</li>
        </ul>

        <h3>4. 人物形象</h3>
        <p>第一段重点写醉叟的神秘和怪异：不知来历，不知姓名，孤身一人，手提黄竹篮，整日沉醉，还以干蜈蚣等异物下酒。街市众人惊骇，反而更凸显人物的传奇色彩。</p>

        <h2>四、可复习问题</h2>
        <ol>
          <li>《偷钱》的明线和暗线分别是什么？</li>
          <li>母亲、祖母、父亲在处理孩子犯错时各自做了什么？</li>
          <li>为什么“爱与宽容”反而可能让孩子真正反思？</li>
          <li>《醉叟传》开头为什么不交代醉叟姓名和来历？</li>
          <li>“以其常醉，呼曰醉叟”如何翻译？</li>
        </ol>
      `,
      outline: `
        <h2>结构提纲版</h2>
        <ol>
          <li><strong>课程结构：</strong>《偷钱》阅读讲评 + 《醉叟传》文言文开篇。</li>
          <li><strong>核心概念：</strong>线索、明线、暗线。</li>
          <li><strong>《偷钱》明线：</strong>想用钱但不愿解释 → 偷拿铜元 → 侥幸未被发现 → 形成习惯 → 一次拿太多被发现。</li>
          <li><strong>《偷钱》暗线：</strong>孩子的欲望、道德模糊、侥幸心理、羞耻感、被爱与宽容唤起的反思。</li>
          <li><strong>教育主题：</strong>错误要被定性，但孩子的自尊也要被保护；爱与包容不是纵容，而是让反思发生。</li>
          <li><strong>家庭处理：</strong>母亲定性和保护尊严；祖母提示惩罚；父亲用乒乓球拍和一句话完成引导。</li>
          <li><strong>袁宏道：</strong>晚明公安派，强调性灵和真情，作品中常有奇人奇事。</li>
          <li><strong>《醉叟传》开头：</strong>不知来历姓名，因常醉而得名，人物登场带有神秘感。</li>
          <li><strong>文言重点：</strong>以=因为；可=大约；弟子=家中子弟；呼曰=称为。</li>
          <li><strong>复核重点：</strong>“醉叟”在转写稿中多次被误写为“罪首/最手/醉手”。</li>
        </ol>
      `,
    },
    cards: [
      {
        title: "明线与暗线",
        type: "阅读方法",
        summary: "明线是表层事件发展，暗线是隐藏的心理、情感或主题推进。",
        points: ["先找事件顺序", "再找心理变化", "最后概括主题作用"],
      },
      {
        title: "犯错后的教育",
        type: "主题卡",
        summary: "定性错误、维护尊严、保留爱与宽容，是《偷钱》讲评中的核心教育逻辑。",
        points: ["错误不能模糊", "不当众羞辱", "让孩子有安全感反思"],
      },
      {
        title: "醉叟人物登场",
        type: "文言文卡",
        summary: "《醉叟传》开头通过不知来历、常醉、孤身、怪食等细节塑造奇人形象。",
        points: ["不知何地人", "不言姓字", "以常醉得名", "手提黄竹篮"],
      },
      {
        title: "文言虚词：以",
        type: "字词卡",
        summary: "“以其常醉”中的“以”表示因为，是文言文常见用法。",
        points: ["以=因为", "注意结合上下文翻译", "不要机械翻成“用”"],
      },
    ],
    materials: [
      {
        title: "错误与宽容",
        type: "作文主题",
        summary: "孩子真正反思错误，常常不是在被猛烈指责时，而是在被原则和爱同时接住时。",
        examples: ["适合写成长、家庭教育、理解与反思", "可用《偷钱》中父亲放乒乓球拍的细节"],
      },
      {
        title: "神秘人物出场",
        type: "写作方法",
        summary: "先不交代来历姓名，而用习惯、外貌和怪异行为引出人物，可以制造悬念。",
        examples: ["不知何地人", "不言其姓字", "手提一黄竹篮"],
      },
    ],
    reviewItems: [
      "醉叟：原转写多处为“罪首/最手/醉手”，需核对讲义原文",
      "京、离：地名转写需核对原文",
      "近日酣沉：疑似应为“尽日酣沉”，需核对",
      "市儿：老师解释为街市年轻人/看热闹的人，需与原注释核对",
      "蜈蚣、蜘蛛、癞蛤蟆等异物下酒片段需核对原文",
      "课堂分享个人经历较长，学习整理版已大幅压缩",
    ],
  },
  "sample-essay": {
    title: "五上寒假第七讲",
    subtitle: "现代文阅读 + 作文点评",
    teacher: "张老师",
    type: "阅读作文",
    sourceFile: "五上-人文综合涵养-寒假-第七讲-阅读理解+作文点评2.docx",
    stats: "359 段 / 约 3.41 万字",
    reviewCount: 7,
    summary: "本课围绕现代文阅读六大题型展开，重点讲题型判断、回归文本、知识性术语；以《放学路上》讲概括题、引用作用、赏析题和比喻分析；后半点评学生写景作文，强调语言凝练、小短句、画面感和表达更新。",
    rawExcerpt: `
      <p>陈细影 00:00:01</p>
      <p>现代文阅读到这个阶段，大家应该形成一个清晰认知：核心逻辑三步走。第一，明确题型和角度；第二，回归文本找细节；第三，调动知识性术语。</p>
      <p>概括题答题三步走：明确答题区间，找原文关键词，参考已经填好部分的格式。</p>
      <p>作文点评部分，老师提醒：写景不能再用“温暖的春风吹来让人感到温暖”这类老套、重复、没有画面的表达。</p>
      <p class="review-mark">[原文疑似转写：“萧氏的放学路上”篇名需核对；“骨瘦如柴/骨瘦形销”片段需核对。]</p>
    `,
    versions: {
      clean: `
        <h2>一、现代文阅读：三步核心逻辑</h2>
        <p>老师先总结现代文阅读的核心逻辑：拿到题目后，第一步是明确题型和角度。要判断它属于概括题、分析题、作用题、含义理解题、赏析题，还是开放性试题。题型判断决定答题方向和答案结构。</p>
        <p>第二步是回归文本。每一道题都要立刻回到文章中寻找相关段落和细节，因为答案不能来自模糊印象，也不能靠脑洞发挥，而要来自原文的关键词、句子和抒情议论部分。</p>
        <p>第三步是调动知识性术语。比如环境描写、插叙、第一人称、引用、比喻、反复、表达效果等。看到题干中的术语，要能迅速对应答题套路。</p>
        <div class="quote-block">
          老师提醒：现代文阅读想要拿高分，就是题型、文本细节、知识术语三样东西的配合。
        </div>

        <h2>二、《放学路上》阅读讲评</h2>
        <p>文章开头引用儿歌“小小少年郎，背着书包上学堂……”，老师指出这是引用式开头，也带有画面情境。后文写下午四点半小学门口放学，私家车和家长把小街塞满，又与从前孩子自由放学路形成对比。</p>
        <p>老师特别讲到几个新鲜比喻：“小街像迅速冲胀的救生圈”“孩子像没纪律的麻雀”“放学路是大戏台、孵化器”。这些比喻不是单纯好看，而是信息丰富：放学路让孩子接触家庭和校园之外的世界，催生灵感、经验和作文素材。</p>
        <p>概括题部分，老师要求三步：明确区间、找原文关键词、参考已给格式。比如分析作者情感变化时，不能自己发明“厌恶”，而要回到原文找“惋惜”“庆幸”“悲哀”“无奈”“遗憾”等更贴近文本的词。</p>
        <p>引用作用题本质上接近赏析题。答题时先指出手法或特点，再解释内容，最后说明好处。引用儿歌可以丰富文章内容、吸引读者兴趣，也表达作者对儿时放学路的怀念。</p>
        <p>赏析“豪华笼子”“贵重行李”这类比喻时，不能简单写“家长囚禁孩子”。要推敲比喻内部信息：豪华说明物质条件好，笼子说明自由受限；贵重行李说明孩子被保护、被运送，也暗含失去自主行动的意味。</p>

        <h2>三、作文点评：语言要更新</h2>
        <p>后半节课点评学生写景作文。老师肯定部分作文有比喻、拟人、对比和细节，画面感比较突出；但也指出有些句子长、松、重复，需要做减法。</p>
        <p>例如“正在云雨中朦胧，把显得一去掉，跳跃感就出来”；“仿佛让人置身于清晨山林中”可以改成“如置身清晨山林中”。这类修改让语言变得凝练、有跳跃感。</p>
        <p>另一个反面例子是《初春》：“初春刚刚到来，大地结束了冰封，温暖的春风吹来，让人感到温暖。”老师指出这类表达重复、老套，没有新的观察，也没有落实本次写作要求。</p>
      `,
      study: `
        <h2>课程摘要</h2>
        <p>本课主要训练现代文阅读的答题意识，并把阅读方法迁移到作文表达。阅读部分强调：先判断题型，再回到原文找依据，最后调用知识性术语。讲评《放学路上》时，重点分析概括题、引用作用题、赏析题和比喻含义。作文点评部分则要求学生脱离老套写景语言，学习用小短句、凝练表达和有画面感的细节写作。</p>

        <h2>一、现代文阅读的三步法</h2>
        <h3>1. 明确题型和角度</h3>
        <p>现代文阅读常见题型包括概括题、分析题、作用题、含义理解题、赏析题和开放性试题。拿到题目时，先判断题型，再决定答题方向。</p>

        <h3>2. 回归文本找细节</h3>
        <p>答案要来自原文，不要凭模糊印象或自由发挥。尤其是概括题、情感变化题和作用题，都要先找到对应自然段和关键词。</p>

        <h3>3. 调动知识性术语</h3>
        <p>题干中的“表达效果”“引用”“第一人称”“环境描写”“插叙”等词，都是提醒你调用知识点。答题时既要有术语，也要结合文本内容。</p>

        <h2>二、《放学路上》讲评重点</h2>
        <h3>1. 文章主题</h3>
        <p>文章通过现在孩子被接送的放学场景，与过去自由、热闹、有经验的放学路形成对比，表达作者对童年自由经验消失的惋惜和怀念。</p>

        <h3>2. 概括题三步走</h3>
        <ol>
          <li><strong>明确答题区间：</strong>先判断这一空对应哪几段。</li>
          <li><strong>找原文关键词：</strong>优先使用原文中的抒情议论词。</li>
          <li><strong>参考已给格式：</strong>填空图表题要和前面答案保持格式一致。</li>
        </ol>
        <p>例：表示情感变化时，“厌恶”风险很高，因为原文没有这个词，也不符合整体情感。更合适的是“悲哀、无奈、遗憾、惋惜”。</p>

        <h3>3. 引用作用题</h3>
        <p>引用儿歌的作用可以从三点答：</p>
        <ul>
          <li>丰富文章内容，吸引读者阅读兴趣。</li>
          <li>引出“放学路上”这个话题。</li>
          <li>表达作者对儿时放学生活的怀念。</li>
        </ul>

        <h3>4. 赏析题答题结构</h3>
        <p>赏析题基本三步：指出手法或特点，解释手法内容，说明表达效果。比如“豪华笼子”“贵重行李”是比喻，既写出孩子物质条件优越，又写出他们被保护、被安排、失去自由活动空间。</p>

        <h2>三、作文点评：从老套写景到凝练表达</h2>
        <h3>1. 好作文的方向</h3>
        <p>好的写景作文不只是堆形容词，而要有观察、有画面、有手法。老师表扬的优点包括：比喻、拟人、对比丰富，细节描写突出，能够写出季节和景物的变化。</p>

        <h3>2. 语言做减法</h3>
        <p>有些句子不是内容不对，而是表达太松。可以删掉“显得”“仿佛让人”等拖慢节奏的词，让句子更紧致。</p>
        <div class="quote-block">
          修改方向：<br />
          “仿佛让人置身于清晨山林中” → “如置身清晨山林中”。<br />
          “星辰也隐藏其中” → 可压成“小短句”，让画面更跳跃。
        </div>

        <h3>3. 避免老套表达</h3>
        <p>“温暖的春风吹来，让人感到温暖”“真是一派万物复苏的景象”这类句子问题在于：重复、空泛、缺少新鲜观察，也没有体现刚学过的写作方法。</p>

        <h2>四、复习任务</h2>
        <ol>
          <li>背熟现代文阅读三步法：题型、文本、术语。</li>
          <li>用“区间—关键词—格式”重做一题概括题。</li>
          <li>整理引用、比喻、插叙、第一人称的作用套话。</li>
          <li>把自己作文中 3 个老套句子改成更凝练的表达。</li>
        </ol>
      `,
      outline: `
        <h2>结构提纲版</h2>
        <ol>
          <li><strong>课程主线：</strong>现代文阅读方法 → 《放学路上》题目讲评 → 作文语言点评。</li>
          <li><strong>阅读三步法：</strong>明确题型和角度；回归文本找细节；调动知识性术语。</li>
          <li><strong>概括题：</strong>定区间；找原文关键词；参考已给格式。</li>
          <li><strong>引用作用：</strong>丰富内容；吸引兴趣；引出话题；表达怀念。</li>
          <li><strong>赏析题：</strong>指出手法/特点；解释内容；说明好处。</li>
          <li><strong>比喻分析：</strong>不能只写“用了比喻”，要拆开喻体里的信息。</li>
          <li><strong>文章主题：</strong>放学路承载自由、经验、灵感和童年记忆。</li>
          <li><strong>作文优点：</strong>手法丰富、细节描写、画面感。</li>
          <li><strong>作文问题：</strong>表达重复、句子松散、语言老套、没有落实课堂方法。</li>
          <li><strong>修改方向：</strong>删废词；用短句；增强画面；挑战习惯表达。</li>
        </ol>
      `,
    },
    cards: [
      {
        title: "现代文阅读三步法",
        type: "阅读方法",
        summary: "先判断题型，再回到文本找依据，最后调用知识性术语组织答案。",
        points: ["明确题型", "回归文本", "调用术语"],
      },
      {
        title: "概括题三步走",
        type: "阅读方法",
        summary: "填空图表类概括题要先定区间，再找原文关键词，并对齐已有答案格式。",
        points: ["明确答题区间", "找原文关键词", "参考已给格式"],
      },
      {
        title: "引用的作用",
        type: "阅读方法",
        summary: "引用可以丰富内容、吸引兴趣、引出话题，也可能表达作者情感。",
        points: ["丰富文章内容", "吸引读者兴趣", "引出放学路话题", "表达怀念"],
      },
      {
        title: "作文语言做减法",
        type: "写作方法",
        summary: "删掉拖慢节奏的词，让语言更凝练、更有跳跃感。",
        points: ["删除重复", "压缩长句", "保留画面核心"],
      },
    ],
    materials: [
      {
        title: "放学路与童年自由",
        type: "主题素材",
        summary: "放学路是孩子离开家庭和校园后的开放空间，承载自由、冒险、经验和写作灵感。",
        examples: ["童年最大的快乐在路上", "放学路是精神发育的露天课堂"],
      },
      {
        title: "写景语言更新",
        type: "表达技巧",
        summary: "写景时要避免空泛套话，改用具体画面、短句和有新鲜感的比喻。",
        examples: ["如置身清晨山林中", "残叶像傍晚的彩霞"],
      },
      {
        title: "反面素材：老套春景",
        type: "反面素材",
        summary: "“温暖的春风让人感到温暖”“万物复苏”这类表达缺少观察和新意。",
        examples: ["重复用词", "抽象总结", "没有具体景物细节"],
      },
    ],
    reviewItems: [
      "篇名“萧氏的放学路上”疑似转写，需核对讲义",
      "“骨瘦如柴/骨瘦形销/古兽行销”片段需核对",
      "学生作文原句有多处转写噪声，已只保留可判断部分",
      "第 02:08 之后出现大量无意义转写，学习版默认删除",
      "个别学生姓名按原文转写保留风险较高，样例中已弱化",
    ],
  },
};

const cards = [
  {
    title: "阅读三步法",
    type: "阅读方法",
    summary: "先判断题型，再回到原文，最后调动知识术语组织答案。",
    points: ["明确题型和角度", "回归文本找细节", "调动知识性术语"],
  },
  {
    title: "概括题三步走",
    type: "阅读方法",
    summary: "填空图表题先定区间，再找原文关键词，最后对齐已给格式。",
    points: ["明确答题区间", "优先使用原文关键词", "参考已有格式"],
  },
  {
    title: "引用的作用",
    type: "阅读方法",
    summary: "引用能丰富文章内容、吸引阅读兴趣，并引出后文或表达情感。",
    points: ["丰富内容", "吸引兴趣", "引出话题"],
  },
  {
    title: "标题作用题",
    type: "阅读方法",
    summary: "从内容、结构、中心三方面回答标题的作用。",
    points: ["概括核心情节", "设置悬念或贯穿全文", "暗示文章中心"],
  },
  {
    title: "作文语言做减法",
    type: "写作方法",
    summary: "删掉松散的过渡词和老套表达，让语言更凝练、更有节奏。",
    points: ["减少废话", "形成短句节奏", "保留有画面感的词"],
  },
  {
    title: "景物描写的镜头感",
    type: "写作方法",
    summary: "通过视线移动、色彩变化和动静结合，让景物描写更有画面。",
    points: ["镜头推进", "抓住色彩", "动静结合"],
  },
];

const materials = [
  {
    title: "童年与自由",
    type: "主题素材",
    summary: "童年的快乐常常来自自由探索，而不是被安排好的安全路线。",
    examples: ["放学路是童年的大戏台", "被收起的风筝象征自由的消失"],
  },
  {
    title: "城市儿童的失去",
    type: "主题素材",
    summary: "城市生活给孩子更好的物质条件，也可能压缩自然经验和街巷经验。",
    examples: ["没有发小的一代", "没有老街生活的一代"],
  },
  {
    title: "短句节奏",
    type: "表达技巧",
    summary: "把“显得”“仿佛让人”等松散表达删掉，句子会更有力量。",
    examples: ["满庭荒凉", "残雪，是雪白的鸟儿"],
  },
  {
    title: "避免老套表达",
    type: "反面素材",
    summary: "避免“真是一派万物复苏”这类缺少画面和新鲜感的表达。",
    examples: ["温暖的春风吹来，让人感到温暖", "大自然的美好和神奇"],
  },
];

const reviewItems = [
  "疑似篇名：萧氏的放学路上",
  "疑似错字：骨瘦形销",
  "疑似错字：杈丫",
  "学生朗读片段无法准确判断",
  "开头会议杂音疑似转写错乱",
];

const versions = {
  clean: `
    <h2>一、现代文阅读的核心逻辑</h2>
    <p>现代文阅读的核心逻辑，老师把它概括成三步：先判断题型，再回归文本，最后调动知识性术语。题型判断决定答题方向，不同题型有不同的结构和注意点。</p>
    <p>做题时不能依靠模糊印象，也不能靠自己脑洞大开。答案的重要来源永远是原文细节。每一道题都要找到对应段落，尤其是概括题和赏析题。</p>
    <div class="quote-block">
      老师：做现代文阅读，题型、文本细节和知识术语三样东西要搭配起来。
    </div>
    <p>知识术语包括环境描写、插叙、第一人称、比喻、排比、引用、反复等。掌握这些术语，才能把答案写到采分点上。</p>
  `,
  study: `
    <h2>一、现代文阅读的核心逻辑</h2>
    <p>现代文阅读的核心逻辑可以整理为三步：<strong>明确题型</strong>、<strong>回归文本</strong>、<strong>调动知识术语</strong>。</p>
    <h3>1. 明确题型和角度</h3>
    <p>拿到题目后，先判断它属于概括题、分析题、作用题、含义理解题、赏析题，还是开放性试题。题型判断决定答题方向，也决定答案结构。</p>
    <h3>2. 回归文本，寻找细节</h3>
    <p>答案不能来自感觉，也不能靠自由发挥。每道题都要回到文章中寻找依据，尤其要找题目对应的自然段、关键词和抒情议论句。</p>
    <div class="quote-block">
      老师张老师：...现代文阅读不是凭印象答题，而是要回到原文里找依据。<br />
      学生李沐熙：我有时候知道意思，但写答案会飘。<br />
      <span class="review-mark">[待复核：骨瘦形销]</span>
    </div>
    <h3>3. 调动知识性术语</h3>
    <p>比如看到“表达效果”，就要想到作用题或赏析题；看到引用、比喻、排比等手法，就要调动对应套话，再结合内容、结构和中心作答。</p>
    <h3>二、作文点评：语言要做减法</h3>
    <p>作文点评部分强调，景物描写不能只堆词，还要让语言更凝练。删掉“显得”“仿佛让人”等松散表达，句子会更有节奏。</p>
  `,
  outline: `
    <h2>结构提纲</h2>
    <ol>
      <li>现代文阅读三步法：题型、文本、术语。</li>
      <li>概括题三步走：定区间、找关键词、对齐格式。</li>
      <li>赏析题：指出手法、解释手法、说明好处。</li>
      <li>标题作用题：内容、结构、中心。</li>
      <li>作文点评：景物描写要有画面，语言要做减法。</li>
    </ol>
  `,
};

let route = "workspace";
let currentCourseId = getCourseIdFromHash() || "sample-classical";
let version = "study";
let sideTab = "cards";
let assetTab = "methods";
let compareMode = false;
let compactMode = false;
let currentChunkId = "c01";
let showAllResources = false;
let chunkObserver = null;

const app = document.querySelector("#app");
const topbar = document.querySelector(".topbar");

function setRoute(nextRoute) {
  route = nextRoute;
  compareMode = false;
  updateNav();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("courses/")) return "detail";
  if (hash === "courses") return "courses";
  if (hash === "assets") return "assets";
  return "workspace";
}

function getCourseIdFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash.startsWith("courses/")) return "";
  return hash.split("/")[1] || "";
}

function activeLesson() {
  const base = lessonSamples[currentCourseId] || lessonSamples["sample-classical"];
  const full = window.fullLessonSamples?.[currentCourseId];
  if (!full) return base;
  return {
    ...base,
    sourceFile: full.sourceFile || base.sourceFile,
    stats: `${full.stats.paragraphs} 段 / 原文约 ${(full.stats.rawChars / 10000).toFixed(2)} 万字 / ${full.stats.chunks} 个处理块`,
    summary: `${base.summary} 当前页面已接入全文试处理结果：保真清洗版覆盖完整转写稿；学习整理版和结构提纲版按 ${full.stats.chunks} 个语义块合并生成。`,
    versions: full.versions,
    reviewItems: [...full.reviewItems, ...base.reviewItems],
    fullStats: full.stats,
    timing: full.timing,
    chunks: full.chunks,
  };
}

function versionTextLength(lesson, key) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = lesson.versions?.[key] || "";
  return wrapper.textContent.replace(/\s+/g, "").length;
}

function versionStats(lesson) {
  const raw = lesson.fullStats?.rawChars || 1;
  return {
    clean: { label: "保真清洗", chars: versionTextLength(lesson, "clean"), tone: "保留课堂顺序" },
    study: { label: "学习整理", chars: versionTextLength(lesson, "study"), tone: "默认阅读版" },
    outline: { label: "结构提纲", chars: versionTextLength(lesson, "outline"), tone: "快速复盘" },
    raw: { label: "原文", chars: raw, tone: "转写稿" },
  };
}

function formatChars(value) {
  if (value >= 10000) return `${(value / 10000).toFixed(2)} 万字`;
  return `${Math.max(1, Math.round(value / 100) * 100)} 字`;
}

function compressionText(chars, raw) {
  if (!raw) return "";
  return `约 ${Math.round((chars / raw) * 100)}%`;
}

function overviewKeywords(lesson) {
  if (currentCourseId === "sample-classical") return ["明线暗线", "犯错教育", "爱与宽容", "袁宏道", "醉叟传", "文言字词"];
  return ["阅读三步法", "概括题", "引用作用", "比喻赏析", "放学路", "写景语言"];
}

function overviewSummary(lesson) {
  if (currentCourseId === "sample-classical") {
    return "本课前半围绕吴祖光《偷钱》分析明线、暗线和儿童犯错后的家庭教育方式；后半进入袁宏道《醉叟传》，整理作者背景、人物传记写法和第一段字词翻译。适合复习线索结构、教育主题和文言文人物描写。";
  }
  return "本课围绕现代文阅读六大题型展开，重点训练题型判断、回归文本和知识性术语；后半结合学生写景作文，整理语言凝练、小短句和表达更新的方法。适合复习阅读答题与作文修改。";
}

function allCards() {
  return [...lessonSamples["sample-classical"].cards, ...lessonSamples["sample-essay"].cards, ...cards.slice(0, 2)];
}

function allMaterials() {
  return [...lessonSamples["sample-classical"].materials, ...lessonSamples["sample-essay"].materials, ...materials.slice(0, 1)];
}

function siblingCourseId(direction) {
  const sampleIds = ["sample-classical", "sample-essay"];
  const index = Math.max(0, sampleIds.indexOf(currentCourseId));
  if (direction === "next") return sampleIds[(index + 1) % sampleIds.length];
  return sampleIds[(index - 1 + sampleIds.length) % sampleIds.length];
}

function updateNav() {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === (route === "detail" ? "courses" : route));
  });
  topbar.dataset.tone = "paper";
}

function render() {
  app.className = `page-container${route === "detail" ? " detail-page-container" : ""}`;
  if (route === "courses") renderCourses();
  else if (route === "detail") renderDetail();
  else if (route === "assets") renderAssets();
  else renderWorkspace();
  setupChunkObserver();
}

function renderWorkspace() {
  app.innerHTML = `
    <section class="workspace-grid">
      <div class="upload-panel" id="uploadPanel">
        <div>
          <div class="upload-icon">⇧</div>
          <h1 class="upload-title">上传课堂转写 Word<br />生成学习资料</h1>
          <p class="muted">支持 .docx；生成保真清洗、学习整理和结构提纲。</p>
          <button class="button-primary" data-upload>选择 Word 文件</button>
        </div>
      </div>
      <div>
        <section class="progress-panel">
          <h2 class="section-heading">最近处理</h2>
          <p class="progress-title">正在整理：五上寒假第七讲</p>
          <div class="steps" id="steps">
            ${["解析 Word", "识别课型", "清洗转写稿", "生成学习版", "准备导出"]
              .map((text, index) => `<div class="step ${index < 3 ? "done" : index === 3 ? "current" : ""}"><span>${index < 3 ? "✓" : ""}</span><span>步骤${index + 1}：${text}</span></div>`)
              .join("")}
          </div>
          <button class="button-secondary" data-go-detail>查看课稿</button>
        </section>
        <section class="table-panel" style="margin-top:22px">
          <table class="history-table">
            <thead><tr><th>课程</th><th>课稿</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              ${courses.slice(0, 3).map((course) => `
                <tr>
                  <td>${course.title}</td>
                  <td>${course.subtitle}</td>
                  <td><span class="tag">${course.status}</span></td>
                  <td><button class="tiny-button" data-open-course="${course.id}">查看课稿</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  `;
}

function renderCourses() {
  app.innerHTML = `
    <section>
      <div class="page-title-row">
        <div>
          <p class="page-kicker">课程资料</p>
          <h1 class="page-title">课稿库</h1>
          <p class="muted">管理已上传、处理中和需要复核的课堂转写稿。</p>
        </div>
        <button class="button-primary" data-route="workspace">上传新课稿</button>
      </div>
      <div class="filter-panel">
        <input class="search-input" placeholder="搜索课程名、老师、课型" />
        <select class="select-input"><option>全部课型</option><option>阅读理解</option><option>作文点评</option><option>文言文</option></select>
        <select class="select-input"><option>全部状态</option><option>已完成</option><option>处理中</option><option>有待复核</option></select>
      </div>
      <section class="table-panel">
        <table class="history-table">
          <thead><tr><th>课程名</th><th>课型</th><th>状态</th><th>更新时间</th><th>待复核</th><th>操作</th></tr></thead>
          <tbody>
            ${courses.map((course) => `
              <tr>
                <td><strong>${course.title}</strong><br /><span class="muted">${course.subtitle} · ${course.teacher}</span></td>
                <td>${course.type}</td>
                <td><span class="tag">${course.status}</span></td>
                <td>${course.updated}</td>
                <td>${course.reviewCount ? `${course.reviewCount} 条` : "无"}</td>
                <td>
                  <button class="tiny-button" data-open-course="${course.id}">查看课稿</button>
                  <button class="tiny-button" data-export>导出</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    </section>
  `;
}

function renderDetail() {
  const lesson = activeLesson();
  app.innerHTML = `
    <section>
      <div class="detail-breadcrumb">
        <button class="button-ghost" data-route="courses">← 返回课稿列表</button>
        <button class="tiny-button" data-open-course="${siblingCourseId("prev")}">上一篇</button>
        <button class="tiny-button" data-open-course="${siblingCourseId("next")}">下一篇</button>
      </div>
      <div class="detail-header">
        <div>
          <p class="page-kicker">课程详情</p>
          <h1 class="page-title">课程：${lesson.title}｜讲师：${lesson.teacher}</h1>
          <div class="course-meta">
            <span class="tag">${lesson.subtitle}</span>
            <span class="tag">原始文件：${lesson.sourceFile}</span>
            <span class="tag">${lesson.stats}</span>
            <span class="tag">待复核 ${lesson.reviewCount} 条</span>
          </div>
        </div>
        <button class="button-primary" data-export>⇩ 导出 Word</button>
      </div>

      <div class="detail-layout">
        <article class="reading-panel ${compareMode ? "compare-on" : ""}">
          ${renderProcessingOverview(lesson)}
          ${renderLongTools(lesson)}
          ${compareMode ? renderCompare() : `<div class="reading-body ${compactMode ? "compact-long" : ""}"><div class="reading-content">${lesson.versions[version]}</div></div>`}
        </article>
      </div>
    </section>
  `;
}

function renderProcessingOverview(lesson) {
  const stat = lesson.fullStats;
  const timing = lesson.timing;
  const counts = resourceCountsForChunk(lesson, currentChunkId);
  return `
    <section class="source-summary">
      <div class="overview-card">
        <div class="overview-card-head">
          <p class="page-kicker">课程知识卡</p>
          <div class="overview-actions" aria-label="课程关联资源">
            <button class="tiny-button resource-button" data-open-resource-panel="cards">知识点 · <span data-resource-count="cards">${counts.cards}</span></button>
            <button class="tiny-button resource-button" data-open-resource-panel="materials">写作素材 · <span data-resource-count="materials">${counts.materials}</span></button>
            <button class="tiny-button resource-button" data-open-resource-panel="review">待复核 · <span data-resource-count="review">${counts.review}</span></button>
          </div>
        </div>
        <h2>${lesson.title}：${lesson.subtitle}</h2>
        <p>${overviewSummary(lesson)}</p>
        <div class="keyword-row">
          ${overviewKeywords(lesson).map((keyword) => `<button class="keyword-chip" data-open-resource-panel="cards">${keyword}</button>`).join("")}
        </div>
      </div>
      ${stat ? `
        <div class="process-meta">
          <span>原文 ${(stat.rawChars / 10000).toFixed(2)} 万字</span>
          <span>${stat.chunks} 个正文分段</span>
          <span>本地 ${timing.totalSeconds}s</span>
          <span>AI 精修约 6-15 分钟</span>
        </div>
      ` : ""}
    </section>
  `;
}

function renderLongTools(lesson) {
  if (!lesson.fullStats) return "";
  const stats = versionStats(lesson);
  const rawChars = stats.raw.chars;
  return `
    <section class="sticky-control-bar">
      <div class="version-segment" aria-label="正文版本">
        ${["clean", "study", "outline"].map((key) => `
          <button class="${version === key ? "active" : ""}" data-version="${key}">
            <strong>${stats[key].label}</strong>
            <span>${formatChars(stats[key].chars)} · ${compressionText(stats[key].chars, rawChars)}</span>
          </button>
        `).join("")}
      </div>
      <button class="button-secondary compare-action ${compareMode ? "active" : ""}" data-toggle-compare>
        对照原文 <span>原文 ${formatChars(stats.raw.chars)}</span>
      </button>
      <div class="control-actions">
        <details class="chapter-menu">
          <summary>章节目录 <span class="current-chunk-label">${currentChunkId.toUpperCase()}</span></summary>
          <div class="chapter-menu-list">
            ${lesson.chunks.map((chunk) => `
              <button class="${chunk.id === currentChunkId ? "active" : ""}" data-jump-chunk="${chunk.id}">
                <strong>${chunk.id.toUpperCase()}</strong>
                <span>${chunk.title}</span>
                <small>段落 ${chunk.startPara}-${chunk.endPara} · ${chunk.chars} 字</small>
              </button>
            `).join("")}
          </div>
        </details>
        <button class="tiny-button" data-toggle-compact>${compactMode ? "查看完整正文" : "只看段落标题"}</button>
      </div>
    </section>
    <aside class="floating-toc-sidebar" id="chunkToc" aria-label="正文分段导航">
        <button class="toc-home" data-scroll-top title="回到首屏">
          <strong>顶</strong><span>回到首屏</span>
        </button>
        ${lesson.chunks.map((chunk) => `
          <button class="${chunk.id === currentChunkId ? "active" : ""}" data-jump-chunk="${chunk.id}" title="${chunk.title}">
            <strong>${chunk.id.toUpperCase()}</strong>
            <span>${chunk.title}</span>
            <small>段落 ${chunk.startPara}-${chunk.endPara} · ${chunk.chars} 字</small>
          </button>
        `).join("")}
    </aside>
    <div class="quick-scroll-rail" aria-label="快速滚动">
      <button class="rail-edge" data-scroll-top title="回到首屏">↑</button>
      <input class="quick-scroll-range" data-scroll-range type="range" min="0" max="100" value="0" aria-label="拖动快速浏览正文" />
      <div class="rail-dots">
        ${lesson.chunks.map((chunk) => `<button class="${chunk.id === currentChunkId ? "active" : ""}" data-jump-chunk="${chunk.id}" title="${chunk.id.toUpperCase()} ${chunk.title}"></button>`).join("")}
      </div>
      <button class="rail-edge" data-scroll-bottom title="到底部">↓</button>
    </div>
  `;
}

function renderCompare() {
  const lesson = activeLesson();
  const chunk = lesson.chunks?.find((item) => item.id === currentChunkId) || lesson.chunks?.[0];
  const rightHtml = sectionHtmlForChunk(lesson.versions[version], currentChunkId);
  return `
    <div class="compare-view">
      <section class="compare-col">
        <h3>原始转写稿｜${(chunk?.id || currentChunkId).toUpperCase()}</h3>
        <p class="muted">当前只对照正在阅读的正文分段，避免整篇左右滚动错位。</p>
        ${chunk?.rawHtml || lesson.rawExcerpt}
      </section>
      <section class="compare-col">
        <h3>当前整理版｜${versionLabel(version)}</h3>
        <div class="reading-content">${rightHtml}</div>
      </section>
    </div>
  `;
}

function versionLabel(value) {
  return {
    clean: "保真清洗",
    study: "学习整理",
    outline: "结构提纲",
  }[value] || "学习整理";
}

function sectionHtmlForChunk(versionHtml, chunkId) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = versionHtml;
  const section = wrapper.querySelector(`#${chunkId}`);
  return section ? section.outerHTML : versionHtml;
}

function resourceChunkId(lesson, index, kind) {
  const chunkIds = lesson.chunks?.map((chunk) => chunk.id) || ["c01"];
  const presets = {
    cards: ["c01", "c02", "c03", "c06", "c09"],
    materials: ["c02", "c04", "c09"],
    review: ["c01", "c03", "c08", "c09"],
  };
  const list = presets[kind] || chunkIds;
  return list[index % list.length] || chunkIds[index % chunkIds.length] || "c01";
}

function lessonResources(lesson, kind) {
  if (kind === "materials") {
    return lesson.materials.map((item, index) => ({ ...item, kind: "material", chunkId: resourceChunkId(lesson, index, "materials") }));
  }
  if (kind === "review") {
    return lesson.reviewItems.map((text, index) => ({
      title: text,
      type: "待复核",
      summary: "点击定位到相关正文分段，正式版会进一步定位到具体句子。",
      kind: "review",
      chunkId: resourceChunkId(lesson, index, "review"),
    }));
  }
  return lesson.cards.map((item, index) => ({ ...item, kind: "card", chunkId: resourceChunkId(lesson, index, "cards") }));
}

function scopedResources(lesson, kind) {
  const items = lessonResources(lesson, kind);
  if (showAllResources) return items;
  const current = items.filter((item) => item.chunkId === currentChunkId);
  return current.length ? current : items.slice(0, Math.min(3, items.length));
}

function resourceCountsForChunk(lesson, chunkId) {
  return {
    cards: lessonResources(lesson, "cards").filter((item) => item.chunkId === chunkId).length,
    materials: lessonResources(lesson, "materials").filter((item) => item.chunkId === chunkId).length,
    review: lessonResources(lesson, "review").filter((item) => item.chunkId === chunkId).length,
  };
}

function renderSideContent() {
  const lesson = activeLesson();
  const scopeText = showAllResources ? "全文相关" : `${currentChunkId.toUpperCase()} 当前分段`;
  if (sideTab === "materials") {
    const items = scopedResources(lesson, "materials");
    return `<h3>写作素材 · ${scopeText}</h3><div class="mini-list">${items.map((item, index) => resourceItem(item, index)).join("")}</div>`;
  }
  if (sideTab === "review") {
    const items = scopedResources(lesson, "review");
    return `<h3>待复核 · ${scopeText}</h3><div class="mini-list">${items.map((item, index) => resourceItem(item, index)).join("")}</div>`;
  }
  const items = scopedResources(lesson, "cards");
  return `<h3>知识点 · ${scopeText}</h3><div class="mini-list">${items.map((item, index) => resourceItem(item, index)).join("")}</div>`;
}

function resourceItem(item, index) {
  return `
    <div class="mini-item resource-item">
      <div>
        <h4>${item.title}</h4>
        <p>${item.summary}</p>
        <span class="tag">${item.chunkId.toUpperCase()}</span>
      </div>
      <button class="tiny-button" data-jump-chunk="${item.chunkId}">定位</button>
    </div>
  `;
}

function miniItem(item, index, kind) {
  return `
    <div class="mini-item" data-open-drawer="${kind}" data-index="${index}">
      <h4>${item.title}</h4>
      <p>${item.summary}</p>
    </div>
  `;
}

function renderAssets() {
  const source = assetTab === "materials" ? allMaterials() : assetTab === "words" ? wordsData() : allCards();
  app.innerHTML = `
    <section class="asset-page">
      <p class="page-kicker">知识沉淀</p>
      <h1 class="page-title">知识资产库</h1>
      <div class="asset-tabs">
        <button class="${assetTab === "methods" ? "active" : ""}" data-asset-tab="methods">知识点库</button>
        <button class="${assetTab === "words" ? "active" : ""}" data-asset-tab="words">词汇生词本</button>
        <button class="${assetTab === "materials" ? "active" : ""}" data-asset-tab="materials">写作素材库</button>
      </div>
      <div class="asset-grid">
        ${source.map((item, index) => `
          <article class="asset-card" data-open-drawer="${assetTab === "materials" ? "material" : "card"}" data-index="${index}">
            <h3>${assetTab === "words" ? "词：" : assetTab === "materials" ? "素材：" : "知识点："}${item.title}</h3>
            <span class="tag">${item.type}</span>
            <p><strong>详解：</strong>${item.summary}</p>
            <h4>关键重点</h4>
            <ul>${(item.points || item.examples || ["来源课程：五上寒假第七讲"]).map((point) => `<li>${point}</li>`).join("")}</ul>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function wordsData() {
  return [
    { title: "骨瘦形销", type: "词汇", summary: "形容身体极其消瘦。样本中有疑似转写错误，需要复核。", points: ["适合作文景物或人物描写", "注意字形：销"] },
    { title: "杈丫", type: "词汇", summary: "树枝分岔的样子，可用于描写冬日枝干。", points: ["常用于景物描写", "与“枝丫”意义接近"] },
    { title: "虚怀若谷", type: "词汇", summary: "形容非常谦虚，胸怀像山谷一样深广。", points: ["可用于议论文素材", "注意不要滥用"] },
    { title: "错落有致", type: "词汇", summary: "形容布局、景物等高低疏密有秩序。", points: ["适合写景", "可与镜头感搭配"] },
    { title: "光影斑驳", type: "词汇", summary: "描写光线和影子交错的画面。", points: ["适合描写树影、窗影", "画面感强"] },
    { title: "凝练", type: "写作术语", summary: "语言简洁、有力量，不拖泥带水。", points: ["删掉过渡词", "保留核心画面"] },
  ];
}

function openDrawer(kind, index) {
  const lesson = activeLesson();
  const source = kind === "material" ? lesson.materials : lesson.cards;
  const data = source[index] || (kind === "material" ? allMaterials()[index] : allCards()[index]) || wordsData()[index];
  if (!data) return;
  const drawer = document.querySelector("#infoDrawer");
  const content = document.querySelector("#drawerContent");
  content.innerHTML = `
    <p class="page-kicker">${data.type}</p>
    <h2>${data.title}</h2>
    <p class="muted">${data.summary}</p>
    <div class="drawer-section">
      <h3>${kind === "material" ? "可用表达" : "关键重点"}</h3>
      <ul>${(data.points || data.examples || []).map((point) => `<li>${point}</li>`).join("")}</ul>
    </div>
    <div class="drawer-section">
      <h3>来源课程</h3>
      <p>${lesson.title}：${lesson.subtitle}</p>
      <button class="button-secondary" data-open-course="${currentCourseId}">查看来源课程</button>
    </div>
  `;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function openResourcePanel(tab = "cards") {
  sideTab = tab;
  const drawer = document.querySelector("#infoDrawer");
  const content = document.querySelector("#drawerContent");
  const title = tab === "materials" ? "写作素材" : tab === "review" ? "待复核" : "知识点";
  content.innerHTML = `
    <p class="page-kicker">关联资源</p>
    <h2>${title}</h2>
    <p class="muted">默认显示 ${currentChunkId.toUpperCase()} 当前分段相关内容；可切换查看全文资源。</p>
    <button class="button-secondary resource-scope-toggle" data-toggle-resource-scope>${showAllResources ? "只看当前分段" : "查看全文资源"}</button>
    ${renderSideContent()}
  `;
  drawer.classList.add("open", "wide");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  const drawer = document.querySelector("#infoDrawer");
  drawer.classList.remove("open", "wide");
  drawer.setAttribute("aria-hidden", "true");
}

function setupChunkObserver() {
  if (chunkObserver) {
    chunkObserver.disconnect();
    chunkObserver = null;
  }
  if (route !== "detail" || compareMode) return;
  const sections = [...document.querySelectorAll(".long-section[id], .outline-chunk[id]")];
  if (!sections.length) return;
  chunkObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible?.target?.id || visible.target.id === currentChunkId) return;
    currentChunkId = visible.target.id;
    updateChunkContext();
  }, { rootMargin: "-38% 0px -48% 0px", threshold: [0.12, 0.3, 0.6] });
  sections.forEach((section) => chunkObserver.observe(section));
  updateChunkContext();
}

function updateChunkContext() {
  const lesson = activeLesson();
  const counts = resourceCountsForChunk(lesson, currentChunkId);
  document.querySelectorAll(".current-chunk-label").forEach((node) => {
    node.textContent = currentChunkId.toUpperCase();
  });
  document.querySelectorAll("[data-resource-count='cards']").forEach((node) => { node.textContent = counts.cards; });
  document.querySelectorAll("[data-resource-count='materials']").forEach((node) => { node.textContent = counts.materials; });
  document.querySelectorAll("[data-resource-count='review']").forEach((node) => { node.textContent = counts.review; });
  document.querySelectorAll("[data-jump-chunk]").forEach((node) => {
    node.classList.toggle("active", node.dataset.jumpChunk === currentChunkId);
  });
  syncQuickScroll();
}

function scrollToDetailTop() {
  const firstChunkId = activeLesson().chunks?.[0]?.id;
  if (firstChunkId) currentChunkId = firstChunkId;
  if (compareMode) renderDetail();
  else updateChunkContext();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToDetailBottom() {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
}

function syncQuickScroll() {
  const range = document.querySelector("[data-scroll-range]");
  if (!range) return;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  range.value = Math.round((window.scrollY / maxScroll) * 100);
}

function scrollByRatio(value) {
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo({ top: maxScroll * (Number(value) / 100), behavior: "auto" });
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1900);
}

function openExport() {
  const modal = document.querySelector("#exportModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeExport() {
  const modal = document.querySelector("#exportModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function simulateUpload() {
  showToast("已模拟上传，正在生成整理结果");
  setTimeout(() => {
    window.location.hash = "#/courses/sample-essay";
  }, 650);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-route], [data-open-course], [data-version], [data-side-tab], [data-asset-tab], [data-toggle-compare], [data-toggle-compact], [data-toggle-resource-scope], [data-jump-chunk], [data-jump-toc], [data-scroll-top], [data-scroll-bottom], [data-open-resource-panel], [data-export], [data-close-modal], [data-open-drawer], [data-close-drawer], [data-upload], [data-go-detail], [data-toast]");
  if (!target) return;

  if (target.dataset.route) window.location.hash = `#/${target.dataset.route}`;
  if (target.dataset.openCourse) window.location.hash = `#/courses/${target.dataset.openCourse}`;
  if (target.dataset.version) {
    version = target.dataset.version;
    renderDetail();
  }
  if (target.dataset.sideTab) {
    sideTab = target.dataset.sideTab;
    renderDetail();
  }
  if (target.dataset.assetTab) {
    assetTab = target.dataset.assetTab;
    renderAssets();
  }
  if (target.dataset.toggleCompare !== undefined) {
    compareMode = !compareMode;
    renderDetail();
  }
  if (target.dataset.toggleCompact !== undefined) {
    compactMode = !compactMode;
    renderDetail();
  }
  if (target.dataset.toggleResourceScope !== undefined) {
    showAllResources = !showAllResources;
    openResourcePanel(sideTab);
  }
  if (target.dataset.jumpChunk) {
    currentChunkId = target.dataset.jumpChunk;
    if (compareMode) {
      renderDetail();
      return;
    }
    const node = document.querySelector(`#${target.dataset.jumpChunk}`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
    updateChunkContext();
  }
  if (target.dataset.jumpToc !== undefined) {
    const node = document.querySelector("#chunkToc");
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (target.dataset.scrollTop !== undefined) scrollToDetailTop();
  if (target.dataset.scrollBottom !== undefined) scrollToDetailBottom();
  if (target.dataset.export !== undefined) openExport();
  if (target.dataset.closeModal !== undefined) closeExport();
  if (target.dataset.openDrawer) openDrawer(target.dataset.openDrawer, Number(target.dataset.index || 0));
  if (target.dataset.openResourcePanel) openResourcePanel(target.dataset.openResourcePanel);
  if (target.dataset.closeDrawer !== undefined) closeDrawer();
  if (target.dataset.upload !== undefined || target.dataset.goDetail !== undefined) simulateUpload();
  if (target.dataset.toast) showToast(target.dataset.toast);
});

document.addEventListener("input", (event) => {
  const target = event.target.closest("[data-scroll-range]");
  if (!target) return;
  scrollByRatio(target.value);
});

let scrollSyncFrame = null;
window.addEventListener("scroll", () => {
  if (route !== "detail" || scrollSyncFrame) return;
  scrollSyncFrame = requestAnimationFrame(() => {
    scrollSyncFrame = null;
    syncQuickScroll();
  });
}, { passive: true });

document.querySelector("#exportModal").addEventListener("click", (event) => {
  if (event.target.id === "exportModal") closeExport();
});

window.addEventListener("hashchange", () => {
  route = parseHash();
  const nextCourseId = getCourseIdFromHash() || currentCourseId || "sample-classical";
  if (nextCourseId !== currentCourseId) {
    currentChunkId = "c01";
    showAllResources = false;
    compareMode = false;
  }
  currentCourseId = nextCourseId;
  updateNav();
  render();
});

route = parseHash();
currentCourseId = getCourseIdFromHash() || currentCourseId;
updateNav();
render();
