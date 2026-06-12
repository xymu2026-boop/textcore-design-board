import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  getCourse,
  listCourses,
  requestExport,
  subscribeCourseEvents,
  uploadCourse,
} from "./api/client";
import type {
  ClassicsRef,
  CourseListItem,
  CourseState,
  CourseStatus,
  KnowledgeCard,
  OutlineNode,
  ReviewFlag,
  StatusEvent,
  WritingMaterial,
} from "./api/types";
import {
  DEFAULT_VERSION,
  VERSION_LABELS,
  VERSION_TIERS,
  type VersionKey,
  isVersionKey,
} from "./constants/versions";

type Route =
  | { name: "workspace" }
  | { name: "courses" }
  | { name: "detail"; courseId: string }
  | { name: "assets" };

type DrawerState =
  | { kind: "card"; item: KnowledgeCard }
  | { kind: "material"; item: WritingMaterial }
  | { kind: "classics"; item: ClassicsRef }
  | { kind: "insight"; item: KeywordInsight }
  | { kind: "resource-panel"; tab: "cards" | "materials" | "review"; course: CourseState }
  | null;

type UploadState = {
  fileName?: string;
  courseId?: string;
  status: "idle" | "uploading" | "processing" | "completed" | "failed" | "interrupted";
  progress: number;
  message?: string;
  events: StatusEvent[];
};

type LoadStatus = "idle" | "loading" | "success" | "error";

type DetailError = {
  title: string;
  message: string;
  canRetry: boolean;
};

type ChunkNavItem = {
  id: string;
  label: string;
  title: string;
  meta: string;
};

type KeywordInsight = {
  id: string;
  kind: "theme" | "author" | "work";
  label: string;
  kicker: string;
  title: string;
  subtitle?: string;
  summary: string;
  quote?: string;
  source?: string;
  sourceCourse?: string;
  fields?: Array<{ label: string; value: string }>;
  relatedDrawer?: DrawerState;
};

const NAV_ITEMS = [
  { path: "/", key: "workspace", label: "工作台" },
  { path: "/courses", key: "courses", label: "课稿库" },
  { path: "/assets", key: "assets", label: "知识资产" },
] as const;

const STATUS_LABELS: Record<CourseStatus, string> = {
  created: "已创建",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
  needs_human: "有待复核",
};

const STATUS_HINTS: Partial<Record<CourseStatus, string>> = {
  created: "等待处理",
  processing: "正在生成，暂不可导出",
  failed: "处理失败",
};

const INITIAL_UPLOAD_STATE: UploadState = {
  status: "idle",
  progress: 0,
  events: [],
};

function parseRoute(): Route {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  if (pathname === "/courses") return { name: "courses" };
  if (pathname.startsWith("/courses/")) {
    return { name: "detail", courseId: decodeURIComponent(pathname.slice("/courses/".length)) };
  }
  if (pathname === "/assets") return { name: "assets" };
  return { name: "workspace" };
}

function routePath(route: Route): string {
  if (route.name === "courses") return "/courses";
  if (route.name === "detail") return `/courses/${encodeURIComponent(route.courseId)}`;
  if (route.name === "assets") return "/assets";
  return "/";
}

function navigateTo(route: Route) {
  const path = routePath(route);
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute());

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return route;
}

function htmlFromBody(input: string | undefined): string {
  if (!input) return "<p>后端尚未返回该版本正文。</p>";
  const trimmed = input.trim();
  if (trimmed.startsWith("<")) return trimmed;

  const lines = trimmed.split(/\n+/);
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.join("")}</ul>`);
      listItems = [];
    }
  };

  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      flushList();
      return;
    }
    if (text.startsWith("## ")) {
      flushList();
      blocks.push(`<h2>${escapeHtml(text.slice(3))}</h2>`);
      return;
    }
    if (text.startsWith("### ")) {
      flushList();
      blocks.push(`<h3>${escapeHtml(text.slice(4))}</h3>`);
      return;
    }
    if (/^[-*]\s/.test(text)) {
      listItems.push(`<li>${escapeHtml(text.replace(/^[-*]\s/, ""))}</li>`);
      return;
    }
    flushList();
    blocks.push(`<p>${escapeHtml(text)}</p>`);
  });

  flushList();
  return blocks.join("");
}

function anchoredHtmlFromBody(input: string | undefined, navItems: ChunkNavItem[]): string {
  const html = htmlFromBody(input);
  if (!navItems.length || typeof DOMParser === "undefined") return html;

  const document = new DOMParser().parseFromString(html, "text/html");
  const body = document.body;
  const ids = navItems.map((item) => item.id);
  const existingAnchors = ids
    .map((id) => body.querySelector(`#${cssIdentifier(id)}`))
    .filter((node): node is Element => Boolean(node));

  if (existingAnchors.length > 0) {
    existingAnchors.forEach((node) => {
      if (node.tagName === "LI") node.classList.add("outline-chunk");
      else node.classList.add("long-section");
    });
    return body.innerHTML;
  }

  const outlineItems = Array.from(body.querySelectorAll("li"));
  if (outlineItems.length >= ids.length) {
    ids.forEach((id, index) => {
      outlineItems[index].id = id;
      outlineItems[index].classList.add("outline-chunk");
    });
    return body.innerHTML;
  }

  const children = Array.from(body.children);
  if (!children.length) return html;

  const h2s = children.filter((child) => child.tagName === "H2");
  if (h2s.length > 0) {
    h2s.slice(0, ids.length).forEach((heading, index) => {
      wrapUntilNext(body, heading, ids[index], (node) => node.tagName === "H2" && node !== heading);
    });
    return body.innerHTML;
  }

  const groupSize = Math.max(1, Math.ceil(children.length / ids.length));
  ids.forEach((id) => {
    const section = document.createElement("section");
    section.id = id;
    section.className = "long-section";
    body.appendChild(section);
    Array.from(body.children)
      .filter((child) => child !== section)
      .slice(0, groupSize)
      .forEach((child) => section.appendChild(child));
  });
  return body.innerHTML;
}

function htmlWithChunkNavigation(html: string, navItems: ChunkNavItem[]): string {
  if (!navItems.length || typeof DOMParser === "undefined") return html;

  const document = new DOMParser().parseFromString(html, "text/html");
  const body = document.body;

  navItems.forEach((item, index) => {
    const section = body.querySelector(`#${cssIdentifier(item.id)}`);
    if (!(section instanceof HTMLElement)) return;

    Array.from(section.children)
      .filter((child) => child.classList.contains("chunk-footer"))
      .forEach((child) => child.remove());

    const footer = document.createElement("div");
    footer.className = "chunk-footer";

    footer.appendChild(createChunkNavButton(document, "上一段", navItems[index - 1]?.id));
    footer.appendChild(createChunkNavButton(document, "回到目录", undefined, "toc"));
    footer.appendChild(createChunkNavButton(document, "下一段", navItems[index + 1]?.id));
    section.appendChild(footer);
  });

  return body.innerHTML;
}

function createChunkNavButton(
  document: Document,
  label: string,
  targetId?: string,
  action: "chunk" | "toc" = "chunk",
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "chunk-nav-button";
  button.textContent = label;
  button.type = "button";
  button.dataset.chunkNav = action;
  if (targetId) {
    button.dataset.targetChunk = targetId;
  } else if (action === "chunk") {
    button.disabled = true;
  }
  return button;
}

function wrapUntilNext(
  body: HTMLElement,
  start: Element,
  id: string,
  isNextStart: (node: Element) => boolean,
) {
  const document = body.ownerDocument;
  const section = document.createElement("section");
  section.id = id;
  section.className = "long-section";
  body.insertBefore(section, start);

  let node: ChildNode | null = start;
  while (node) {
    if (node instanceof Element && node !== start && isNextStart(node)) break;
    const nextNode: ChildNode | null = node.nextSibling;
    section.appendChild(node);
    node = nextNode;
  }
}

function cssIdentifier(value: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function courseTitle(course: CourseState): string {
  return course.source.detected_meta?.course_title ?? course.source.file ?? course.course_id;
}

function courseTeacher(course: CourseState): string {
  return course.source.detected_meta?.teacher ?? "未识别讲师";
}

function courseTypeLabel(course: CourseState): string {
  const candidates = course.source.detected_meta?.content_type_candidates;
  if (candidates?.length) return candidates.join(" + ");
  if (course.course_types?.mixed) return "混合课";
  return course.course_types?.dominant_type ?? "未识别课型";
}

function courseSubtitle(course: CourseState): string {
  const meta = course.source.detected_meta;
  return [meta?.student_group, meta?.date].filter(Boolean).join(" · ");
}

function versionForCourse(course: CourseState): VersionKey {
  return isVersionKey(course.default_version) ? course.default_version : DEFAULT_VERSION;
}

function openReviewFlags(course: CourseState): ReviewFlag[] {
  return (course.review_flags ?? []).filter((flag) => flag.status !== "resolved");
}

function formatCount(value: number | undefined, unit = ""): string {
  if (!value) return `0${unit}`;
  if (value >= 10000) return `${(value / 10000).toFixed(2)} 万${unit}`;
  return `${value.toLocaleString("zh-CN")}${unit}`;
}

function courseRawCharCount(course: CourseState): number {
  const paragraphChars = (course.paragraphs ?? []).reduce((total, paragraph) => total + paragraph.text.length, 0);
  const estimates = Object.values(course.versions ?? {})
    .map((version) => {
      if (!version.char_count || !version.compression) return 0;
      return Math.round(version.char_count / version.compression);
    })
    .filter(Boolean);

  const estimatedRawChars = estimates.length ? Math.max(...estimates) : 0;
  if (paragraphChars > 0 && (!estimatedRawChars || paragraphChars > estimatedRawChars * 0.5)) {
    return paragraphChars;
  }
  return estimatedRawChars || paragraphChars;
}

function compressionText(versionChars: number | undefined, rawChars: number, compression?: number): string {
  if (typeof compression === "number") return `${Math.round(compression * 100)}%`;
  if (!versionChars || !rawChars) return "等待统计";
  return `${Math.round((versionChars / rawChars) * 100)}%`;
}

function compactText(value: string | undefined, fallback = "暂无说明"): string {
  const text = (value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function errorDetail(error: unknown): string {
  if (error instanceof ApiError && error.status) return `HTTP ${error.status}`;
  if (error instanceof Error && error.message) return error.message;
  return "";
}

function canExportCourse(status: CourseStatus): boolean {
  return status === "completed" || status === "needs_human";
}

function textIncludes(value: string | undefined, query: string): boolean {
  const normalizedQuery = compactText(query, "");
  if (!normalizedQuery) return false;
  return compactText(value, "").includes(normalizedQuery);
}

function findThemeCard(course: CourseState, theme: string): KnowledgeCard | undefined {
  return (course.knowledge_cards ?? []).find((card) => {
    const related = [...(card.related_themes ?? []), ...(card.related_persons ?? []), card.title, card.summary ?? ""];
    return related.some((item) => textIncludes(item, theme) || textIncludes(theme, item));
  });
}

function findThemeMaterial(course: CourseState, theme: string): WritingMaterial | undefined {
  return (course.writing_materials ?? []).find((material) => {
    const related = [...(material.theme ?? []), material.title, material.usage_suggestion ?? "", material.usable_expression ?? ""];
    return related.some((item) => textIncludes(item, theme) || textIncludes(theme, item));
  });
}

function normalizeTitle(value: string | undefined): string {
  return compactText(value, "").replace(/[《》]/g, "");
}

function buildKeywordInsights(course: CourseState, firstClassics: ClassicsRef | null): KeywordInsight[] {
  const insights: KeywordInsight[] = [];
  const seen = new Set<string>();
  const cards = course.knowledge_cards ?? [];
  const personNames = new Set(
    cards
      .flatMap((card) => (card.type === "person" ? [card.title, ...(card.related_persons ?? [])] : card.related_persons ?? []))
      .concat(firstClassics?.writer && firstClassics.writer !== "佚名" ? [firstClassics.writer] : [])
      .map(normalizeTitle)
      .filter(Boolean),
  );
  const workNames = new Set(
    cards
      .filter((card) => card.type === "work" || /^《.*》$/.test(card.title))
      .map((card) => card.title)
      .concat(firstClassics?.title ? [firstClassics.title] : [])
      .map(normalizeTitle)
      .filter(Boolean),
  );
  const push = (insight: KeywordInsight) => {
    const key = insight.label.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    insights.push(insight);
  };

  (course.global?.main_themes ?? []).slice(0, 4).forEach((theme) => {
    if (personNames.has(normalizeTitle(theme)) || workNames.has(normalizeTitle(theme))) return;
    const card = findThemeCard(course, theme);
    const material = findThemeMaterial(course, theme);
    push({
      id: `theme-${theme}`,
      kind: "theme",
      label: theme,
      kicker: card ? "知识卡片" : material ? "写作素材" : "课程主题",
      title: card?.title ?? material?.title ?? theme,
      summary: compactText(card?.summary ?? material?.usage_suggestion ?? course.global?.course_summary, "这是本课提取出的核心主题。"),
      source: card?.source_chunks?.join(" / ") ?? material?.source_chunks?.join(" / "),
      sourceCourse: courseTitle(course),
      fields: [
        { label: "类型", value: card?.type ?? "主题" },
        { label: "关联段落", value: card?.source_chunks?.join("、") ?? material?.source_chunks?.join("、") ?? "全课" },
      ],
      relatedDrawer: card
        ? { kind: "card", item: card }
        : material
          ? { kind: "material", item: material }
          : { kind: "resource-panel", tab: "cards", course },
    });
  });

  const personCard = cards.find((card) => card.type === "person") ?? cards.find((card) => card.related_persons?.length);
  const author = firstClassics?.writer && firstClassics.writer !== "佚名" ? firstClassics.writer : personCard?.related_persons?.[0] ?? personCard?.title;
  if (author) {
    push({
      id: `author-${author}`,
      kind: "author",
      label: author,
      kicker: "旁征博引 · 作者",
      title: author,
      subtitle: firstClassics?.dynasty ? `${firstClassics.dynasty}文学家` : personCard?.summary,
      summary: compactText(personCard?.summary ?? firstClassics?.shangxi, "已从本课知识卡片中识别到作者信息，可继续补充生平、流派与作品。"),
      quote: author === "袁宏道" ? "独抒性灵，不拘格套" : undefined,
      source: firstClassics?.source ? `来源：${firstClassics.source}` : "本地文史参考库",
      sourceCourse: courseTitle(course),
      fields: [
        { label: "时代", value: firstClassics?.dynasty ?? "待补充" },
        { label: "身份", value: personCard?.summary ?? "作者资料待补充" },
        { label: "课堂关联", value: personCard?.source_chunks?.join("、") ?? firstClassics?.chunk_id ?? "当前课程" },
      ],
      relatedDrawer: personCard ? { kind: "card", item: personCard } : firstClassics ? { kind: "classics", item: firstClassics } : null,
    });
  }

  const workCard = cards.find((card) => card.type === "work" || /^《.*》$/.test(card.title));
  const workTitle = workCard?.title ?? firstClassics?.title;
  if (workTitle) {
    push({
      id: `work-${workTitle}`,
      kind: "work",
      label: workTitle.replace(/[《》]/g, ""),
      kicker: "旁征博引 · 作品",
      title: workTitle,
      subtitle: firstClassics?.writer ? `${firstClassics.writer} · ${firstClassics.dynasty ?? ""}` : undefined,
      summary: compactText(workCard?.summary ?? firstClassics?.shangxi, "本课识别到的作品资料，可展开查看原文、译文与赏析。"),
      quote: firstClassics?.canonical_text,
      source: firstClassics?.ref_url ? `来源：${firstClassics.ref_url}` : "本地文史参考库",
      sourceCourse: courseTitle(course),
      fields: [
        { label: "作者", value: firstClassics?.writer ?? workCard?.related_persons?.join("、") ?? "待补充" },
        { label: "类型", value: workCard?.type ?? "作品" },
        { label: "关联段落", value: workCard?.source_chunks?.join("、") ?? firstClassics?.chunk_id ?? "当前课程" },
      ],
      relatedDrawer: firstClassics ? { kind: "classics", item: firstClassics } : workCard ? { kind: "card", item: workCard } : null,
    });
  }

  (course.global?.main_themes ?? []).slice(4).forEach((theme) => {
    if (insights.length >= 6) return;
    if (personNames.has(normalizeTitle(theme)) || workNames.has(normalizeTitle(theme))) return;
    const card = findThemeCard(course, theme);
    push({
      id: `theme-${theme}`,
      kind: "theme",
      label: theme,
      kicker: card ? "知识卡片" : "课程主题",
      title: card?.title ?? theme,
      summary: compactText(card?.summary ?? course.global?.course_summary, "这是本课提取出的核心主题。"),
      sourceCourse: courseTitle(course),
      relatedDrawer: card ? { kind: "card", item: card } : { kind: "resource-panel", tab: "cards", course },
    });
  });

  return insights.slice(0, 6);
}

function chunkLabel(chunkId: string): string {
  const number = chunkId.match(/\d+/)?.[0];
  if (!number) return chunkId.toUpperCase();
  return `C${String(Number(number)).padStart(2, "0")}`;
}

function paragraphNumber(pid: string | undefined): number | undefined {
  const number = pid?.match(/\d+/)?.[0];
  return number ? Number(number) : undefined;
}

function collectOutlineTitles(nodes: OutlineNode[], map = new Map<string, { score: number; title: string }>(), depth = 0) {
  nodes.forEach((node) => {
    const ids = node.chunk_ids ?? [];
    const score = (node.level ?? depth + 2) * 100 - ids.length;
    ids.forEach((chunkId) => {
      const current = map.get(chunkId);
      if (!current || score > current.score) {
        map.set(chunkId, { score, title: node.title });
      }
    });
    if (node.children?.length) {
      collectOutlineTitles(node.children, map, depth + 1);
    }
  });
  return map;
}

const CHUNK_TYPE_LABELS: Record<string, string> = {
  classical: "文言文精读",
  classical_reading: "文言文精读",
  composition: "作文点评",
  modern_reading: "现代文阅读",
  poem: "古诗词",
  review: "课堂复盘",
};

function buildChunkNavItems(course: CourseState): ChunkNavItem[] {
  const paragraphs = course.paragraphs ?? [];
  const paragraphByPid = new Map(paragraphs.map((paragraph) => [paragraph.pid, paragraph]));
  const titleByChunk = collectOutlineTitles(course.global?.outline_tree ?? []);
  const fallbackChunkChars = Math.round((courseRawCharCount(course) || 0) / Math.max(1, course.chunks?.length ?? 1));

  return (course.chunks ?? []).map((chunk) => {
    const start = paragraphByPid.get(chunk.paragraph_range[0]);
    const end = paragraphByPid.get(chunk.paragraph_range[1]);
    const startIndex = start?.source_order ?? paragraphNumber(chunk.paragraph_range[0]) ?? 0;
    const endIndex = end?.source_order ?? paragraphNumber(chunk.paragraph_range[1]) ?? startIndex;
    const startOrder = startIndex || 1;
    const endOrder = endIndex || startOrder;
    const charCountFromParagraphs = paragraphs
      .filter((paragraph) => paragraph.source_order >= startIndex && paragraph.source_order <= endIndex)
      .reduce((total, paragraph) => total + paragraph.text.length, 0);
    const charCount = charCountFromParagraphs > 200 || fallbackChunkChars < 1000 ? charCountFromParagraphs : fallbackChunkChars;
    const title = titleByChunk.get(chunk.chunk_id)?.title ?? CHUNK_TYPE_LABELS[chunk.primary_type ?? ""] ?? "课堂片段";

    return {
      id: chunk.chunk_id,
      label: chunkLabel(chunk.chunk_id),
      meta: `段落 ${startOrder}-${endOrder} · ${charCount.toLocaleString("zh-CN")} 字`,
      title,
    };
  });
}

function OutlineTree({ nodes, onJump }: { nodes: OutlineNode[]; onJump: (anchor?: string) => void }) {
  if (nodes.length === 0) {
    return <p className="muted">后端尚未返回目录结构。</p>;
  }

  return (
    <div className="toc-list">
      {nodes.map((node) => (
        <button
          className={`toc-item level-${node.level ?? 2}`}
          key={`${node.title}-${node.anchor ?? ""}`}
          onClick={() => onJump(node.anchor ?? node.chunk_ids?.[0])}
          type="button"
        >
          <strong>{node.title}</strong>
          {node.children && node.children.length > 0 ? <span>{node.children.length} 个小节</span> : null}
        </button>
      ))}
    </div>
  );
}

function Topbar({ active }: { active: Route["name"] }) {
  return (
    <header className="topbar" data-tone="paper">
      <a
        aria-label="回到工作台"
        className="brand"
        href="/"
        onClick={(event) => {
          event.preventDefault();
          navigateTo({ name: "workspace" });
        }}
      >
        <span className="brand-mark">文</span>
        <span className="brand-copy">
          <strong>文心</strong>
          <small>TextCore</small>
        </span>
      </a>
      <nav aria-label="主导航" className="main-nav">
        {NAV_ITEMS.map((item) => (
          <a
            className={active === item.key || (active === "detail" && item.key === "courses") ? "active" : ""}
            href={item.path}
            key={item.key}
            onClick={(event) => {
              event.preventDefault();
              navigateTo(item.key === "workspace" ? { name: "workspace" } : { name: item.key });
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="local-status">
        <span className="status-dot" />
        <span>本地运行中</span>
      </div>
    </header>
  );
}

function StatePanel({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="empty-panel state-panel">
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      {onAction ? (
        <button className="button-secondary" onClick={onAction} type="button">
          {actionLabel ?? "重试"}
        </button>
      ) : null}
    </section>
  );
}

function UploadPanel({
  upload,
  onUpload,
}: {
  upload: UploadState;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const pickFile = () => inputRef.current?.click();
  const handleFile = (file: File | undefined) => {
    if (file) onUpload(file);
  };

  return (
    <section
      className={`upload-panel ${dragging ? "dragging" : ""}`}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFile(event.dataTransfer.files[0]);
      }}
    >
      <input
        accept=".docx"
        hidden
        onChange={(event) => handleFile(event.currentTarget.files?.[0])}
        ref={inputRef}
        type="file"
      />
      <div>
        <div className="upload-icon">⇧</div>
        <h1 className="upload-title">上传课堂转写 Word<br />生成学习资料</h1>
        <p className="muted">支持 .docx；生成保真清洗、精简整理、学习整理和结构提纲。</p>
        <button className="button-primary" onClick={pickFile} type="button">
          选择 Word 文件
        </button>
        {upload.status !== "idle" ? (
          <div className="upload-status" role="status">
            <strong>{upload.fileName ?? "课稿"}</strong>
            <span>{upload.message ?? "正在上传并等待处理进度..."}</span>
            <div className="progress-track">
              <i style={{ width: `${Math.round(upload.progress * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProgressPanel({ latestCourse, upload }: { latestCourse?: CourseListItem; upload: UploadState }) {
  const fallback: StatusEvent[] = [
    { course_id: latestCourse?.course_id ?? upload.courseId ?? "pending", stage: "步骤1", stage_label: "解析 Word", stage_status: "done" },
    { course_id: latestCourse?.course_id ?? upload.courseId ?? "pending", stage: "步骤2", stage_label: "识别课型", stage_status: "done" },
    { course_id: latestCourse?.course_id ?? upload.courseId ?? "pending", stage: "步骤3", stage_label: "清洗转写稿", stage_status: "done" },
    {
      course_id: latestCourse?.course_id ?? upload.courseId ?? "pending",
      stage: "步骤4",
      stage_label: "生成学习版",
      stage_status: upload.status === "idle" ? "done" : "running",
    },
    { course_id: latestCourse?.course_id ?? upload.courseId ?? "pending", stage: "步骤5", stage_label: "准备导出", stage_status: "pending" },
  ];
  const events = upload.events.length > 0 ? upload.events : fallback;
  const activeCourseId = upload.courseId ?? latestCourse?.course_id;
  const progressTitle =
    upload.status === "idle"
      ? latestCourse
        ? `最近完成：${latestCourse.title}`
        : "等待第一篇课稿"
      : upload.status === "interrupted"
        ? `进度连接中断：${upload.fileName ?? latestCourse?.title ?? "新课稿"}`
      : `正在整理：${upload.fileName ?? latestCourse?.title ?? "新课稿"}`;

  return (
    <section className="progress-panel">
      <h2 className="section-heading">最近处理</h2>
      <p className="progress-title">{progressTitle}</p>
      <div className="steps">
        {events.slice(-6).map((event) => (
          <div className={`step ${event.stage_status}`} key={`${event.stage}-${event.ts ?? event.message ?? ""}`}>
            <span>{event.stage_status === "done" ? "✓" : event.stage_status === "failed" ? "!" : ""}</span>
            <span>
              {event.stage}：{event.stage_label ?? event.message ?? "处理中"}
            </span>
          </div>
        ))}
      </div>
      <button
        className="button-secondary"
        disabled={!activeCourseId}
        onClick={() => activeCourseId && navigateTo({ name: "detail", courseId: activeCourseId })}
        type="button"
      >
        查看课稿
      </button>
    </section>
  );
}

function CourseTable({
  courses,
  compact = false,
  onExport,
  emptyTitle = "还没有课稿",
  emptyMessage = "上传 Word 后，这里会显示处理状态。",
}: {
  courses: CourseListItem[];
  compact?: boolean;
  onExport: (courseId: string) => void;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (courses.length === 0) {
    return <StatePanel message={emptyMessage} title={emptyTitle} />;
  }

  return (
    <section className="table-panel">
      <table className="history-table">
        <thead>
          {compact ? (
            <tr>
              <th>课程</th>
              <th>课稿</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          ) : (
            <tr>
              <th>课程名</th>
              <th>课型</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>待复核</th>
              <th>操作</th>
            </tr>
          )}
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.course_id}>
              {compact ? (
                <>
                  <td>{course.title}</td>
                  <td>{course.subtitle ?? course.type ?? course.teacher ?? "课堂转写"}</td>
                </>
              ) : (
                <>
                  <td>
                    <button
                      className="link-button"
                      onClick={() => navigateTo({ name: "detail", courseId: course.course_id })}
                      type="button"
                    >
                      {course.title}
                    </button>
                    <br />
                    <span className="muted">
                      {[course.subtitle, course.teacher].filter(Boolean).join(" · ") || course.course_id}
                    </span>
                  </td>
                  <td>{course.type ?? "未识别"}</td>
                </>
              )}
              <td>
                <span className={`tag status-${course.status}`}>{STATUS_LABELS[course.status]}</span>
                {STATUS_HINTS[course.status] ? <small className="status-hint">{STATUS_HINTS[course.status]}</small> : null}
              </td>
              {!compact ? <td>{course.updated_at ?? "刚刚"}</td> : null}
              {!compact ? <td>{course.review_count ? `${course.review_count} 条` : "无"}</td> : null}
              <td>
                <button
                  className="tiny-button"
                  onClick={() => navigateTo({ name: "detail", courseId: course.course_id })}
                  type="button"
                >
                  {compact ? "查看课稿" : "查看"}
                </button>
                {!compact ? (
                  <button
                    className="tiny-button"
                    disabled={!canExportCourse(course.status)}
                    onClick={() => onExport(course.course_id)}
                    title={canExportCourse(course.status) ? "导出 Word" : STATUS_HINTS[course.status] ?? "当前状态不可导出"}
                    type="button"
                  >
                    导出
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WorkspacePage({
  courses,
  listError,
  listStatus,
  upload,
  onRetry,
  onUpload,
  onExport,
}: {
  courses: CourseListItem[];
  listError: string;
  listStatus: LoadStatus;
  upload: UploadState;
  onRetry: () => void;
  onUpload: (file: File) => void;
  onExport: (courseId: string) => void;
}) {
  return (
    <section className="workspace-grid">
      <UploadPanel onUpload={onUpload} upload={upload} />
      <div className="workspace-side">
        <ProgressPanel latestCourse={courses[0]} upload={upload} />
        {listStatus === "error" ? (
          <StatePanel
            actionLabel="重试连接"
            message={listError || "请确认后端服务已在 127.0.0.1:8000 启动，然后重试。"}
            onAction={onRetry}
            title="无法连接后端服务"
          />
        ) : (
          <CourseTable
            compact
            courses={courses.slice(0, 3)}
            emptyMessage={listStatus === "loading" ? "正在从后端读取课程列表..." : "上传 Word 后，这里会显示最近处理的课稿。"}
            emptyTitle={listStatus === "loading" ? "正在加载课稿" : "还没有课稿"}
            onExport={onExport}
          />
        )}
      </div>
    </section>
  );
}

function CoursesPage({
  courses,
  error,
  listStatus,
  onExport,
  onRetry,
}: {
  courses: CourseListItem[];
  error?: string;
  listStatus: LoadStatus;
  onExport: (courseId: string) => void;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CourseStatus | "all">("all");
  const filtered = courses.filter((course) => {
    const text = [course.title, course.subtitle, course.teacher, course.type].filter(Boolean).join(" ");
    return text.toLowerCase().includes(query.toLowerCase()) && (status === "all" || course.status === status);
  });

  return (
    <section>
      <div className="page-title-row">
        <div>
          <p className="page-kicker">课程资料</p>
          <h1 className="page-title">课稿库</h1>
          <p className="muted">管理已上传、处理中和需要复核的课堂转写稿。</p>
        </div>
        <button className="button-primary" onClick={() => navigateTo({ name: "workspace" })} type="button">
          上传新课稿
        </button>
      </div>
      {listStatus === "error" ? (
        <StatePanel
          actionLabel="重试"
          message={error || "请确认后端服务可访问后重试。"}
          onAction={onRetry}
          title="课程列表加载失败"
        />
      ) : (
        <>
          <div className="filter-panel">
            <input
              className="search-input"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="搜索课程名、老师、课型"
              value={query}
            />
            <select
              className="select-input"
              onChange={(event) => setStatus(event.currentTarget.value as CourseStatus | "all")}
              value={status}
            >
              <option value="all">全部状态</option>
              <option value="processing">处理中</option>
              <option value="completed">已完成</option>
              <option value="needs_human">有复核</option>
              <option value="failed">失败</option>
            </select>
          </div>
          <CourseTable
            courses={filtered}
            emptyMessage={
              listStatus === "loading"
                ? "正在从后端读取课程列表..."
                : courses.length === 0
                  ? "后端当前没有课程。上传 Word 后，课程会出现在这里。"
                  : "没有符合当前筛选条件的课程。"
            }
            emptyTitle={listStatus === "loading" ? "正在加载课稿" : courses.length === 0 ? "还没有课稿" : "没有匹配结果"}
            onExport={onExport}
          />
        </>
      )}
    </section>
  );
}

function VersionTabs({
  value,
  course,
  rawChars,
  onChange,
}: {
  value: VersionKey;
  course: CourseState;
  rawChars: number;
  onChange: (value: VersionKey) => void;
}) {
  return (
    <div aria-label="正文版本" className="version-segment" role="tablist">
      {VERSION_TIERS.map((tier) => {
        const version = course.versions?.[tier.key];
        return (
          <button
            aria-selected={value === tier.key}
            className={value === tier.key ? "active" : ""}
            key={tier.key}
            onClick={() => onChange(tier.key)}
            role="tab"
            type="button"
          >
            <strong>{tier.label}</strong>
            <span>
              {version?.char_count
                ? `${formatCount(version.char_count, "字")} · ${compressionText(version.char_count, rawChars, version.compression)}`
                : tier.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReviewMark({ flag }: { flag: ReviewFlag }) {
  return (
    <div className="review-mark-block">
      <strong>{flag.text}</strong>
      {flag.suggestion ? <span className="diff-mark">建议：{flag.suggestion}</span> : null}
      <p>{flag.reason}</p>
      <small>{[flag.pid, flag.chunk_id, flag.severity].filter(Boolean).join(" · ")}</small>
    </div>
  );
}

function HeaderVersionSummary({ course, rawChars }: { course: CourseState; rawChars: number }) {
  return (
    <div aria-label="四档字数比例" className="header-version-summary">
      {VERSION_TIERS.map((tier) => {
        const item = course.versions?.[tier.key];
        return (
          <span key={tier.key}>
            <strong>{tier.label}</strong>
            {item?.char_count ? `${formatCount(item.char_count, "字")} · ${compressionText(item.char_count, rawChars, item.compression)}` : "等待统计"}
          </span>
        );
      })}
    </div>
  );
}

function ChunkToc({
  course,
  activeId,
  onJump,
}: {
  course: CourseState;
  activeId: string;
  onJump: (anchor?: string) => void;
}) {
  const navItems = buildChunkNavItems(course);

  const jumpToChunk = (chunkId: string) => {
    onJump(chunkId);
  };

  return (
    <aside aria-label="正文分段导航" className="floating-toc-sidebar">
      <button className="toc-home" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button">
        <strong>顶</strong>
        <span>回到首屏</span>
      </button>
      {navItems.length ? (
        navItems.map((item) => (
          <button
            className={`toc-item ${activeId === item.id ? "active" : ""}`}
            key={item.id}
            onClick={() => jumpToChunk(item.id)}
            title={`${item.label} ${item.title}`}
            type="button"
          >
            <strong>{item.label}</strong>
            <span>{item.title}</span>
            <small>{item.meta}</small>
          </button>
        ))
      ) : (
        <OutlineTree nodes={course.global?.outline_tree ?? []} onJump={onJump} />
      )}
    </aside>
  );
}

function ChunkMenuList({
  course,
  activeId,
  onJump,
}: {
  course: CourseState;
  activeId: string;
  onJump: (anchor?: string) => void;
}) {
  const navItems = buildChunkNavItems(course);

  if (!navItems.length) {
    return <OutlineTree nodes={course.global?.outline_tree ?? []} onJump={onJump} />;
  }

  return (
    <div className="toc-list chunk-menu-items">
      {navItems.map((item) => (
        <button
          className={`toc-item ${activeId === item.id ? "active" : ""}`}
          key={item.id}
          onClick={() => onJump(item.id)}
          title={`${item.label} ${item.title}`}
          type="button"
        >
          <strong>{item.label}</strong>
          <span>{item.title}</span>
          <small>{item.meta}</small>
        </button>
      ))}
    </div>
  );
}

function QuickScrollRail({ course }: { course: CourseState }) {
  const markers = course.chunks?.length ? course.chunks : [];
  const scrollToRatio = (value: number) => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: maxScroll * value, behavior: "smooth" });
  };

  return (
    <div aria-label="快速滚动" className="quick-scroll-rail">
      <button className="rail-edge" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} title="回到首屏" type="button">
        ↑
      </button>
      <input
        aria-label="拖动快速浏览正文"
        className="quick-scroll-range"
        defaultValue="0"
        max="100"
        min="0"
        onChange={(event) => scrollToRatio(Number(event.currentTarget.value) / 100)}
        type="range"
      />
      <div className="rail-dots">
        {markers.slice(0, 18).map((chunk, index) => (
          <button
            key={chunk.chunk_id}
            onClick={() => {
              const denominator = Math.max(1, markers.length - 1);
              scrollToRatio(index / denominator);
            }}
            title={`${chunk.chunk_id} ${chunk.primary_type ?? ""}`}
            type="button"
          />
        ))}
      </div>
      <button
        className="rail-edge"
        onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })}
        title="到底部"
        type="button"
      >
        ↓
      </button>
    </div>
  );
}

function InsightPopover({ insight, onOpen }: { insight: KeywordInsight; onOpen: () => void }) {
  return (
    <aside className="classics-popover">
      <span className="classical-label">{insight.kicker}</span>
      <h4>{insight.title}</h4>
      {insight.subtitle ? <p className="popover-subtitle">{insight.subtitle}</p> : null}
      <p>{insight.summary}</p>
      <button className="tiny-button" onClick={onOpen} type="button">
        展开详案
      </button>
    </aside>
  );
}

function InsightDrawer({ insight, onOpen }: { insight: KeywordInsight; onOpen: (drawer: DrawerState) => void }) {
  return (
    <div className="drawer-body">
      <p className="page-kicker">{insight.kicker}</p>
      <h2>{insight.title}</h2>
      {insight.subtitle ? <p className="muted">{insight.subtitle}</p> : null}
      {insight.source ? <p className="source-note">■ {insight.source}</p> : null}
      {insight.quote ? <blockquote className="insight-quote">{insight.quote}</blockquote> : null}
      <InfoBlock title="核心说明">{insight.summary}</InfoBlock>
      {insight.fields?.length ? (
        <section className="insight-field-grid">
          {insight.fields.map((field) => (
            <div className="insight-field" key={`${field.label}-${field.value}`}>
              <span>{field.label}</span>
              <strong>{field.value}</strong>
            </div>
          ))}
        </section>
      ) : null}
      {insight.sourceCourse ? (
        <section className="info-block">
          <h3>来源课程</h3>
          <p>{insight.sourceCourse}</p>
        </section>
      ) : null}
      {insight.relatedDrawer ? (
        <button className="button-secondary" onClick={() => onOpen(insight.relatedDrawer ?? null)} type="button">
          查看关联资料
        </button>
      ) : null}
    </div>
  );
}

function ClassicsDrawer({ refItem }: { refItem: ClassicsRef }) {
  return (
    <div className="drawer-body">
      <p className="page-kicker">古文旁征博引</p>
      <h2>{refItem.title ?? "古文资料"}</h2>
      <p className="muted">
        {[refItem.dynasty, refItem.writer, refItem.source].filter(Boolean).join(" · ") || "参考来源待后端返回"}
      </p>
      <section className="classical-appreciation-block">
        <h3>权威原文</h3>
        <p className="classical-original">{refItem.canonical_text ?? "暂无 canonical_text"}</p>
        {refItem.diffs?.length ? (
          <div className="diff-list">
            {refItem.diffs.map((diff) => (
              <span className="correction-mark" key={`${diff.pid ?? ""}-${diff.raw}-${diff.canonical}`}>
                {diff.canonical}
                <sup>原:{diff.raw}</sup>
              </span>
            ))}
          </div>
        ) : null}
      </section>
      <InfoBlock title="译文">{refItem.translation}</InfoBlock>
      <InfoBlock title="字词注释">{refItem.remark}</InfoBlock>
      <InfoBlock title="赏析">{refItem.shangxi}</InfoBlock>
      {refItem.ref_url ? (
        <a className="source-link" href={refItem.ref_url} rel="noreferrer" target="_blank">
          来源：{refItem.ref_url}
        </a>
      ) : null}
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <section className="info-block">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}

function ResourceDrawer({
  drawer,
  onClose,
  onOpen,
}: {
  drawer: DrawerState;
  onClose: () => void;
  onOpen: (drawer: DrawerState) => void;
}) {
  if (!drawer) return null;

  return (
    <aside
      aria-modal="true"
      className={`drawer open ${drawer.kind === "classics" || drawer.kind === "resource-panel" || drawer.kind === "insight" ? "wide" : ""}`}
      role="dialog"
    >
      <button aria-label="关闭" className="icon-button drawer-close" onClick={onClose} type="button">
        ×
      </button>
      {drawer.kind === "classics" ? <ClassicsDrawer refItem={drawer.item} /> : null}
      {drawer.kind === "insight" ? <InsightDrawer insight={drawer.item} onOpen={onOpen} /> : null}
      {drawer.kind === "card" ? (
        <div className="drawer-body">
          <p className="page-kicker">知识卡片</p>
          <h2>{drawer.item.title}</h2>
          <span className="tag">{drawer.item.type}</span>
          <p>{drawer.item.summary ?? "暂无详解"}</p>
          <ul>{(drawer.item.core_points ?? []).map((point) => <li key={point}>{point}</li>)}</ul>
          <InfoBlock title="课堂例子">{drawer.item.example}</InfoBlock>
        </div>
      ) : null}
      {drawer.kind === "material" ? (
        <div className="drawer-body">
          <p className="page-kicker">作文素材</p>
          <h2>{drawer.item.title}</h2>
          <span className="tag">{drawer.item.theme?.join(" / ") ?? "素材"}</span>
          <InfoBlock title="可用表达">{drawer.item.usable_expression}</InfoBlock>
          <InfoBlock title="老师点评">{drawer.item.teacher_comment}</InfoBlock>
          <InfoBlock title="使用建议">{drawer.item.usage_suggestion}</InfoBlock>
        </div>
      ) : null}
      {drawer.kind === "resource-panel" ? (
        <ResourcePanelDrawer course={drawer.course} tab={drawer.tab} onOpen={onOpen} />
      ) : null}
    </aside>
  );
}

function ResourcePanelDrawer({
  course,
  tab,
  onOpen,
}: {
  course: CourseState;
  tab: "cards" | "materials" | "review";
  onOpen: (drawer: DrawerState) => void;
}) {
  const reviewFlags = openReviewFlags(course);
  const title = tab === "materials" ? "写作素材" : tab === "review" ? "待复核" : "知识点";

  return (
    <div className="drawer-body">
      <p className="page-kicker">课程关联资源</p>
      <h2>{title}</h2>
      <div className="mini-list drawer-resource-list">
        {tab === "cards"
          ? (course.knowledge_cards ?? []).map((card) => (
              <button className="mini-item resource-item" key={card.card_id} onClick={() => onOpen({ kind: "card", item: card })} type="button">
                <div>
                  <h4>{card.title}</h4>
                  <p>{card.summary ?? "暂无摘要"}</p>
                  <span className="tag">{card.type}</span>
                </div>
              </button>
            ))
          : null}
        {tab === "materials"
          ? (course.writing_materials ?? []).map((material) => (
              <button
                className="mini-item resource-item"
                key={material.material_id}
                onClick={() => onOpen({ kind: "material", item: material })}
                type="button"
              >
                <div>
                  <h4>{material.title}</h4>
                  <p>{material.usage_suggestion ?? material.usable_expression ?? "暂无素材说明"}</p>
                  <span className="tag">{material.theme?.join(" / ") ?? "作文素材"}</span>
                </div>
              </button>
            ))
          : null}
        {tab === "review"
          ? reviewFlags.map((flag) => <ReviewMark flag={flag} key={flag.flag_id ?? `${flag.text}-${flag.reason}`} />)
          : null}
        {(tab === "cards" && !(course.knowledge_cards ?? []).length) ||
        (tab === "materials" && !(course.writing_materials ?? []).length) ||
        (tab === "review" && !reviewFlags.length) ? (
          <p className="muted">后端尚未返回该类资源。</p>
        ) : null}
      </div>
    </div>
  );
}

function ExportModal({
  courseId,
  version,
  onClose,
}: {
  courseId?: string;
  version: VersionKey;
  onClose: () => void;
}) {
  const [format, setFormat] = useState("printable");
  const [sections, setSections] = useState(["summary", "concise", "cards", "materials", "review"]);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!courseId) return null;

  const toggleSection = (section: string) => {
    setSections((current) =>
      current.includes(section) ? current.filter((item) => item !== section) : [...current, section],
    );
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    setMessage("正在生成 Word...");
    try {
      const blob = await requestExport(courseId, { version, sections, format });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${courseId}-${version}.docx`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("已开始下载。");
    } catch (error) {
      const detail = errorDetail(error);
      setFailed(true);
      setMessage(detail ? `导出失败，请重试。${detail}` : "导出失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  };

  const sectionOptions = [
    ["summary", "课程摘要"],
    ...VERSION_TIERS.map((tier) => [tier.key, tier.label]),
    ["cards", "知识点"],
    ["materials", "写作素材"],
    ["classics", "旁征博引资料"],
    ["review", "待复核"],
  ];

  return (
    <div className="modal-backdrop">
      <section aria-labelledby="exportTitle" aria-modal="true" className="modal" role="dialog">
        <button aria-label="关闭" className="icon-button modal-close" onClick={onClose} type="button">
          ×
        </button>
        <h2 id="exportTitle">导出 Word</h2>
        <p className="muted">生成一份简洁可打印的学习材料，后续可以继续手改或打印。</p>
        <div className="check-grid">
          {sectionOptions.map(([key, label]) => (
            <label key={key}>
              <input
                checked={sections.includes(key)}
                onChange={() => toggleSection(key)}
                type="checkbox"
              />{" "}
              {label}
            </label>
          ))}
        </div>
        <div className="export-format">
          <button
            className={`choice ${format === "printable" ? "active" : ""}`}
            onClick={() => setFormat("printable")}
            type="button"
          >
            简洁可打印
          </button>
          <button
            className={`choice ${format === "archive" ? "active" : ""}`}
            onClick={() => setFormat("archive")}
            type="button"
          >
            完整留档
          </button>
        </div>
        {message ? <p className={failed ? "inline-error" : "muted"}>{message}</p> : null}
        <footer className="modal-actions">
          <button className="button-secondary" onClick={onClose} type="button">
            取消
          </button>
          <button className="button-primary" disabled={submitting || sections.length === 0} onClick={submit} type="button">
            {failed ? "重试生成" : submitting ? "生成中..." : "生成 Word"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function CourseDetail({
  courseId,
  onExport,
}: {
  courseId: string;
  onExport: (courseId: string, version?: VersionKey) => void;
}) {
  const [course, setCourse] = useState<CourseState | null>(null);
  const [error, setError] = useState<DetailError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [version, setVersion] = useState<VersionKey>(DEFAULT_VERSION);
  const [compare, setCompare] = useState(false);
  const [compact, setCompact] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [popover, setPopover] = useState<KeywordInsight | null>(null);
  const [activeChunkId, setActiveChunkId] = useState("");

  useEffect(() => {
    let active = true;
    setCourse(null);
    setError(null);
    getCourse(courseId)
      .then((payload) => {
        if (!active) return;
        setCourse(payload);
        setVersion(versionForCourse(payload));
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setError({
            title: "未找到该课程",
            message: "该课程不存在或已经被后端移除。请返回课稿库确认最新列表。",
            canRetry: false,
          });
          return;
        }
        setError({
          title: "加载失败",
          message: errorDetail(err) || "无法加载课程详情，请确认后端服务可访问后重试。",
          canRetry: true,
        });
      });
    return () => {
      active = false;
    };
  }, [courseId, reloadKey]);

  const scrollToDetailTop = () => {
    const target = document.querySelector(".source-summary") ?? document.querySelector(".detail-header");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const jumpTo = (anchor?: string) => {
    if (!anchor) return;
    setActiveChunkId(anchor);
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const chunkIndex = course?.chunks?.findIndex((chunk) => chunk.chunk_id === anchor) ?? -1;
    if (chunkIndex >= 0) {
      const panelTop = (document.querySelector(".reading-panel")?.getBoundingClientRect().top ?? 0) + window.scrollY;
      const maxScroll = Math.max(panelTop, document.documentElement.scrollHeight - window.innerHeight);
      const denominator = Math.max(1, (course?.chunks?.length ?? 1) - 1);
      window.scrollTo({ top: panelTop + (maxScroll - panelTop) * (chunkIndex / denominator), behavior: "smooth" });
    }
  };

  const chunkNavItems = useMemo(() => (course ? buildChunkNavItems(course) : []), [course]);
  const bodyHtml = useMemo(
    () => anchoredHtmlFromBody(course?.versions?.[version]?.body_md, chunkNavItems),
    [course, chunkNavItems, version],
  );
  const readableBodyHtml = useMemo(() => htmlWithChunkNavigation(bodyHtml, chunkNavItems), [bodyHtml, chunkNavItems]);

  const handleReadingClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const navButton = target.closest<HTMLButtonElement>("[data-chunk-nav]");
    if (navButton) {
      if (navButton.disabled) return;
      if (navButton.dataset.chunkNav === "toc") {
        scrollToDetailTop();
        return;
      }
      jumpTo(navButton.dataset.targetChunk);
      return;
    }

    if (!compact) return;
    const heading = target.closest<HTMLElement>(".long-section h2, .outline-chunk");
    const section = heading?.closest<HTMLElement>(".long-section[id], .outline-chunk[id]");
    if (!section?.id) return;

    setCompact(false);
    setActiveChunkId(section.id);
    window.requestAnimationFrame(() => {
      document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    const firstId = chunkNavItems[0]?.id ?? "";
    if (firstId && !chunkNavItems.some((item) => item.id === activeChunkId)) {
      setActiveChunkId(firstId);
    }
  }, [activeChunkId, chunkNavItems]);

  useEffect(() => {
    if (compare || !chunkNavItems.length) return undefined;
    const elements = chunkNavItems
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveChunkId(visible.target.id);
        }
      },
      { rootMargin: "-38% 0px -48% 0px", threshold: [0.12, 0.3, 0.6] },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [readableBodyHtml, chunkNavItems, compare]);

  if (error) {
    return (
      <StatePanel
        actionLabel={error.canRetry ? "重试" : "返回课稿库"}
        message={error.message}
        onAction={error.canRetry ? () => setReloadKey((current) => current + 1) : () => navigateTo({ name: "courses" })}
        title={error.title}
      />
    );
  }

  if (!course) {
    return <section className="empty-panel">正在加载课程详情...</section>;
  }

  const rawChars = courseRawCharCount(course);
  const rawText = (course.paragraphs ?? [])
    .slice(0, 24)
    .map((paragraph) => `${paragraph.speaker ?? ""} ${paragraph.ts ?? ""}\n${paragraph.text}`)
    .join("\n\n");
  const reviewFlags = openReviewFlags(course);
  const firstClassics = course.classics_refs?.find((item) => item.matched) ?? null;
  const keywordInsights = buildKeywordInsights(course, firstClassics);
  const resourceCounts = {
    cards: course.knowledge_cards?.length ?? 0,
    materials: course.writing_materials?.length ?? 0,
    review: reviewFlags.length,
    classics: course.classics_refs?.filter((item) => item.matched).length ?? 0,
  };
  const isProcessing = course.status === "created" || course.status === "processing";
  const isFailed = course.status === "failed";
  const subtitle = courseSubtitle(course);
  const currentChunkLabel = chunkLabel(activeChunkId || (chunkNavItems[0]?.id ?? "全文"));

  return (
    <section>
      <div className="detail-breadcrumb">
        <button className="button-ghost" onClick={() => navigateTo({ name: "courses" })} type="button">
          ← 返回课稿库
        </button>
        <button className="tiny-button" onClick={() => navigateTo({ name: "courses" })} type="button">
          上一篇
        </button>
        <button className="tiny-button" onClick={() => navigateTo({ name: "courses" })} type="button">
          下一篇
        </button>
      </div>
      <div className="detail-header">
        <div>
          <p className="page-kicker">课程详情</p>
          <h1 className="page-title">课程：{courseTitle(course)} ｜ 讲师：{courseTeacher(course)}</h1>
          {subtitle ? <p className="detail-subtitle">{subtitle}</p> : null}
          <div className="course-meta">
            <span className="tag">课型：{courseTypeLabel(course)}</span>
            <span className="tag">原始文件：{course.source.file}</span>
            <span className="tag">
              {(course.paragraphs ?? []).length} 段 / 原文约 {formatCount(rawChars, "字")} / {(course.chunks ?? []).length} 个处理块
            </span>
            <span className={`tag status-${course.status}`}>{STATUS_LABELS[course.status]}</span>
            <span className="tag">待复核 {reviewFlags.length} 条</span>
          </div>
          <HeaderVersionSummary course={course} rawChars={rawChars} />
        </div>
        <button
          className="button-primary"
          disabled={!canExportCourse(course.status)}
          onClick={() => onExport(course.course_id, version)}
          title={canExportCourse(course.status) ? "导出 Word" : STATUS_HINTS[course.status] ?? "当前状态不可导出"}
          type="button"
        >
          ⇩ 导出 Word
        </button>
      </div>

      {isProcessing ? (
        <StatePanel
          message="后端仍在生成课程版本、知识卡片和导出材料。完成前不会显示为可导出的完成稿。"
          title="课程处理中"
        />
      ) : isFailed ? (
        <StatePanel
          message="后端返回处理失败。当前课程不可导出，请检查后端处理日志或重新上传课稿。"
          title="处理失败"
        />
      ) : (
      <div className="detail-layout">
        <ChunkToc activeId={activeChunkId} course={course} onJump={jumpTo} />
        <article className="reading-panel">
          <section className="source-summary">
            <div className="overview-card">
              <div className="overview-card-head">
                <p className="page-kicker">课程摘要</p>
                <div className="overview-actions" aria-label="课程关联资源">
                  <button className="tiny-button resource-button" onClick={() => setDrawer({ kind: "resource-panel", tab: "cards", course })} type="button">
                    知识点 · <span>{resourceCounts.cards}</span>
                  </button>
                  <button
                    className="tiny-button resource-button"
                    onClick={() => setDrawer({ kind: "resource-panel", tab: "materials", course })}
                    type="button"
                  >
                    写作素材 · <span>{resourceCounts.materials}</span>
                  </button>
                  <button className="tiny-button resource-button" onClick={() => setDrawer({ kind: "resource-panel", tab: "review", course })} type="button">
                    待复核 · <span>{resourceCounts.review}</span>
                  </button>
                  {firstClassics ? (
                    <button className="tiny-button resource-button classics-resource-button" onClick={() => setDrawer({ kind: "classics", item: firstClassics })} type="button">
                      旁征博引 · <span>{resourceCounts.classics}</span>
                    </button>
                  ) : null}
                </div>
              </div>
              <h2>{courseTitle(course)}</h2>
              <p>{course.global?.course_summary ?? "后端尚未返回课程摘要"}</p>
              <div className="keyword-row">
                {keywordInsights.map((insight) => (
                  <button
                    className={`keyword-chip ${insight.kind === "author" || insight.kind === "work" ? "classics-keyword" : ""}`}
                    key={insight.id}
                    onClick={() => setPopover(insight)}
                    type="button"
                  >
                    {insight.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="process-meta">
              <span>原文 {formatCount(rawChars, "字")}</span>
              <span>{course.chunks?.length ?? 0} 个正文分段</span>
              <span>当前 {VERSION_LABELS[version]}</span>
              <span>{course.quality?.coverage ? `覆盖 ${course.quality.coverage}` : "本地处理"}</span>
            </div>
          </section>
          <section className="sticky-control-bar">
            <VersionTabs course={course} onChange={setVersion} rawChars={rawChars} value={version} />
            <button
              className={`button-secondary compare-action ${compare ? "active" : ""}`}
              onClick={() => setCompare((current) => !current)}
              type="button"
            >
              对照原文 <span>原文 {formatCount(rawChars, "字")}</span>
            </button>
            <div className="control-actions">
              <details className="chapter-menu">
                <summary>
                  章节目录 <span className="current-chunk-label">{currentChunkLabel}</span>
                </summary>
                <div className="chapter-menu-list">
                  <ChunkMenuList activeId={activeChunkId} course={course} onJump={jumpTo} />
                </div>
              </details>
              <button className="tiny-button" onClick={() => setCompact((current) => !current)} type="button">
                {compact ? "查看完整正文" : "只看段落标题"}
              </button>
            </div>
          </section>
          {compare ? (
            <div className="compare-view" onClick={handleReadingClick}>
              <section className="compare-col">
                <h3>原始转写稿</h3>
                <pre>{rawText || "后端尚未返回 paragraphs。"}</pre>
              </section>
              <section className="compare-col">
                <h3>{VERSION_LABELS[version]}</h3>
                <div className={`reading-content ${compact ? "compact-long" : ""}`} dangerouslySetInnerHTML={{ __html: readableBodyHtml }} />
              </section>
            </div>
          ) : (
            <div className={`reading-body ${compact ? "compact-long" : ""}`} onClick={handleReadingClick}>
              {firstClassics ? <ClassicalReferenceBlock refItem={firstClassics} onOpen={() => setDrawer({ kind: "classics", item: firstClassics })} /> : null}
              <div className="reading-content" dangerouslySetInnerHTML={{ __html: readableBodyHtml }} />
            </div>
          )}
        </article>
        <QuickScrollRail course={course} />

        <aside className="side-card detail-side">
          <div className="side-tabs">
            <button className="active" type="button">知识卡片</button>
            <button type="button">作文素材</button>
            <button type="button">复核</button>
          </div>
          <ResourceList
            cards={course.knowledge_cards ?? []}
            classics={course.classics_refs ?? []}
            materials={course.writing_materials ?? []}
            onOpen={setDrawer}
            reviewFlags={reviewFlags}
          />
        </aside>
      </div>
      )}
      {popover ? (
        <InsightPopover
          insight={popover}
          onOpen={() => {
            setDrawer({ kind: "insight", item: popover });
            setPopover(null);
          }}
        />
      ) : null}
      <ResourceDrawer drawer={drawer} onClose={() => setDrawer(null)} onOpen={setDrawer} />
    </section>
  );
}

function ClassicalReferenceBlock({ refItem, onOpen }: { refItem: ClassicsRef; onOpen: () => void }) {
  return (
    <aside aria-label="古文旁征博引" className="classical-appreciation-block">
      <div className="classical-block-head">
        <span className="classical-label">古文旁征博引</span>
        <button className="source-stamp" onClick={onOpen} type="button">
          <i /> 来源：{refItem.source ?? "本地参考库"} ↗
        </button>
      </div>
      <h3>
        {refItem.title ?? "古文引用"} {refItem.writer ? `· ${refItem.writer}` : ""}
      </h3>
      <p className="classical-original">
        {refItem.canonical_text ?? "暂无 canonical_text"}
        {refItem.diffs?.map((diff) => (
          <span className="correction-mark" key={`${diff.raw}-${diff.canonical}`}>
            {diff.canonical}
            <sup>原:{diff.raw}</sup>
          </span>
        ))}
      </p>
      <details className="classical-fold">
        <summary>展开译文与字词释义</summary>
        <div className="classical-explain-grid">
          <div>
            <h4>白话译文</h4>
            <p>{refItem.translation ?? "暂无译文"}</p>
          </div>
          <div>
            <h4>重点字词</h4>
            <p>{refItem.remark ?? "暂无注释"}</p>
          </div>
        </div>
      </details>
      <details className="classical-fold classical-analysis-fold">
        <summary>展开赏析</summary>
        <p className="teacher-note">{refItem.shangxi ?? "赏析待后端返回。"}</p>
      </details>
    </aside>
  );
}

function ResourceList({
  cards,
  materials,
  reviewFlags,
  classics,
  onOpen,
}: {
  cards: KnowledgeCard[];
  materials: WritingMaterial[];
  reviewFlags: ReviewFlag[];
  classics: ClassicsRef[];
  onOpen: (drawer: DrawerState) => void;
}) {
  return (
    <div className="mini-list">
      {cards.slice(0, 4).map((card) => (
        <button className="mini-item" key={card.card_id} onClick={() => onOpen({ kind: "card", item: card })} type="button">
          <h4>{card.title}</h4>
          <p>{card.summary ?? "暂无摘要"}</p>
        </button>
      ))}
      {materials.slice(0, 3).map((material) => (
        <button
          className="mini-item"
          key={material.material_id}
          onClick={() => onOpen({ kind: "material", item: material })}
          type="button"
        >
          <h4>{material.title}</h4>
          <p>{material.usage_suggestion ?? material.usable_expression ?? "暂无素材说明"}</p>
        </button>
      ))}
      {classics.slice(0, 2).map((item) => (
        <button
          className="mini-item"
          key={item.ref_id ?? `${item.chunk_id}-${item.title ?? ""}`}
          onClick={() => onOpen({ kind: "classics", item })}
          type="button"
        >
          <h4>{item.title ?? "古文资料"}</h4>
          <p>{item.canonical_text ?? item.translation ?? "旁征博引资料"}</p>
        </button>
      ))}
      {reviewFlags.slice(0, 4).map((flag) => (
        <ReviewMark flag={flag} key={flag.flag_id ?? `${flag.text}-${flag.reason}`} />
      ))}
      {cards.length + materials.length + reviewFlags.length + classics.length === 0 ? (
        <p className="muted">后端尚未返回卡片、素材或复核标记。</p>
      ) : null}
    </div>
  );
}

function AssetsPage({ courses }: { courses: CourseListItem[] }) {
  const [assetTab, setAssetTab] = useState<"methods" | "works" | "words" | "materials">("works");
  const sourceCourse = courses.find((course) => course.title.includes("醉叟")) ?? courses[0];
  const workAssets = [
    {
      title: "《醉叟传》",
      type: "文言传记",
      author: "袁宏道",
      quote: "醉叟者，不知何地人，亦不言其姓名，以其常醉，呼曰“醉叟”。",
      summary: "作品通过不知来历、常醉、孤身、怪食等细节，让醉叟以神秘而传奇的方式登场。文心会把参考库原文、译文和老师讲解分层展示。",
      course: sourceCourse?.title ?? "五上寒假第三/四讲 · 文言文《醉叟传》",
      words: ["叟", "以", "姓字", "呼曰", "可"],
      theme: "奇人登场、人物传记、悬念式开头",
    },
  ];
  const methodAssets = [
    {
      title: "现代文阅读双线结构",
      type: "阅读方法",
      summary: "区分明线事件与暗线心理，把故事推进和主题表达分开整理。",
      points: ["先找事件顺序", "再看人物心理变化", "最后归纳教育主题"],
    },
    {
      title: "文言人物传记开头",
      type: "文言方法",
      summary: "关注姓名、来历、外貌、怪异行为等信息，判断作者怎样制造人物的传奇感。",
      points: ["抓身份信息", "抓异常行为", "抓作者态度"],
    },
  ];
  const wordAssets = [
    {
      title: "叟",
      type: "文言字词",
      summary: "年老的男子。用于人物称呼时常带有民间传说或人物小传的味道。",
      points: ["醉叟", "老叟", "渔叟"],
    },
    {
      title: "以",
      type: "文言字词",
      summary: "可作介词或连词，结合上下文判断为“用、凭借、因为、把”等。",
      points: ["以其常醉", "以为", "可以"],
    },
  ];
  const materialAssets = [
    {
      title: "犯错后的尊严与宽容",
      type: "作文主题",
      summary: "可用于写成长、家庭教育、理解与自省。重点不是犯错本身，而是犯错后如何被引导。",
      points: ["尊严是改错动力", "爱让人愿意反思", "正向示范胜过羞辱"],
    },
    {
      title: "奇人登场写法",
      type: "写作技巧",
      summary: "先不交代全部身份，而用动作、外貌和传闻制造悬念，让人物带着故事感出现。",
      points: ["不急于说明", "用细节立人", "让读者产生追问"],
    },
  ];

  const renderGeneralCard = (item: { title: string; type: string; summary: string; points: string[] }, prefix: string) => (
    <article className="asset-card" key={`${prefix}-${item.title}`}>
      <h3>{prefix}{item.title}</h3>
      <span className="tag">{item.type}</span>
      <p><strong>详解：</strong>{item.summary}</p>
      <h4>关键重点</h4>
      <ul>{item.points.map((point) => <li key={point}>{point}</li>)}</ul>
    </article>
  );

  return (
    <section className="asset-page">
      <p className="page-kicker">知识沉淀</p>
      <h1 className="page-title">知识资产库</h1>
      <div className="asset-tabs">
        <button className={assetTab === "methods" ? "active" : ""} onClick={() => setAssetTab("methods")} type="button">
          知识点库
        </button>
        <button className={assetTab === "works" ? "active" : ""} onClick={() => setAssetTab("works")} type="button">
          作品典藏
        </button>
        <button className={assetTab === "words" ? "active" : ""} onClick={() => setAssetTab("words")} type="button">
          词汇生词本
        </button>
        <button className={assetTab === "materials" ? "active" : ""} onClick={() => setAssetTab("materials")} type="button">
          写作素材库
        </button>
      </div>
      <div className="asset-grid">
        {assetTab === "works"
          ? workAssets.map((item) => (
              <article className="asset-card work-asset-card" key={item.title}>
                <div className="work-card-head">
                  <span className="tag">{item.type}</span>
                  <span>{item.author}</span>
                </div>
                <h3>作品：{item.title}</h3>
                <blockquote className="work-quote">{item.quote}</blockquote>
                <p><strong>核心赏析：</strong>{item.summary}</p>
                <div className="work-meta-list">
                  <span>关联课堂：{item.course}</span>
                  <span>已记字词：{item.words.join("、")}</span>
                  <span>主题：{item.theme}</span>
                </div>
                {sourceCourse ? (
                  <button
                    className="tiny-button"
                    onClick={() => navigateTo({ name: "detail", courseId: sourceCourse.course_id })}
                    type="button"
                  >
                    查看作品详案
                  </button>
                ) : null}
              </article>
            ))
          : null}
        {assetTab === "methods" ? methodAssets.map((item) => renderGeneralCard(item, "知识点：")) : null}
        {assetTab === "words" ? wordAssets.map((item) => renderGeneralCard(item, "词：")) : null}
        {assetTab === "materials" ? materialAssets.map((item) => renderGeneralCard(item, "素材：")) : null}
      </div>
    </section>
  );
}

export function App() {
  const route = useRoute();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [listError, setListError] = useState("");
  const [listStatus, setListStatus] = useState<LoadStatus>("idle");
  const [upload, setUpload] = useState<UploadState>(INITIAL_UPLOAD_STATE);
  const [exportTarget, setExportTarget] = useState<{ courseId?: string; version: VersionKey }>({
    version: DEFAULT_VERSION,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  const refreshCourses = useCallback(() => {
    setListStatus("loading");
    listCourses()
      .then((payload) => {
        setCourses(payload);
        setListError("");
        setListStatus("success");
      })
      .catch((error: unknown) => {
        setCourses([]);
        setListError(errorDetail(error) || "请确认后端服务可访问后重试。");
        setListStatus("error");
      });
  }, []);

  useEffect(() => {
    refreshCourses();
  }, [refreshCourses]);

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  const handleUpload = async (file: File) => {
    eventSourceRef.current?.close();
    setUpload({
      status: "uploading",
      fileName: file.name,
      progress: 0.06,
      message: "正在上传 Word...",
      events: [],
    });
    try {
      const result = await uploadCourse(file);
      setUpload((current) => ({
        ...current,
        status: "processing",
        courseId: result.course_id,
        progress: 0.14,
        message: "上传完成，等待后端处理进度...",
      }));
      eventSourceRef.current = subscribeCourseEvents(
        result.course_id,
        (event) => {
          const nextStatus =
            event.overall_status === "completed"
              ? "completed"
              : event.overall_status === "failed" || event.stage_status === "failed"
                ? "failed"
                : "processing";
          setUpload((current) => ({
            ...current,
            status: nextStatus,
            progress: event.progress ?? current.progress,
            message: event.message ?? event.stage_label ?? current.message,
            events: [...current.events, event].slice(-12),
          }));
          if (nextStatus === "completed" || nextStatus === "failed") {
            eventSourceRef.current?.close();
            refreshCourses();
          }
        },
        () => {
          const interruptedEvent: StatusEvent = {
            course_id: result.course_id,
            stage: "进度连接",
            stage_label: "进度连接中断",
            stage_status: "failed",
            message: "SSE 进度连接中断",
          };
          setUpload((current) => ({
            ...current,
            status: current.status === "completed" || current.status === "failed" ? current.status : "interrupted",
            message: "进度连接中断，后端可能仍在处理。可重试刷新课稿库查看最新状态。",
            events: [...current.events, interruptedEvent].slice(-12),
          }));
          eventSourceRef.current?.close();
          refreshCourses();
        },
      );
      refreshCourses();
    } catch (error) {
      setUpload((current) => ({
        ...current,
        status: "failed",
        progress: 0,
        message: error instanceof Error ? error.message : "上传失败",
      }));
    }
  };

  const openExport = (courseId: string, version: VersionKey = DEFAULT_VERSION) => {
    setExportTarget({ courseId, version });
  };

  const page = useMemo(() => {
    if (route.name === "courses") {
      return (
        <CoursesPage
          courses={courses}
          error={listError}
          listStatus={listStatus}
          onExport={openExport}
          onRetry={refreshCourses}
        />
      );
    }
    if (route.name === "detail") {
      return <CourseDetail courseId={route.courseId} onExport={openExport} />;
    }
    if (route.name === "assets") {
      return <AssetsPage courses={courses} />;
    }
    return (
      <WorkspacePage
        courses={courses}
        listError={listError}
        listStatus={listStatus}
        onExport={openExport}
        onRetry={refreshCourses}
        onUpload={handleUpload}
        upload={upload}
      />
    );
  }, [courses, listError, listStatus, route, upload, refreshCourses]);

  return (
    <div className="app-shell">
      <Topbar active={route.name} />
      <main aria-label="TextCore app shell" className={`page-container ${route.name === "detail" ? "detail-page-container" : ""}`}>
        {page}
      </main>
      <ExportModal
        courseId={exportTarget.courseId}
        onClose={() => setExportTarget({ version: DEFAULT_VERSION })}
        version={exportTarget.version}
      />
    </div>
  );
}
