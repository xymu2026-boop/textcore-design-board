import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  getAssets,
  getCourse,
  listCourses,
  requestExport,
  subscribeCourseEvents,
  uploadCourse,
} from "./api/client";
import type {
  AssetKnowledgeCard,
  AssetSource,
  AssetsResponse,
  AssetWritingMaterial,
  ClassicsRef,
  CourseListItem,
  CourseState,
  CourseStatus,
  KnowledgeCard,
  OutlineNode,
  Paragraph,
  ReviewFlag,
  StageStatus,
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

type ClassicsPopoverState = {
  item: ClassicsRef;
  left: number;
  top: number;
  width: number;
} | null;

type TextMatch = {
  text: string;
  index: number;
};

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
  created: "处理中",
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

const CARD_TYPE_LABELS: Record<KnowledgeCard["type"], string> = {
  method: "方法",
  person: "人物",
  event: "事件",
  concept: "概念",
  work: "作品",
  theme: "主题",
  mistake: "易错点",
};

const PIPELINE_STAGES = ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"] as const;

const PIPELINE_STAGE_LABELS: Record<string, string> = {
  S0: "解析 Word",
  S1: "预清洗",
  S2: "课型识别",
  S3: "语义分块",
  S4: "分块清洗",
  S5: "古文查证",
  S6: "全局合并",
  S7: "生成版本",
  S8: "知识素材",
  S9: "复核汇总",
  S10: "完成入库",
};

const DETAIL_POLL_INTERVAL_MS = 3500;

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
    if (h2s.length >= ids.length) {
      h2s.slice(0, ids.length).forEach((heading, index) => {
        wrapUntilNext(body, heading, ids[index], (node) => node.tagName === "H2" && node !== heading);
      });
      return body.innerHTML;
    }
    return distributeBodyChildrenAcrossChunks(body, ids);
  }

  return distributeBodyChildrenAcrossChunks(body, ids);
}

function distributeBodyChildrenAcrossChunks(body: HTMLElement, ids: string[]): string {
  const children = Array.from(body.children);
  if (!children.length) return body.innerHTML;

  const groupSize = Math.max(1, Math.ceil(children.length / ids.length));
  body.replaceChildren();
  ids.forEach((id, index) => {
    const section = body.ownerDocument.createElement("section");
    section.id = id;
    section.className = "long-section";
    children.slice(index * groupSize, (index + 1) * groupSize).forEach((child) => section.appendChild(child));
    body.appendChild(section);
  });
  return body.innerHTML;
}

function htmlForChunk(html: string, chunkId: string): string {
  if (!html || !chunkId || typeof DOMParser === "undefined") return html;

  const document = new DOMParser().parseFromString(html, "text/html");
  const node = document.body.querySelector(`#${cssIdentifier(chunkId)}`);
  if (!node) return html;
  if (node.tagName === "LI") {
    const list = document.createElement("ol");
    list.className = "compare-outline-list";
    list.appendChild(node.cloneNode(true));
    return list.outerHTML;
  }
  return node.outerHTML;
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

function interactiveHtmlFromBody(html: string, course: CourseState, reviewFlags: ReviewFlag[]): string {
  if (!html || typeof DOMParser === "undefined") return html;

  const document = new DOMParser().parseFromString(html, "text/html");
  const body = document.body;
  wrapTextMatches(body, buildClassicsTextMatches(course.classics_refs ?? []), (doc, match, text) => {
    const button = doc.createElement("button");
    button.className = "classics-anchor";
    button.type = "button";
    button.dataset.classicsIndex = String(match.index);
    button.textContent = text;
    return button;
  });
  wrapTextMatches(body, buildReviewTextMatches(reviewFlags), (doc, match, text) => {
    const flag = reviewFlags[match.index];
    const span = doc.createElement("span");
    span.className = "correction-mark review-inline";
    span.tabIndex = 0;
    span.dataset.reviewIndex = String(match.index);
    span.textContent = text;

    const sup = doc.createElement("sup");
    sup.textContent = flag.suggestion ? `建议:${flag.suggestion}` : "待复核";
    span.appendChild(sup);

    const tooltip = doc.createElement("span");
    tooltip.className = "correction-tooltip";
    tooltip.textContent = [flag.reason, flag.suggestion ? `建议：${flag.suggestion}` : ""].filter(Boolean).join("；");
    span.appendChild(tooltip);
    return span;
  });

  return body.innerHTML;
}

function wrapTextMatches(
  root: HTMLElement,
  matches: TextMatch[],
  createNode: (document: Document, match: TextMatch, text: string) => HTMLElement,
) {
  if (!matches.length) return;

  const document = root.ownerDocument;
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest("button,a,script,style,[data-classics-index],[data-review-index],.correction-tooltip")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    if (walker.currentNode instanceof Text) textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    const value = node.nodeValue ?? "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let changed = false;

    while (cursor < value.length) {
      const next = findNextTextMatch(value, cursor, matches);
      if (!next) {
        fragment.appendChild(document.createTextNode(value.slice(cursor)));
        break;
      }

      if (next.start > cursor) {
        fragment.appendChild(document.createTextNode(value.slice(cursor, next.start)));
      }

      const matchedText = value.slice(next.start, next.start + next.match.text.length);
      fragment.appendChild(createNode(document, next.match, matchedText));
      cursor = next.start + next.match.text.length;
      changed = true;
    }

    if (changed) node.parentNode?.replaceChild(fragment, node);
  });
}

function findNextTextMatch(
  value: string,
  cursor: number,
  matches: TextMatch[],
): { start: number; match: TextMatch } | null {
  let best: { start: number; match: TextMatch } | null = null;
  matches.forEach((match) => {
    const start = value.indexOf(match.text, cursor);
    if (start < 0) return;
    if (!best || start < best.start || (start === best.start && match.text.length > best.match.text.length)) {
      best = { start, match };
    }
  });
  return best;
}

function buildClassicsTextMatches(refs: ClassicsRef[]): TextMatch[] {
  const seen = new Set<string>();
  const matches: TextMatch[] = [];
  refs.forEach((ref, index) => {
    const labels = [
      ref.title,
      ref.title && /^《.*》$/.test(ref.title) ? ref.title.replace(/[《》]/g, "") : ref.title ? `《${ref.title.replace(/[《》]/g, "")}》` : "",
      ref.writer && ref.writer !== "佚名" ? ref.writer : "",
    ];
    labels.forEach((label) => {
      const text = compactText(label, "");
      const key = `${index}:${text}`;
      if (text.length < 2 || seen.has(key)) return;
      seen.add(key);
      matches.push({ text, index });
    });
  });
  return matches.sort((a, b) => b.text.length - a.text.length);
}

function buildReviewTextMatches(flags: ReviewFlag[]): TextMatch[] {
  const seen = new Set<string>();
  return flags
    .map((flag, index) => ({ text: compactText(flag.text, ""), index }))
    .filter((match) => {
      const key = `${match.index}:${match.text}`;
      if (match.text.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.text.length - a.text.length);
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

function isProcessingStatus(status: CourseStatus): boolean {
  return status === "created" || status === "processing";
}

function clampProgress(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function progressWidth(value: number | undefined): string {
  return `${Math.round(clampProgress(value) * 100)}%`;
}

function stageProgress(stage: string, status: StageStatus): number {
  const index = PIPELINE_STAGES.findIndex((item) => item === stage);
  if (index < 0) return status === "done" || status === "skipped" ? 0.9 : 0.12;
  const base = index / PIPELINE_STAGES.length;
  const step = 1 / PIPELINE_STAGES.length;
  if (status === "done" || status === "skipped") return Math.min(1, base + step);
  if (status === "running") return Math.min(0.98, base + step * 0.55);
  if (status === "failed") return Math.min(0.98, base + step * 0.45);
  return Math.min(0.98, base);
}

function progressForStatusEvent(event: StatusEvent, fallback: number): number {
  if (typeof event.progress === "number") return Math.max(clampProgress(event.progress), fallback);
  return Math.max(stageProgress(event.stage, event.stage_status), fallback);
}

function chunkProgressLabel(event: StatusEvent): string | undefined {
  if (
    typeof event.chunk_index !== "number" ||
    typeof event.chunk_total !== "number" ||
    event.chunk_index < 1 ||
    event.chunk_total < 1
  ) {
    return undefined;
  }
  return `${event.chunk_index}/${event.chunk_total} 块`;
}

function statusEventDetail(event: StatusEvent): string | undefined {
  const chunkLabel = chunkProgressLabel(event);
  const rawMessage = event.message?.trim();
  const stageMessage = `${event.stage} ${event.stage_status}`;
  const message =
    rawMessage && rawMessage !== event.stage_label && rawMessage !== stageMessage ? rawMessage : undefined;
  if (!chunkLabel) return message;
  if (message?.includes(chunkLabel)) return message;
  return message ? `${message} · ${chunkLabel}` : chunkLabel;
}

function courseStatusEvents(course: CourseState): StatusEvent[] {
  const stages = course.processing_log?.stages ?? [];
  if (stages.length > 0) {
    return stages.map((stage) => ({
      course_id: course.course_id,
      stage: stage.stage,
      stage_label: PIPELINE_STAGE_LABELS[stage.stage] ?? stage.stage,
      stage_status: stage.status,
      overall_status: course.status,
      progress: stageProgress(stage.stage, stage.status),
      message: stage.note,
      ts: stage.ended_at ?? stage.started_at,
    }));
  }

  if (course.status === "failed") {
    return [
      {
        course_id: course.course_id,
        stage: "处理状态",
        stage_label: "处理失败",
        stage_status: "failed",
        overall_status: "failed",
        message: "后端未返回具体失败阶段",
        progress: 0,
      },
    ];
  }

  return [
    {
      course_id: course.course_id,
      stage: course.status === "created" ? "等待队列" : "处理中",
      stage_label: course.status === "created" ? "等待后端开始处理" : "后端正在生成课程资料",
      stage_status: "running",
      overall_status: course.status,
      progress: course.status === "created" ? 0.04 : 0.14,
    },
  ];
}

function courseProcessingProgress(course: CourseState): number {
  const events = courseStatusEvents(course);
  const inferred = events.reduce((max, event) => Math.max(max, progressForStatusEvent(event, 0)), 0);
  if (course.status === "created") return Math.max(0.04, inferred);
  if (course.status === "processing") return Math.max(0.14, inferred);
  if (course.status === "failed") return inferred;
  return 1;
}

function safeFileName(value: string | undefined): string {
  const cleaned = compactText(value, "TextCore课稿")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.+$/g, "")
    .trim()
    .slice(0, 90);
  return cleaned || "TextCore课稿";
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

function paragraphsForChunk(course: CourseState, chunkId: string): Paragraph[] {
  const paragraphs = course.paragraphs ?? [];
  const chunk = course.chunks?.find((item) => item.chunk_id === chunkId);
  if (!chunk || !paragraphs.length) return paragraphs;

  const orderByPid = new Map(
    paragraphs.map((paragraph, index) => [
      paragraph.pid,
      paragraph.source_order || paragraphNumber(paragraph.pid) || index + 1,
    ]),
  );
  const startOrder = orderByPid.get(chunk.paragraph_range[0]) ?? paragraphNumber(chunk.paragraph_range[0]) ?? 1;
  const endOrder = orderByPid.get(chunk.paragraph_range[1]) ?? paragraphNumber(chunk.paragraph_range[1]) ?? startOrder;
  const minOrder = Math.min(startOrder, endOrder);
  const maxOrder = Math.max(startOrder, endOrder);

  return paragraphs.filter((paragraph, index) => {
    const order = paragraph.source_order || paragraphNumber(paragraph.pid) || index + 1;
    return order >= minOrder && order <= maxOrder;
  });
}

function chunkIdForPid(course: CourseState, pid: string | undefined): string | undefined {
  if (!pid) return undefined;
  const paragraph = course.paragraphs?.find((item) => item.pid === pid);
  const order = paragraph?.source_order ?? paragraphNumber(pid);
  if (!order) return undefined;

  return course.chunks?.find((chunk) => {
    const startOrder = course.paragraphs?.find((item) => item.pid === chunk.paragraph_range[0])?.source_order ?? paragraphNumber(chunk.paragraph_range[0]) ?? 0;
    const endOrder = course.paragraphs?.find((item) => item.pid === chunk.paragraph_range[1])?.source_order ?? paragraphNumber(chunk.paragraph_range[1]) ?? startOrder;
    return order >= Math.min(startOrder, endOrder) && order <= Math.max(startOrder, endOrder);
  })?.chunk_id;
}

function chunkIdForReviewFlag(course: CourseState, flag: ReviewFlag): string | undefined {
  return flag.chunk_id ?? chunkIdForPid(course, flag.pid);
}

function findClassicsRefForLabel(course: CourseState, label: string): ClassicsRef | undefined {
  const normalized = normalizeTitle(label);
  if (!normalized) return undefined;
  return (course.classics_refs ?? []).find((ref) => {
    const title = normalizeTitle(ref.title);
    const writer = normalizeTitle(ref.writer);
    return title === normalized || writer === normalized;
  });
}

function RawChunk({ paragraphs }: { paragraphs: Paragraph[] }) {
  if (!paragraphs.length) {
    return <p className="muted">后端尚未返回该分块的 paragraphs。</p>;
  }

  return (
    <div className="raw-chunk">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.pid}>
          <span>
            {[paragraph.pid, paragraph.speaker, paragraph.ts].filter(Boolean).join(" · ")}
          </span>
          {paragraph.text}
        </p>
      ))}
    </div>
  );
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
        onChange={(event) => {
          handleFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
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
          <div className={`upload-status upload-${upload.status}`} role="status">
            <strong>{upload.fileName ?? "课稿"}</strong>
            <span>{upload.message ?? "正在上传并等待处理进度..."}</span>
            <div className="progress-track">
              <i style={{ width: progressWidth(upload.progress) }} />
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
        : upload.status === "completed"
          ? `整理完成：${upload.fileName ?? latestCourse?.title ?? "新课稿"}`
          : upload.status === "failed"
            ? `处理失败：${upload.fileName ?? latestCourse?.title ?? "新课稿"}`
            : `正在整理：${upload.fileName ?? latestCourse?.title ?? "新课稿"}`;

  return (
    <section className="progress-panel">
      <h2 className="section-heading">处理进度</h2>
      <p className="progress-title">{progressTitle}</p>
      {upload.status !== "idle" ? (
        <div className="progress-summary" aria-label="整体进度">
          <span>{Math.round(clampProgress(upload.progress) * 100)}%</span>
          <div className="progress-track">
            <i style={{ width: progressWidth(upload.progress) }} />
          </div>
        </div>
      ) : null}
      <div className="steps">
        {events.slice(-6).map((event) => {
          const detail = statusEventDetail(event);
          return (
            <div className={`step ${event.stage_status}`} key={`${event.stage}-${event.ts ?? event.message ?? ""}`}>
              <span>{event.stage_status === "done" ? "✓" : event.stage_status === "failed" ? "!" : ""}</span>
              <span>
                {event.stage}：{event.stage_label ?? event.message ?? "处理中"}
                {detail ? <small>{detail}</small> : null}
              </span>
            </div>
          );
        })}
      </div>
      <button
        className="button-secondary"
        disabled={!activeCourseId}
        onClick={() => activeCourseId && navigateTo({ name: "detail", courseId: activeCourseId })}
        type="button"
      >
        {upload.status === "interrupted" ? "查看最新状态" : "查看课稿"}
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
  onExport: (courseId: string, version?: VersionKey, title?: string) => void;
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
                    onClick={() => onExport(course.course_id, undefined, course.title)}
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
  onExport: (courseId: string, version?: VersionKey, title?: string) => void;
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
          <div className="workspace-history">
            <div className="section-row compact-row">
              <h2 className="section-heading">最近处理</h2>
              <button className="button-ghost" onClick={() => navigateTo({ name: "courses" })} type="button">
                查看全部
              </button>
            </div>
            <CourseTable
              compact
              courses={courses.slice(0, 3)}
              emptyMessage={listStatus === "loading" ? "正在从后端读取课程列表..." : "上传 Word 后，这里会显示最近处理的课稿。"}
              emptyTitle={listStatus === "loading" ? "正在加载课稿" : "还没有课稿"}
              onExport={onExport}
            />
          </div>
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
  onExport: (courseId: string, version?: VersionKey, title?: string) => void;
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

function ReviewMark({ flag, onLocate }: { flag: ReviewFlag; onLocate?: () => void }) {
  return (
    <button className={`review-mark-block ${onLocate ? "clickable" : ""}`} disabled={!onLocate} onClick={onLocate} type="button">
      <strong>{flag.text}</strong>
      {flag.suggestion ? <span className="diff-mark">建议：{flag.suggestion}</span> : null}
      <p>{flag.reason}</p>
      <small>{[flag.pid, flag.chunk_id, flag.severity].filter(Boolean).join(" · ")}</small>
    </button>
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

function ClassicsPopover({
  popover,
  onOpen,
  onClose,
}: {
  popover: ClassicsPopoverState;
  onOpen: (item: ClassicsRef) => void;
  onClose: () => void;
}) {
  if (!popover) return null;
  const refItem = popover.item;
  const source = refItem.ref_url ?? refItem.source ?? "来源待后端返回";

  return (
    <aside className="classics-popover show" style={{ left: popover.left, top: popover.top, width: popover.width }}>
      <button aria-label="关闭旁征博引浮层" className="popover-close" onClick={onClose} type="button">
        ×
      </button>
      <p className="popover-kicker">{refItem.writer ? "作者/作品旁征博引" : "作品旁征博引"}</p>
      <h3>{refItem.title ?? refItem.writer ?? "古文资料"}</h3>
      {refItem.matched ? null : <p className="unmatched-note">未匹配权威原文</p>}
      <p className="popover-preview">{compactText(refItem.canonical_text, "暂无原文")}</p>
      <InfoBlock title="译文">{refItem.translation}</InfoBlock>
      <InfoBlock title="注释">{refItem.remark}</InfoBlock>
      <InfoBlock title="赏析">{refItem.shangxi}</InfoBlock>
      <footer className="popover-actions">
        <span className="source-stamp static"><i /> {source}</span>
        <button className="tiny-button" onClick={() => onOpen(refItem)} type="button">
          展开详案
        </button>
        {refItem.ref_url ? (
          <a className="tiny-button" href={refItem.ref_url} rel="noreferrer" target="_blank">
            查看全文
          </a>
        ) : null}
      </footer>
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
      {!refItem.matched ? <p className="unmatched-note">未匹配权威原文</p> : null}
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

function SourceChunkLinks({ chunks, onJump }: { chunks?: string[]; onJump?: (chunkId: string) => void }) {
  if (!chunks?.length) return null;
  return (
    <section className="source-chunk-links">
      <h3>关联正文</h3>
      <div>
        {chunks.map((chunkId) => (
          <button className="tiny-button" key={chunkId} onClick={() => onJump?.(chunkId)} type="button">
            {chunkLabel(chunkId)}
          </button>
        ))}
      </div>
    </section>
  );
}

function ResourceDrawer({
  drawer,
  onClose,
  onOpen,
  onJump,
}: {
  drawer: DrawerState;
  onClose: () => void;
  onOpen: (drawer: DrawerState) => void;
  onJump: (chunkId: string) => void;
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
          <SourceChunkLinks chunks={drawer.item.source_chunks} onJump={onJump} />
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
          <SourceChunkLinks chunks={drawer.item.source_chunks} onJump={onJump} />
        </div>
      ) : null}
      {drawer.kind === "resource-panel" ? (
        <ResourcePanelDrawer course={drawer.course} tab={drawer.tab} onJump={onJump} onOpen={onOpen} />
      ) : null}
    </aside>
  );
}

function ResourcePanelDrawer({
  course,
  tab,
  onJump,
  onOpen,
}: {
  course: CourseState;
  tab: "cards" | "materials" | "review";
  onJump: (chunkId: string) => void;
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
                  {card.source_chunks?.length ? <span className="source-chunk-meta">关联 {card.source_chunks.map(chunkLabel).join("、")}</span> : null}
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
                  {material.source_chunks?.length ? <span className="source-chunk-meta">关联 {material.source_chunks.map(chunkLabel).join("、")}</span> : null}
                </div>
              </button>
            ))
          : null}
        {tab === "review"
          ? reviewFlags.map((flag) => (
              <ReviewMark
                flag={flag}
                key={flag.flag_id ?? `${flag.text}-${flag.reason}`}
                onLocate={chunkIdForReviewFlag(course, flag) ? () => onJump(chunkIdForReviewFlag(course, flag) ?? "") : undefined}
              />
            ))
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

function CourseStatusPanel({
  course,
  onRefresh,
}: {
  course: CourseState;
  onRefresh: () => void;
}) {
  const isFailed = course.status === "failed";
  const events = courseStatusEvents(course);
  const progress = courseProcessingProgress(course);
  const latestFailed = [...events].reverse().find((event) => event.stage_status === "failed");

  return (
    <section className={`course-status-panel ${isFailed ? "failed" : "processing"}`}>
      <div className="status-panel-head">
        <div>
          <p className="page-kicker">{isFailed ? "处理失败" : "课程处理中"}</p>
          <h2>{isFailed ? "处理失败，暂不可导出" : "正在生成正文版本与学习资料"}</h2>
          <p className="muted">
            {isFailed
              ? "后端返回处理失败。请检查后端处理日志，或返回工作台重新上传课稿。"
              : "完成前不会显示为可导出的完成稿；本页会定期刷新最新处理状态。"}
          </p>
          {latestFailed?.message ? <p className="inline-error">{latestFailed.message}</p> : null}
        </div>
        <span className={`tag status-${course.status}`}>{STATUS_LABELS[course.status]}</span>
      </div>

      {!isFailed ? (
        <div className="detail-progress-summary" aria-label="课程处理进度">
          <span>{Math.round(clampProgress(progress) * 100)}%</span>
          <div className="progress-track">
            <i style={{ width: progressWidth(progress) }} />
          </div>
        </div>
      ) : null}

      <div className="version-placeholder-grid" aria-label="正文版本状态">
        {VERSION_TIERS.map((tier) => (
          <article className="version-placeholder-card" key={tier.key}>
            <strong>{tier.label}</strong>
            <span>{isFailed ? "未生成" : "等待生成"}</span>
            <p>{tier.description}</p>
          </article>
        ))}
      </div>

      <div className="status-steps">
        {events.map((event) => {
          const detail = statusEventDetail(event);
          return (
            <div className={`step ${event.stage_status}`} key={`${event.stage}-${event.ts ?? event.message ?? event.stage_status}`}>
              <span>{event.stage_status === "done" ? "✓" : event.stage_status === "failed" ? "!" : ""}</span>
              <span>
                {event.stage}：{event.stage_label ?? event.message ?? "处理中"}
                {detail ? <small>{detail}</small> : null}
              </span>
            </div>
          );
        })}
      </div>

      <footer className="status-actions">
        <button className="button-secondary" onClick={onRefresh} type="button">
          刷新状态
        </button>
        {isFailed ? (
          <button className="button-primary" onClick={() => navigateTo({ name: "workspace" })} type="button">
            重新上传课稿
          </button>
        ) : null}
      </footer>
    </section>
  );
}

function ExportModal({
  courseId,
  title,
  version,
  onClose,
}: {
  courseId?: string;
  title?: string;
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
      link.download = `${safeFileName(title ?? courseId)}-${VERSION_LABELS[version]}.docx`;
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
  onExport: (courseId: string, version?: VersionKey, title?: string) => void;
}) {
  const [course, setCourse] = useState<CourseState | null>(null);
  const [error, setError] = useState<DetailError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [version, setVersion] = useState<VersionKey>(DEFAULT_VERSION);
  const [compare, setCompare] = useState(false);
  const [compact, setCompact] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [popover, setPopover] = useState<KeywordInsight | null>(null);
  const [classicsPopover, setClassicsPopover] = useState<ClassicsPopoverState>(null);
  const [sideTab, setSideTab] = useState<"cards" | "materials" | "review">("cards");
  const [activeChunkId, setActiveChunkId] = useState("");
  const pendingScrollChunkRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setCourse((current) => (current?.course_id === courseId ? current : null));
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

  useEffect(() => {
    if (!course || !isProcessingStatus(course.status)) return undefined;

    let active = true;
    const timer = window.setInterval(() => {
      getCourse(courseId)
        .then((payload) => {
          if (!active) return;
          setCourse(payload);
          setVersion(versionForCourse(payload));
        })
        .catch(() => {
          // Keep the visible processing state on transient polling failures.
        });
    }, DETAIL_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [course, courseId]);

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
    setDrawer(null);
    setClassicsPopover(null);
    if (compare) {
      document.querySelector(".compare-view")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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

  const locateReviewFlag = (flag: ReviewFlag, index: number) => {
    if (!course) return;
    setDrawer(null);
    setClassicsPopover(null);
    const marker = document.querySelector<HTMLElement>(`[data-review-index="${index}"]`);
    if (marker) {
      marker.scrollIntoView({ behavior: "smooth", block: "center" });
      marker.classList.add("pulse-target");
      window.setTimeout(() => marker.classList.remove("pulse-target"), 1300);
      return;
    }
    jumpTo(chunkIdForReviewFlag(course, flag));
  };

  const openClassicsPopover = (element: HTMLElement, item: ClassicsRef) => {
    const rect = element.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 28);
    setPopover(null);
    setClassicsPopover({
      item,
      width,
      left: Math.min(Math.max(14, rect.left), window.innerWidth - width - 14),
      top: Math.min(rect.bottom + 10, window.innerHeight - 260),
    });
  };

  const chunkNavItems = useMemo(() => (course ? buildChunkNavItems(course) : []), [course]);
  const bodyHtml = useMemo(
    () => anchoredHtmlFromBody(course?.versions?.[version]?.body_md, chunkNavItems),
    [course, chunkNavItems, version],
  );
  const readableBodyHtml = useMemo(() => {
    if (!course) return bodyHtml;
    return interactiveHtmlFromBody(htmlWithChunkNavigation(bodyHtml, chunkNavItems), course, openReviewFlags(course));
  }, [bodyHtml, chunkNavItems, course]);
  const currentChunkId = activeChunkId || chunkNavItems[0]?.id || "";
  const currentChunk = chunkNavItems.find((item) => item.id === currentChunkId);
  const compareRightHtml = useMemo(() => htmlForChunk(bodyHtml, currentChunkId), [bodyHtml, currentChunkId]);
  const interactiveCompareRightHtml = useMemo(() => {
    if (!course) return compareRightHtml;
    return interactiveHtmlFromBody(compareRightHtml, course, openReviewFlags(course));
  }, [compareRightHtml, course]);
  const compareParagraphs = useMemo(
    () => (course && currentChunkId ? paragraphsForChunk(course, currentChunkId) : []),
    [course, currentChunkId],
  );
  const handleVersionChange = (nextVersion: VersionKey) => {
    if (nextVersion === version) return;
    const chunkToKeep = currentChunkId || chunkNavItems[0]?.id || "";
    if (chunkToKeep) {
      setActiveChunkId(chunkToKeep);
      pendingScrollChunkRef.current = chunkToKeep;
    }
    setVersion(nextVersion);
  };

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

    const classicsAnchor = target.closest<HTMLElement>("[data-classics-index]");
    if (classicsAnchor && course?.classics_refs) {
      const refItem = course.classics_refs[Number(classicsAnchor.dataset.classicsIndex)];
      if (refItem) openClassicsPopover(classicsAnchor, refItem);
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

  useEffect(() => {
    const chunkId = pendingScrollChunkRef.current;
    if (!chunkId || compare) return undefined;
    pendingScrollChunkRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(chunkId)?.scrollIntoView({ behavior: "auto", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [readableBodyHtml, compare]);

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
  const reviewFlags = openReviewFlags(course);
  const firstClassics = course.classics_refs?.[0] ?? null;
  const keywordInsights = buildKeywordInsights(course, firstClassics);
  const resourceCounts = {
    cards: course.knowledge_cards?.length ?? 0,
    materials: course.writing_materials?.length ?? 0,
    review: reviewFlags.length,
    classics: course.classics_refs?.length ?? 0,
  };
  const isProcessing = course.status === "created" || course.status === "processing";
  const isFailed = course.status === "failed";
  const subtitle = courseSubtitle(course);
  const currentChunkLabel = currentChunk?.label ?? chunkLabel(currentChunkId || "全文");

  return (
    <section>
      <div className="detail-breadcrumb">
        <button className="button-ghost" onClick={() => navigateTo({ name: "courses" })} type="button">
          ← 返回课稿库
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
          {isProcessing || isFailed ? null : <HeaderVersionSummary course={course} rawChars={rawChars} />}
        </div>
        <button
          className="button-primary"
          disabled={!canExportCourse(course.status)}
          onClick={() => onExport(course.course_id, version, courseTitle(course))}
          title={canExportCourse(course.status) ? "导出 Word" : STATUS_HINTS[course.status] ?? "当前状态不可导出"}
          type="button"
        >
          {canExportCourse(course.status) ? "⇩ 导出 Word" : isFailed ? "处理失败不可导出" : "处理中不可导出"}
        </button>
      </div>

      {isProcessing ? (
        <CourseStatusPanel course={course} onRefresh={() => setReloadKey((current) => current + 1)} />
      ) : isFailed ? (
        <CourseStatusPanel course={course} onRefresh={() => setReloadKey((current) => current + 1)} />
      ) : (
      <div className="detail-layout">
        <ChunkToc activeId={currentChunkId} course={course} onJump={jumpTo} />
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
                    onClick={(event) => {
                      const refItem = findClassicsRefForLabel(course, insight.label);
                      if (refItem && (insight.kind === "author" || insight.kind === "work")) {
                        openClassicsPopover(event.currentTarget, refItem);
                        return;
                      }
                      setClassicsPopover(null);
                      setPopover(insight);
                    }}
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
            <VersionTabs course={course} onChange={handleVersionChange} rawChars={rawChars} value={version} />
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
                  <ChunkMenuList activeId={currentChunkId} course={course} onJump={jumpTo} />
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
                <h3>
                  原始转写稿｜{currentChunk?.label ?? currentChunkLabel}
                </h3>
                {currentChunk ? <p className="muted">{currentChunk.title} · {currentChunk.meta}</p> : null}
                <RawChunk paragraphs={compareParagraphs} />
              </section>
              <section className="compare-col">
                <h3>
                  当前整理版｜{VERSION_LABELS[version]}
                </h3>
                <p className="muted">当前只对照正在阅读的正文分段。</p>
                <div className={`reading-content ${compact ? "compact-long" : ""}`} dangerouslySetInnerHTML={{ __html: interactiveCompareRightHtml }} />
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
            <button className={sideTab === "cards" ? "active" : ""} onClick={() => setSideTab("cards")} type="button">知识卡片</button>
            <button className={sideTab === "materials" ? "active" : ""} onClick={() => setSideTab("materials")} type="button">作文素材</button>
            <button className={sideTab === "review" ? "active" : ""} onClick={() => setSideTab("review")} type="button">复核</button>
          </div>
          <ResourceList
            activeTab={sideTab}
            cards={course.knowledge_cards ?? []}
            classics={course.classics_refs ?? []}
            materials={course.writing_materials ?? []}
            onLocateReview={locateReviewFlag}
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
      <ClassicsPopover
        popover={classicsPopover}
        onClose={() => setClassicsPopover(null)}
        onOpen={(item) => {
          setDrawer({ kind: "classics", item });
          setClassicsPopover(null);
        }}
      />
      <ResourceDrawer drawer={drawer} onClose={() => setDrawer(null)} onJump={jumpTo} onOpen={setDrawer} />
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
  activeTab,
  cards,
  materials,
  reviewFlags,
  classics,
  onLocateReview,
  onOpen,
}: {
  activeTab: "cards" | "materials" | "review";
  cards: KnowledgeCard[];
  materials: WritingMaterial[];
  reviewFlags: ReviewFlag[];
  classics: ClassicsRef[];
  onLocateReview: (flag: ReviewFlag, index: number) => void;
  onOpen: (drawer: DrawerState) => void;
}) {
  const hasCards = cards.length + classics.length > 0;
  const hasMaterials = materials.length > 0;
  const hasReviewFlags = reviewFlags.length > 0;

  return (
    <div className="mini-list">
      {activeTab === "cards"
        ? cards.slice(0, 5).map((card) => (
            <button className="mini-item" key={card.card_id} onClick={() => onOpen({ kind: "card", item: card })} type="button">
              <h4>{card.title}</h4>
              <p>{card.summary ?? "暂无摘要"}</p>
              {card.source_chunks?.length ? <span className="source-chunk-meta">关联 {card.source_chunks.map(chunkLabel).join("、")}</span> : null}
            </button>
          ))
        : null}
      {activeTab === "cards"
        ? classics.slice(0, 3).map((item) => (
            <button
              className="mini-item classics-mini-item"
              key={item.ref_id ?? `${item.chunk_id}-${item.title ?? ""}`}
              onClick={() => onOpen({ kind: "classics", item })}
              type="button"
            >
              <h4>{item.title ?? item.writer ?? "古文资料"}</h4>
              <p>{item.matched ? (item.canonical_text ?? item.translation ?? "旁征博引资料") : "未匹配权威原文"}</p>
              <span className="source-chunk-meta">{item.chunk_id ? `关联 ${chunkLabel(item.chunk_id)}` : "旁征博引"}</span>
            </button>
          ))
        : null}
      {activeTab === "materials"
        ? materials.slice(0, 6).map((material) => (
            <button
              className="mini-item"
              key={material.material_id}
              onClick={() => onOpen({ kind: "material", item: material })}
              type="button"
            >
              <h4>{material.title}</h4>
              <p>{material.usage_suggestion ?? material.usable_expression ?? "暂无素材说明"}</p>
              {material.source_chunks?.length ? <span className="source-chunk-meta">关联 {material.source_chunks.map(chunkLabel).join("、")}</span> : null}
            </button>
          ))
        : null}
      {activeTab === "review"
        ? reviewFlags.slice(0, 8).map((flag, index) => (
            <ReviewMark
              flag={flag}
              key={flag.flag_id ?? `${flag.text}-${flag.reason}`}
              onLocate={flag.pid || flag.chunk_id ? () => onLocateReview(flag, index) : undefined}
            />
          ))
        : null}
      {activeTab === "cards" && !hasCards ? <p className="muted">后端尚未返回知识卡片或旁征博引资料。</p> : null}
      {activeTab === "materials" && !hasMaterials ? <p className="muted">后端尚未返回作文素材。</p> : null}
      {activeTab === "review" && !hasReviewFlags ? <p className="muted">后端尚未返回待复核项。</p> : null}
    </div>
  );
}

type AssetTab = "methods" | "words" | "materials";

const EMPTY_ASSETS: AssetsResponse = { cards: [], materials: [], vocab: [] };

const ASSET_TAB_COPY: Record<AssetTab, { label: string; emptyTitle: string; emptyMessage: string }> = {
  methods: {
    label: "方法卡片库",
    emptyTitle: "还没有聚合后的方法卡片",
    emptyMessage: "完成课程处理后，这里会从所有真实 course_state 汇总知识卡片。",
  },
  words: {
    label: "词汇生词本",
    emptyTitle: "还没有跨课程生词本",
    emptyMessage: "当前版本先从 concept/work 类知识卡片临时生成词汇本。",
  },
  materials: {
    label: "佳句素材册",
    emptyTitle: "还没有聚合后的佳句素材",
    emptyMessage: "完成 S8 作文素材抽取后，这里会汇总主题表达、佳句和使用建议。",
  },
};

function AssetsPage({ courses }: { courses: CourseListItem[] }) {
  const [assetTab, setAssetTab] = useState<AssetTab>("methods");
  const [assets, setAssets] = useState<AssetsResponse>(EMPTY_ASSETS);
  const [assetStatus, setAssetStatus] = useState<LoadStatus>("idle");
  const [assetError, setAssetError] = useState("");
  const currentCopy = ASSET_TAB_COPY[assetTab];
  const entryCourses = courses.filter((course) => course.status === "completed" || course.status === "needs_human");
  const hasAnyAssets = assets.cards.length + assets.materials.length + assets.vocab.length > 0;

  const refreshAssets = useCallback(() => {
    setAssetStatus("loading");
    getAssets()
      .then((payload) => {
        setAssets({
          cards: payload.cards ?? [],
          materials: payload.materials ?? [],
          vocab: payload.vocab ?? [],
        });
        setAssetError("");
        setAssetStatus("success");
      })
      .catch((error: unknown) => {
        setAssets(EMPTY_ASSETS);
        setAssetError(errorDetail(error) || "请确认后端服务可访问后重试。");
        setAssetStatus("error");
      });
  }, []);

  useEffect(() => {
    refreshAssets();
  }, [refreshAssets]);

  return (
    <section className="asset-page">
      <div className="page-title-row">
        <div>
          <p className="page-kicker">知识沉淀</p>
          <h1 className="page-title">知识资产库</h1>
          <p className="muted">跨课程汇总知识卡片、词汇卡片和写作素材，全部来自真实 course_state。</p>
        </div>
        <button className="button-primary" disabled={assetStatus === "loading"} onClick={refreshAssets} type="button">
          {assetStatus === "loading" ? "刷新中" : "刷新资产"}
        </button>
      </div>
      <div className="asset-summary-row" aria-label="知识资产统计">
        <span className="tag">{assets.cards.length} 张卡片</span>
        <span className="tag">{assets.vocab.length} 条词汇</span>
        <span className="tag">{assets.materials.length} 条素材</span>
      </div>
      <div className="asset-tabs">
        {(Object.keys(ASSET_TAB_COPY) as AssetTab[]).map((tab) => (
          <button className={assetTab === tab ? "active" : ""} key={tab} onClick={() => setAssetTab(tab)} type="button">
            {ASSET_TAB_COPY[tab].label}
            <span>{assetCountForTab(assets, tab)}</span>
          </button>
        ))}
      </div>
      {assetStatus === "loading" && !hasAnyAssets ? (
        <StatePanel message="正在读取后端聚合投影。" title="正在加载知识资产" />
      ) : null}
      {assetStatus === "error" && !hasAnyAssets ? (
        <StatePanel message={assetError} onAction={refreshAssets} title="知识资产加载失败" />
      ) : null}
      {(assetStatus === "success" || hasAnyAssets) && (
        <AssetTabContent
          assets={assets}
          assetTab={assetTab}
          currentCopy={currentCopy}
          entryCourses={entryCourses}
        />
      )}
    </section>
  );
}

function AssetTabContent({
  assets,
  assetTab,
  currentCopy,
  entryCourses,
}: {
  assets: AssetsResponse;
  assetTab: AssetTab;
  currentCopy: (typeof ASSET_TAB_COPY)[AssetTab];
  entryCourses: CourseListItem[];
}) {
  if (assetTab === "methods" && assets.cards.length > 0) {
    return (
      <div className="asset-groups">
        {groupCardsByType(assets.cards).map(({ type, items }) => (
          <section className="asset-group" key={type}>
            <div className="section-row compact-row">
              <h2 className="section-heading">{CARD_TYPE_LABELS[type]}</h2>
              <span className="tag">{items.length} 张</span>
            </div>
            <div className="asset-grid">
              {items.map((card) => (
                <AssetKnowledgeCardView card={card} key={`${card.source.course_id}-${card.card_id}-${card.title}`} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (assetTab === "words" && assets.vocab.length > 0) {
    return (
      <div className="asset-grid">
        {assets.vocab.map((card) => (
          <AssetVocabCardView card={card} key={`${card.source.course_id}-${card.card_id}-${card.title}`} />
        ))}
      </div>
    );
  }

  if (assetTab === "materials" && assets.materials.length > 0) {
    return (
      <div className="asset-grid">
        {assets.materials.map((material) => (
          <AssetMaterialCardView
            key={`${material.source.course_id}-${material.material_id}-${material.title}`}
            material={material}
          />
        ))}
      </div>
    );
  }

  return <AssetEmptyState currentCopy={currentCopy} entryCourses={entryCourses} />;
}

function AssetKnowledgeCardView({ card }: { card: AssetKnowledgeCard }) {
  return (
    <article className="asset-card">
      <div className="asset-card-head">
        <span className="tag">{CARD_TYPE_LABELS[card.type]}</span>
        <SourceCourseButton source={card.source} />
      </div>
      <h3>{card.title}</h3>
      <p className="muted">{compactText(card.summary ?? card.example ?? card.core_points?.join("；"))}</p>
      {card.core_points?.length ? (
        <ul>
          {card.core_points.slice(0, 4).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      <AssetChunkMeta chunks={card.source_chunks} />
    </article>
  );
}

function AssetVocabCardView({ card }: { card: AssetKnowledgeCard }) {
  return (
    <article className="asset-card work-asset-card">
      <div className="asset-card-head">
        <span className="tag">{CARD_TYPE_LABELS[card.type]}</span>
        <SourceCourseButton source={card.source} />
      </div>
      <h3>{card.title}</h3>
      <p className="muted">{compactText(card.summary ?? card.example ?? card.core_points?.join("；"))}</p>
      {card.related_persons?.length || card.related_themes?.length ? (
        <div className="work-meta-list">
          {card.related_persons?.length ? <span>人物：{card.related_persons.join("、")}</span> : null}
          {card.related_themes?.length ? <span>主题：{card.related_themes.join("、")}</span> : null}
        </div>
      ) : null}
      <AssetChunkMeta chunks={card.source_chunks} />
    </article>
  );
}

function AssetMaterialCardView({ material }: { material: AssetWritingMaterial }) {
  return (
    <article className="asset-card">
      <div className="asset-card-head">
        <span className={`tag risk-${material.risk ?? "low"}`}>{material.risk ?? "low"}</span>
        <SourceCourseButton source={material.source} />
      </div>
      <h3>{material.title}</h3>
      {material.usable_expression ? <p className="work-quote">{material.usable_expression}</p> : null}
      <p className="muted">
        {compactText(material.usage_suggestion ?? material.teacher_comment ?? material.material_source)}
      </p>
      {material.theme?.length ? <div className="asset-tag-row">{material.theme.map((theme) => <span className="tag" key={theme}>{theme}</span>)}</div> : null}
      <AssetChunkMeta chunks={material.source_chunks} />
    </article>
  );
}

function AssetChunkMeta({ chunks }: { chunks?: string[] }) {
  if (!chunks?.length) return null;
  return <p className="source-chunk-meta">关联 {chunks.map(chunkLabel).join("、")}</p>;
}

function SourceCourseButton({ source }: { source: AssetSource }) {
  return (
    <button
      className="source-link asset-source-button"
      onClick={() => navigateTo({ name: "detail", courseId: source.course_id })}
      type="button"
    >
      来源课程：{source.course_title}
    </button>
  );
}

function AssetEmptyState({
  currentCopy,
  entryCourses,
}: {
  currentCopy: (typeof ASSET_TAB_COPY)[AssetTab];
  entryCourses: CourseListItem[];
}) {
  return (
    <div className="asset-empty-layout">
      <section className="empty-panel asset-empty-panel">
        <span className="asset-empty-icon" aria-hidden="true">□</span>
        <h2>{currentCopy.emptyTitle}</h2>
        <p className="muted">{currentCopy.emptyMessage}</p>
        <button className="button-secondary" onClick={() => navigateTo({ name: "courses" })} type="button">
          从课程进入
        </button>
      </section>
      <section className="asset-course-panel">
        <div className="section-row compact-row">
          <h2 className="section-heading">课程入口</h2>
          <span className="tag">{entryCourses.length} 篇可查看</span>
        </div>
        {entryCourses.length > 0 ? (
          <div className="asset-course-list">
            {entryCourses.slice(0, 6).map((course) => (
              <article className="asset-course-entry" key={course.course_id}>
                <div>
                  <h3>{course.title}</h3>
                  <p className="muted">{[course.subtitle, course.teacher, course.type].filter(Boolean).join(" · ") || course.course_id}</p>
                </div>
                <span className={`tag status-${course.status}`}>{STATUS_LABELS[course.status]}</span>
                <button className="tiny-button" onClick={() => navigateTo({ name: "detail", courseId: course.course_id })} type="button">
                  查看课程资源
                </button>
              </article>
            ))}
          </div>
        ) : (
          <StatePanel message="完成课程处理后，这里会列出可进入详情页查看资源的真实课程。" title="暂无可用课程入口" />
        )}
      </section>
    </div>
  );
}

function groupCardsByType(cards: AssetKnowledgeCard[]): Array<{ type: KnowledgeCard["type"]; items: AssetKnowledgeCard[] }> {
  const groups = new Map<KnowledgeCard["type"], AssetKnowledgeCard[]>();
  cards.forEach((card) => {
    const items = groups.get(card.type) ?? [];
    items.push(card);
    groups.set(card.type, items);
  });
  return Array.from(groups, ([type, items]) => ({ type, items }));
}

function assetCountForTab(assets: AssetsResponse, tab: AssetTab): number {
  if (tab === "methods") return assets.cards.length;
  if (tab === "words") return assets.vocab.length;
  return assets.materials.length;
}

export function App() {
  const route = useRoute();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [listError, setListError] = useState("");
  const [listStatus, setListStatus] = useState<LoadStatus>("idle");
  const [upload, setUpload] = useState<UploadState>(INITIAL_UPLOAD_STATE);
  const [exportTarget, setExportTarget] = useState<{ courseId?: string; version: VersionKey; title?: string }>({
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
    eventSourceRef.current = null;
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
      let source: EventSource;
      source = subscribeCourseEvents(
        result.course_id,
        (event) => {
          if (eventSourceRef.current !== source) return;
          const nextStatus =
            event.overall_status === "completed"
              ? "completed"
              : event.overall_status === "failed" || event.stage_status === "failed"
                ? "failed"
                : "processing";
          setUpload((current) => ({
            ...current,
            status: nextStatus,
            progress: nextStatus === "completed" ? 1 : progressForStatusEvent(event, current.progress),
            message: event.message ?? event.stage_label ?? current.message,
            events: [...current.events, event].slice(-12),
          }));
          if (nextStatus === "completed" || nextStatus === "failed") {
            source.close();
            eventSourceRef.current = null;
            refreshCourses();
            if (nextStatus === "completed") {
              navigateTo({ name: "detail", courseId: result.course_id });
            }
          }
        },
        () => {
          if (eventSourceRef.current !== source) return;
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
          source.close();
          eventSourceRef.current = null;
          refreshCourses();
        },
      );
      eventSourceRef.current = source;
      refreshCourses();
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      const failedEvent: StatusEvent = {
        course_id: "upload",
        stage: "上传",
        stage_label: "上传失败",
        stage_status: "failed",
        overall_status: "failed",
        message,
      };
      setUpload((current) => ({
        ...current,
        status: "failed",
        progress: 0,
        message,
        events: [
          ...current.events,
          current.courseId ? { ...failedEvent, course_id: current.courseId } : failedEvent,
        ].slice(-12),
      }));
    }
  };

  const openExport = (courseId: string, version: VersionKey = DEFAULT_VERSION, title?: string) => {
    const courseTitleFromList = courses.find((course) => course.course_id === courseId)?.title;
    setExportTarget({ courseId, version, title: title ?? courseTitleFromList ?? courseId });
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
        title={exportTarget.title}
        version={exportTarget.version}
      />
    </div>
  );
}
