# TextCore / 文心 视觉风格与 CSS 规范 v0.1

> 用途：指导下一步高保真可点击 HTML 原型制作。
> 参考图：
> - `00_产品设计/设计稿/AGY设计师/textcore_homepage_hifi.png`
> - `00_产品设计/设计稿/AGY设计师_新版/detailspage_hifi.png`
> - `00_产品设计/设计稿/AGY设计师_新版/assetspage_hifi.png`

## 1. 整体风格定义

文心的视觉风格应是：

**安静、克制、纸感、阅读友好、有一点东方文字气质的本地文档工作台。**

关键词：

- 本地运行。
- 课程文档。
- 纸张和讲义。
- 书桌感。
- 克制红色。
- 米白背景。
- 长文阅读。
- 卡片化知识资产。

避免：

- 营销页风格。
- 强科技感。
- 大面积渐变。
- 复杂知识图谱装饰。
- 高饱和撞色。
- 过强阴影。
- 过圆的卡片。

## 2. 色彩系统

### 2.1 主色

主色来自参考图中的深红 / 朱砂红，用于顶部导航、Logo、主按钮、选中态。

```css
--color-primary: #a6231f;
--color-primary-dark: #821916;
--color-primary-soft: #c94538;
```

使用场景：

- 顶部导航背景或选中态。
- Logo 图标背景。
- 主按钮：导出 Word、查看整理结果。
- 当前 Tab 下划线。
- 关键高亮小圆点。

注意：

红色要克制使用，不要铺满整个页面。若顶部已使用红色，主体区域应保持米白和黑色文字。

### 2.2 背景色

参考图整体是暖米白、纸张感。

```css
--color-bg: #f6f0e4;
--color-bg-soft: #fbf7ee;
--color-surface: #fffdf7;
--color-surface-muted: #f3ecdf;
```

使用场景：

- 页面背景：`--color-bg`。
- 主内容卡片：`--color-surface`。
- 引用、原文、复核块：`--color-surface-muted`。

### 2.3 文字色

```css
--color-text: #1f1a17;
--color-text-muted: #6f665d;
--color-text-subtle: #9b9288;
```

使用场景：

- 正文：`--color-text`。
- 次要信息：`--color-text-muted`。
- 时间、状态、来源信息：`--color-text-subtle`。

### 2.4 边框与分割线

```css
--color-border: #e4d9c9;
--color-border-strong: #d4c6b4;
```

使用场景：

- 顶部导航下边线。
- 卡片边框。
- 表格行分割。
- 右侧栏边界。

### 2.5 状态色

```css
--color-success: #4d9a73;
--color-warning: #b98a2e;
--color-danger: #b44a3e;
--color-review: #8d857c;
```

使用场景：

- 本地运行中绿点。
- 处理步骤完成状态。
- 复核标记使用灰色，不用强红。

## 3. 字体与排版

### 3.1 字体

建议字体：

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "PingFang SC",
  "Noto Serif SC",
  "Noto Sans SC",
  "Microsoft YaHei",
  sans-serif;
```

策略：

- UI 导航、按钮、表格使用系统黑体。
- 长文标题可适度使用宋体 / Serif 风格，但不强依赖外部字体。
- 正文以可读性为先，不追求强装饰。

### 3.2 字号层级

```css
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 22px;
--font-size-2xl: 28px;
--font-size-3xl: 34px;
```

建议使用：

- 顶部导航：16px。
- 页面标题：28px 到 34px。
- 卡片标题：20px 到 22px。
- 正文：17px 到 18px。
- 正文行高：1.85 到 2。
- 辅助卡片正文：14px 到 15px。

### 3.3 阅读区排版

课程详情页正文是核心，应优先保证可读性。

```css
.reading-content {
  max-width: 760px;
  font-size: 18px;
  line-height: 1.9;
}
```

正文段落：

```css
.reading-content p {
  margin: 0 0 22px;
}
```

正文标题：

```css
.reading-content h2 {
  margin: 40px 0 18px;
  font-size: 28px;
  line-height: 1.35;
}
```

## 4. 布局系统

### 4.1 页面容器

参考图呈现为居中的桌面应用界面，页面背景偏暖。

```css
.app-shell {
  min-height: 100vh;
  background: var(--color-bg);
}

.page-container {
  width: min(1200px, calc(100% - 48px));
  margin: 0 auto;
}
```

### 4.2 顶部导航

两种可选：

1. 红色实底导航：更接近 `textcore_homepage_hifi.png`。
2. 米白导航 + 红色选中下划线：更接近 `detailspage_hifi.png` 和 `assetspage_hifi.png`。

原型建议：

- 工作台使用红色实底导航，形成产品识别。
- 详情页和资产库使用米白导航，降低阅读干扰。

统一结构：

```text
Logo | 工作台 | 课稿列表 | 知识资产库 | 本地运行中
```

CSS：

```css
.topbar {
  height: 72px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
}

.nav-link {
  height: 72px;
  display: inline-flex;
  align-items: center;
  padding: 0 28px;
  font-size: 17px;
  color: var(--color-text);
}

.nav-link.active {
  color: var(--color-primary);
  border-bottom: 3px solid var(--color-primary);
}
```

### 4.3 工作台布局

参考图：左上传，右进度与历史。

```css
.workspace-grid {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr);
  gap: 56px;
  align-items: start;
}
```

上传区：

```css
.upload-panel {
  min-height: 520px;
  border: 1px dashed var(--color-border-strong);
  border-radius: 12px;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 4.4 课程详情页布局

参考图：正文左侧大阅读区，右侧知识卡片和作文素材。

```css
.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
}

.reading-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
```

阅读面板内部：

```css
.version-tabs {
  height: 64px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
}

.reading-body {
  padding: 44px 56px;
}
```

### 4.5 知识资产库布局

参考图：顶部二级 Tab + 卡片网格。

```css
.asset-tabs {
  display: flex;
  gap: 40px;
  border-bottom: 1px solid var(--color-border);
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(260px, 1fr));
  gap: 24px;
}
```

## 5. 组件规范

### 5.1 Logo

结构：

```text
[红色方形“文”图标] 文心
                  TextCore
```

CSS：

```css
.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 700;
}
```

### 5.2 主按钮

用于“导出 Word”“查看整理结果”。

```css
.button-primary {
  height: 48px;
  padding: 0 22px;
  border: 0;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
```

### 5.3 次按钮

用于“显示原文对照”“取消”。

```css
.button-secondary {
  height: 44px;
  padding: 0 18px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
}
```

### 5.4 Tab

版本 Tab：

```css
.tab {
  position: relative;
  height: 64px;
  padding: 0 28px;
  display: inline-flex;
  align-items: center;
  color: var(--color-text-muted);
  font-size: 17px;
}

.tab.active {
  color: var(--color-text);
  font-weight: 650;
}

.tab.active::after {
  content: "";
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: -1px;
  height: 3px;
  background: var(--color-primary);
  border-radius: 3px 3px 0 0;
}
```

### 5.5 知识卡片

参考图中卡片为白底、细边框、轻阴影或无阴影，圆角克制。

```css
.knowledge-card {
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.knowledge-card h3 {
  margin: 0 0 10px;
  font-size: 20px;
}
```

### 5.6 引用 / 原文块

课程详情图中有浅底引用块，用于保留学生回答、原文对照、复核片段。

```css
.quote-block {
  margin: 28px 0;
  padding: 24px 28px;
  border-radius: 10px;
  background: var(--color-surface-muted);
  color: var(--color-text);
}
```

### 5.7 复核标记

复核标记低干扰，灰色虚线或下划线。

```css
.review-mark {
  color: var(--color-review);
  border-bottom: 1px dotted var(--color-review);
  background: rgba(141, 133, 124, 0.08);
}
```

### 5.8 状态点

用于“本地运行中”。

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-success);
}
```

## 6. 响应式规则

第一版以桌面为主，但手机需要能查看。

断点：

```css
--breakpoint-tablet: 900px;
--breakpoint-mobile: 640px;
```

移动端策略：

- 顶部导航横向滚动或折叠菜单。
- 工作台两列变一列。
- 课程详情页右侧栏下移到正文下方。
- 阅读正文字号保持 17px，不要过小。
- 卡片网格改为单列。

CSS：

```css
@media (max-width: 900px) {
  .workspace-grid,
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .side-panel {
    order: 2;
  }
}
```

## 7. 页面对应风格要求

### 工作台

参考：`textcore_homepage_hifi.png`

风格：

- 可以使用红色顶部导航。
- 上传区大而安静。
- 右侧处理进度清晰。
- 操作按钮使用主红色。

### 课程详情页

参考：`detailspage_hifi.png`

风格：

- 阅读优先。
- 顶部可用米白导航，减少红色干扰。
- 主体阅读面板白底纸感。
- 右侧卡片不要太密。
- 导出按钮可以使用主红色。

### 知识资产库

参考：`assetspage_hifi.png`

风格：

- 卡片网格。
- 二级 Tab 清晰。
- 卡片标题强调。
- 内容密度略高于详情页右侧栏，但仍保持纸感。

## 8. CSS Token 汇总

```css
:root {
  --color-primary: #a6231f;
  --color-primary-dark: #821916;
  --color-primary-soft: #c94538;

  --color-bg: #f6f0e4;
  --color-bg-soft: #fbf7ee;
  --color-surface: #fffdf7;
  --color-surface-muted: #f3ecdf;

  --color-text: #1f1a17;
  --color-text-muted: #6f665d;
  --color-text-subtle: #9b9288;

  --color-border: #e4d9c9;
  --color-border-strong: #d4c6b4;

  --color-success: #4d9a73;
  --color-warning: #b98a2e;
  --color-danger: #b44a3e;
  --color-review: #8d857c;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;

  --shadow-soft: 0 12px 30px rgba(80, 48, 24, 0.08);

  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 22px;
  --font-size-2xl: 28px;
  --font-size-3xl: 34px;
}
```

## 9. HTML 原型实现建议

文件结构建议：

```text
prototype/
├── index.html
├── courses.html
├── course-detail.html
├── assets.html
├── styles.css
└── app.js
```

实现原则：

- 先做静态 HTML/CSS/JS。
- 使用假数据。
- 不接真实上传。
- 交互只做页面跳转、Tab、弹窗、抽屉、对照模式。
- 所有页面复用同一套顶部导航和 CSS token。

