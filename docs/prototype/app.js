const courses = [
  {
    id: "lesson-7",
    title: "五上寒假第七讲",
    subtitle: "阅读理解 + 作文点评",
    teacher: "张老师",
    type: "混合课",
    status: "已完成",
    updated: "今天 15:20",
    reviewCount: 5,
  },
  {
    id: "lesson-6",
    title: "五上寒假第六讲",
    subtitle: "文言文阅读训练",
    teacher: "陈老师",
    type: "文言文",
    status: "已完成",
    updated: "昨天 21:10",
    reviewCount: 3,
  },
  {
    id: "lesson-8",
    title: "五上秋季第八讲",
    subtitle: "古诗词讲评",
    teacher: "陈老师",
    type: "古诗词",
    status: "有复核",
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
let version = "study";
let sideTab = "cards";
let assetTab = "methods";
let compareMode = false;

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

function updateNav() {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === (route === "detail" ? "courses" : route));
  });
  topbar.dataset.tone = route === "workspace" ? "red" : "paper";
}

function render() {
  if (route === "courses") renderCourses();
  else if (route === "detail") renderDetail();
  else if (route === "assets") renderAssets();
  else renderWorkspace();
}

function renderWorkspace() {
  app.innerHTML = `
    <section class="workspace-grid">
      <div class="upload-panel" id="uploadPanel">
        <div>
          <div class="upload-icon">⇧</div>
          <h1 class="upload-title">将课堂转写 Word<br />拖拽至此上传</h1>
          <p class="muted">支持 .docx，原型中使用假数据模拟处理流程。</p>
          <button class="button-primary" data-upload>选择 Word 文件</button>
        </div>
      </div>
      <div>
        <section class="progress-panel">
          <h2 class="section-heading">处理进度与历史记录</h2>
          <p class="progress-title">正在清洗：五上寒假第七讲</p>
          <div class="steps" id="steps">
            ${["练习读写", "教程进度", "知识与新效率", "整理辅导", "整理结果"]
              .map((text, index) => `<div class="step ${index < 3 ? "done" : index === 3 ? "current" : ""}"><span>${index < 3 ? "✓" : ""}</span><span>步骤${index + 1}：${text}</span></div>`)
              .join("")}
          </div>
          <button class="button-secondary" data-go-detail>查看当前整理结果</button>
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
                  <td><button class="tiny-button" data-open-course="${course.id}">查看整理结果</button></td>
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
          <h1 class="page-title">课稿列表</h1>
          <p class="muted">查看已处理课程、处理中任务和需要复核的课稿。</p>
        </div>
        <button class="button-primary" data-route="workspace">上传新课稿</button>
      </div>
      <div class="filter-panel">
        <input class="search-input" placeholder="搜索课程名、老师、课型" />
        <select class="select-input"><option>全部课型</option><option>阅读理解</option><option>作文点评</option><option>文言文</option></select>
        <select class="select-input"><option>全部状态</option><option>已完成</option><option>处理中</option><option>有复核</option></select>
      </div>
      <section class="table-panel">
        <table class="history-table">
          <thead><tr><th>课程名</th><th>课型</th><th>状态</th><th>更新时间</th><th>复核</th><th>操作</th></tr></thead>
          <tbody>
            ${courses.map((course) => `
              <tr>
                <td><strong>${course.title}</strong><br /><span class="muted">${course.subtitle} · ${course.teacher}</span></td>
                <td>${course.type}</td>
                <td><span class="tag">${course.status}</span></td>
                <td>${course.updated}</td>
                <td>${course.reviewCount ? `${course.reviewCount} 条` : "无"}</td>
                <td>
                  <button class="tiny-button" data-open-course="${course.id}">查看</button>
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
  app.innerHTML = `
    <section>
      <div class="detail-header">
        <div>
          <p class="page-kicker">课程详情</p>
          <h1 class="page-title">课程：五上寒假第七讲｜讲师：张老师</h1>
          <div class="course-meta">
            <span class="tag">阅读理解 + 作文点评</span>
            <span class="tag">原始文件：第七讲.docx</span>
            <span class="tag">复核标记 5 条</span>
          </div>
        </div>
        <button class="button-primary" data-export>⇩ 导出 Word</button>
      </div>

      <div class="detail-layout">
        <article class="reading-panel ${compareMode ? "compare-on" : ""}">
          <div class="version-tabs">
            <button class="${version === "clean" ? "active" : ""}" data-version="clean">保真清洗版</button>
            <button class="${version === "study" ? "active" : ""}" data-version="study">学习整理版</button>
            <button class="${version === "outline" ? "active" : ""}" data-version="outline">结构提纲版</button>
            <button class="compare-toggle" data-toggle-compare>
              <span>原文对照</span><span class="switch"></span>
            </button>
          </div>
          ${compareMode ? renderCompare() : `<div class="reading-body"><div class="reading-content">${versions[version]}</div></div>`}
        </article>
        <aside class="side-panel">
          <section class="side-card">
            <div class="side-tabs">
              <button class="${sideTab === "cards" ? "active" : ""}" data-side-tab="cards">卡片</button>
              <button class="${sideTab === "materials" ? "active" : ""}" data-side-tab="materials">素材</button>
              <button class="${sideTab === "review" ? "active" : ""}" data-side-tab="review">复核</button>
            </div>
            ${renderSideContent()}
          </section>
        </aside>
      </div>
    </section>
  `;
}

function renderCompare() {
  return `
    <div class="compare-view">
      <section class="compare-col">
        <h3>原始转写稿</h3>
        <p>陈细影 00:00:01</p>
        <p>都一样。可以给看来。共就六大题型。能点评调啊。好。这个回去二三两篇做下来，感觉难度如何啊？</p>
        <p>现代文阅读啊，到这个阶段大家应该形成一个清晰的认知，核心逻辑到底是什么，我们把它简化一下，三步走。</p>
        <p>一拿到题目第一步就是明确题型和角度，第二回归文本找细节，第三知识性术语要掌握扎实。</p>
      </section>
      <section class="compare-col">
        <h3>当前整理版本</h3>
        <div class="reading-content">${versions[version]}</div>
      </section>
    </div>
  `;
}

function renderSideContent() {
  if (sideTab === "materials") {
    return `<h3>作文素材</h3><div class="mini-list">${materials.map((item, index) => miniItem(item, index, "material")).join("")}</div>`;
  }
  if (sideTab === "review") {
    return `<h3>复核标记</h3><div class="mini-list">${reviewItems.map((text, index) => `<div class="mini-item" data-toast="已定位到复核项 ${index + 1}"><h4>${text}</h4><p>点击后可在正文中查看上下文。</p></div>`).join("")}</div>`;
  }
  return `<h3>知识卡片</h3><div class="mini-list">${cards.slice(0, 5).map((item, index) => miniItem(item, index, "card")).join("")}</div>`;
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
  const source = assetTab === "materials" ? materials : assetTab === "words" ? wordsData() : cards;
  app.innerHTML = `
    <section class="asset-page">
      <p class="page-kicker">轻量沉淀</p>
      <h1 class="page-title">知识资产库</h1>
      <div class="asset-tabs">
        <button class="${assetTab === "methods" ? "active" : ""}" data-asset-tab="methods">方法卡片库</button>
        <button class="${assetTab === "words" ? "active" : ""}" data-asset-tab="words">词汇生词本</button>
        <button class="${assetTab === "materials" ? "active" : ""}" data-asset-tab="materials">佳句素材册</button>
      </div>
      <div class="asset-grid">
        ${source.map((item, index) => `
          <article class="asset-card" data-open-drawer="${assetTab === "materials" ? "material" : "card"}" data-index="${index}">
            <h3>${assetTab === "words" ? "词：" : assetTab === "materials" ? "素材：" : "卡片："}${item.title}</h3>
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
  const data = kind === "material" ? materials[index] : cards[index] || wordsData()[index];
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
      <p>五上寒假第七讲：阅读理解 + 作文点评</p>
      <button class="button-secondary" data-open-course="lesson-7">查看来源课程</button>
    </div>
  `;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  const drawer = document.querySelector("#infoDrawer");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
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
    window.location.hash = "#/courses/lesson-7";
  }, 650);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-route], [data-open-course], [data-version], [data-side-tab], [data-asset-tab], [data-toggle-compare], [data-export], [data-close-modal], [data-open-drawer], [data-close-drawer], [data-upload], [data-go-detail], [data-toast]");
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
  if (target.dataset.export !== undefined) openExport();
  if (target.dataset.closeModal !== undefined) closeExport();
  if (target.dataset.openDrawer) openDrawer(target.dataset.openDrawer, Number(target.dataset.index || 0));
  if (target.dataset.closeDrawer !== undefined) closeDrawer();
  if (target.dataset.upload !== undefined || target.dataset.goDetail !== undefined) simulateUpload();
  if (target.dataset.toast) showToast(target.dataset.toast);
});

document.querySelector("#exportModal").addEventListener("click", (event) => {
  if (event.target.id === "exportModal") closeExport();
});

window.addEventListener("hashchange", () => {
  route = parseHash();
  updateNav();
  render();
});

route = parseHash();
updateNav();
render();
