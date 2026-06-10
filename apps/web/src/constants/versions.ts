export const VERSION_TIERS = [
  {
    key: "faithful",
    label: "保真清洗",
    description: "对照原文、保留课堂感",
  },
  {
    key: "concise",
    label: "精简整理",
    description: "默认阅读档，给妈妈看的可读笔记",
  },
  {
    key: "study",
    label: "学习整理",
    description: "更浓缩的复习要点",
  },
  {
    key: "outline",
    label: "结构提纲",
    description: "最浓缩框架",
  },
] as const;

export type VersionKey = (typeof VERSION_TIERS)[number]["key"];

export const DEFAULT_VERSION: VersionKey = "concise";

export const VERSION_LABELS: Record<VersionKey, string> = VERSION_TIERS.reduce(
  (labels, tier) => ({ ...labels, [tier.key]: tier.label }),
  {} as Record<VersionKey, string>,
);

export function isVersionKey(value: string | undefined): value is VersionKey {
  return VERSION_TIERS.some((tier) => tier.key === value);
}
