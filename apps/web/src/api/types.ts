import type { VersionKey } from "../constants/versions";

export type CourseStatus = "created" | "processing" | "completed" | "failed" | "needs_human";
export type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type Risk = "low" | "medium" | "high";

export interface CourseListItem {
  course_id: string;
  title: string;
  subtitle?: string;
  teacher?: string;
  type?: string;
  status: CourseStatus;
  review_count?: number;
  updated_at?: string;
}

export interface StatusEvent {
  course_id: string;
  stage: string;
  stage_label?: string;
  stage_status: StageStatus;
  overall_status?: CourseStatus;
  progress?: number;
  chunk_index?: number;
  chunk_total?: number;
  message?: string;
  ts?: string;
}

export interface Paragraph {
  pid: string;
  text: string;
  speaker?: string;
  ts?: string;
  style?: string;
  source_order: number;
}

export interface OutlineNode {
  title: string;
  level?: number;
  anchor?: string;
  chunk_ids?: string[];
  children?: OutlineNode[];
}

export interface Chunk {
  chunk_id: string;
  paragraph_range: [string, string];
  primary_type?: string;
  context_before?: string;
  must_preserve_spans?: Array<{ text: string; reason: string }>;
}

export interface ClassicsRef {
  ref_id?: string;
  chunk_id: string;
  matched: boolean;
  source?: "gushiwen" | "guwen" | "none";
  title?: string;
  writer?: string;
  dynasty?: string;
  canonical_text?: string;
  translation?: string;
  remark?: string;
  shangxi?: string;
  diffs?: Array<{ pid?: string; raw: string; canonical: string }>;
  confidence?: number;
  ref_url?: string;
}

export interface CourseVersion {
  body_md: string;
  compression?: number;
  char_count?: number;
}

export interface KnowledgeCard {
  card_id: string;
  title: string;
  type: "method" | "person" | "event" | "concept" | "work" | "theme" | "mistake";
  summary?: string;
  core_points?: string[];
  example?: string;
  related_persons?: string[];
  related_themes?: string[];
  source_chunks?: string[];
  classics_ref_id?: string;
  confidence?: number;
}

export interface WritingMaterial {
  material_id: string;
  title: string;
  theme?: string[];
  source?: string;
  usable_expression?: string;
  teacher_comment?: string;
  usage_suggestion?: string;
  source_chunks?: string[];
  risk?: Risk;
}

export interface AssetSource {
  course_id: string;
  course_title: string;
}

export type AssetKnowledgeCard = KnowledgeCard & {
  source: AssetSource;
};

export interface AssetWritingMaterial extends Omit<WritingMaterial, "source"> {
  source: AssetSource;
  material_source?: string;
}

export interface AssetsResponse {
  cards: AssetKnowledgeCard[];
  materials: AssetWritingMaterial[];
  vocab: AssetKnowledgeCard[];
}

export interface ReviewFlag {
  flag_id?: string;
  pid?: string;
  chunk_id?: string;
  text: string;
  suggestion?: string;
  reason: string;
  category?:
    | "transcription_error"
    | "uncertain_person"
    | "uncertain_title"
    | "classical_typo"
    | "unclear_reading"
    | "other";
  severity?: Risk;
  status?: "open" | "resolved" | "dismissed";
}

export interface CourseState {
  course_id: string;
  schema_version: "1.0";
  status: CourseStatus;
  source: {
    file: string;
    stored_path?: string;
    imported_at?: string;
    detected_meta?: {
      course_title?: string;
      teacher?: string;
      date?: string;
      student_group?: string;
      content_type_candidates?: string[];
    };
  };
  course_types?: {
    types?: Array<{ type: string; confidence: number }>;
    dominant_type?: string;
    mixed?: boolean;
  };
  paragraphs?: Paragraph[];
  chunks?: Chunk[];
  classics_refs?: ClassicsRef[];
  global?: {
    course_summary?: string;
    outline_tree?: OutlineNode[];
    main_themes?: string[];
    merged_review_flags?: ReviewFlag[];
  };
  versions?: Record<VersionKey, CourseVersion>;
  default_version?: VersionKey;
  knowledge_cards?: KnowledgeCard[];
  writing_materials?: WritingMaterial[];
  review_flags?: ReviewFlag[];
  quality?: {
    quality_score?: number;
    coverage?: "poor" | "fair" | "good";
    main_risks?: string[];
    recommended_human_review?: boolean;
  };
  processing_log?: {
    stages?: Array<{
      stage: string;
      status: StageStatus;
      started_at?: string;
      ended_at?: string;
      note?: string;
    }>;
  };
}
