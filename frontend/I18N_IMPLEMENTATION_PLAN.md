# IMMI-Case React SPA i18n 實現計劃

## 進度概述

### ✅ 已完成（第一階段）

#### 基礎設施
- [x] 安裝 i18next 依賴 (`react-i18next`, `i18next`, `i18next-browser-languagedetector`)
- [x] 建立 `frontend/src/i18n/index.ts` (i18next 初始化)
- [x] 建立 `frontend/src/i18n/locales/en.json` (235 個可翻譯字串)
- [x] 建立 `frontend/scripts/translate-locales.ts` (自動翻譯腳本)
- [x] 執行翻譯生成 `frontend/src/i18n/locales/zh-TW.json`
- [x] 在 `frontend/src/main.tsx` 導入 i18n

#### Layout & Navigation
- [x] `frontend/src/components/layout/Topbar.tsx` - 語言切換按鈕（EN/中文）
- [x] `frontend/src/components/layout/Sidebar.tsx` - 導航標籤翻譯

#### 構建驗證
- [x] 無 TypeScript 錯誤
- [x] 打包成功（2.86s）

---

### 🔄 待完成（第二階段）

#### Pages（14 個）優先級排序

**高優先級（核心功能）**:
1. [ ] `DashboardPage.tsx` - 儀表板頁面標題、按鈕、標籤、空狀態文字
2. [ ] `CasesPage.tsx` - 案例瀏覽頁面表格標頭、過濾器標籤、空狀態
3. [ ] `CaseDetailPage.tsx` - 案例詳細資訊頁面標題、工具列、側邊欄文字
4. [ ] `AnalyticsPage.tsx` - 分析頁面圖表標題、計算器標籤
5. [ ] `JudgeProfilesPage.tsx` - 法官頁面表格標頭、篩選器標籤
6. [ ] `JudgeDetailPage.tsx` - 法官詳細資訊頁面

**中優先級（數據工具）**:
7. [ ] `DownloadPage.tsx` - 下載頁面標籤、按鈕
8. [ ] `PipelinePage.tsx` - 管道頁面步驟標題、說明文字
9. [ ] `JobStatusPage.tsx` - 工作狀態頁面表格標頭、狀態標籤
10. [ ] `CaseComparePage.tsx` - 案例比較頁面
11. [ ] `JudgeComparePage.tsx` - 法官比較頁面

**低優先級（參考資料）**:
12. [ ] `DataDictionaryPage.tsx` - 數據字典（欄位類型、可編輯提示）
13. [ ] `DesignTokensPage.tsx` - 設計令牌頁面
14. [ ] `CaseEditPage.tsx` & `CaseAddPage.tsx` - 案例編輯/新增頁面

#### Shared Components（18 個）

**高優先級**:
- [ ] `Pagination.tsx` - "Showing {{start}}-{{end}} of {{total}}"
- [ ] `GlobalSearch.tsx` - 搜尋占位符、快捷鍵提示
- [ ] `ConfirmModal.tsx` - 刪除確認對話框標題、訊息
- [ ] `ApiErrorState.tsx` - 錯誤訊息、重試按鈕
- [ ] `OutcomeBadge.tsx` - Outcome 標籤翻譯（Remitted、Affirmed 等）
- [ ] `EmptyState.tsx` - 空狀態標題、描述

**中優先級**:
- [ ] `AnalyticsFilters.tsx` - 過濾器標籤（法院、年份範圍等）
- [ ] `CourtBadge.tsx` - 簡單標籤（通常不翻譯，但留出接口）
- [ ] `Breadcrumb.tsx` - 麵包屑導航文字
- [ ] `FilterPill.tsx` - 過濾條件標籤
- [ ] `NatureBadge.tsx` - 案例類別標籤
- [ ] 其他 12 個 shared 組件

#### Analytics Components（14 個）

**高優先級**:
- [ ] `ChartCard.tsx` - 圖表卡片標題框架
- [ ] `SuccessRateCalculator.tsx` - 計算器標籤、輸入佔位符
- [ ] `TopJudgesChart.tsx` - 圖表標題
- [ ] `OutcomeByCourtChart.tsx` - 圖表標題
- [ ] `LegalConceptsChart.tsx` - 圖表標題

**其他 9 個**:
- [ ] `OutcomeTrendChart.tsx`
- [ ] `OutcomeBySubclassChart.tsx`
- [ ] `ConceptEffectivenessChart.tsx`
- [ ] `ConceptTrendChart.tsx`
- [ ] `ConceptCooccurrenceHeatmap.tsx`
- [ ] `NatureOutcomeHeatmap.tsx`
- [ ] `ConceptComboTable.tsx`
- [ ] `ConceptCourtBreakdown.tsx`
- [ ] `EmergingConceptsBadges.tsx`

#### Judges Components（8 個）

- [ ] `JudgeLeaderboard.tsx` - 表格標頭、排序提示
- [ ] `JudgeBioCard.tsx` - 卡片標籤
- [ ] `CourtComparisonCard.tsx` - 比較標籤
- [ ] `RepresentationCard.tsx` - 統計標題
- [ ] `ConceptEffectivenessTable.tsx` - 表格標頭
- [ ] `CountryOriginChart.tsx` - 圖表標題
- [ ] `VisaBreakdownChart.tsx` - 圖表標題
- [ ] `JudgeProfileHeader.tsx` - 標頭文字

#### Dashboard Components（5 個）

- [ ] `StatCard.tsx` - 統計卡片標題、描述
- [ ] `CourtChart.tsx` - 圖表標題
- [ ] `NatureChart.tsx` - 圖表標題
- [ ] `TrendChart.tsx` - 圖表標題
- [ ] `SubclassChart.tsx` - 圖表標題

#### Cases Components（2 個）

- [ ] `CaseCard.tsx` - 卡片標籤、狀態文字
- [ ] `CaseTextViewer.tsx` - **僅翻譯 UI 工具列，不翻譯全文**

---

## 修改模板

### 簡單模式：靜態字串

```tsx
// 之前
<h2>Judge Profiles</h2>

// 之後
import { useTranslation } from "react-i18next"

export function MyComponent() {
  const { t } = useTranslation()
  
  return <h2>{t("nav.judge_profiles")}</h2>
}
```

### 進階模式：動態插值

```tsx
// 之前
<span>Showing {start}-{end} of {total}</span>

// 之後
<span>{t("pagination.showing", { start, end, total })}</span>
```

### 條件翻譯

```tsx
// 之前
{isLoading && "Loading..."}

// 之後
{isLoading && t("common.loading_ellipsis")}
```

---

## i18n 金鑰對應

### 導航相關
```
nav.dashboard         → "Dashboard"
nav.browse           → "Browse"
nav.cases            → "Cases"
nav.judge_profiles   → "Judge Profiles"
nav.analytics        → "Analytics"
nav.download         → "Download"
nav.pipeline         → "Pipeline"
nav.data_tools       → "Data Tools"
nav.reference        → "Reference"
nav.data_dictionary  → "Data Dictionary"
nav.design_tokens    → "Design Tokens"
```

### 常用字串
```
common.search                → "Search"
common.search_placeholder    → "Search..."
common.loading_ellipsis      → "Loading..."
common.cancel                → "Cancel"
common.confirm               → "Confirm"
common.retry                 → "Retry"
buttons.start_pipeline       → "Start Pipeline"
buttons.export_csv           → "Export CSV"
```

### 案例相關
```
cases.title                  → "Cases"
cases.case_details           → "Case Details"
cases.citation               → "Citation"
cases.court                  → "Court"
cases.outcome                → "Outcome"
outcomes.affirmed            → "Affirmed"
outcomes.dismissed           → "Dismissed"
outcomes.remitted            → "Remitted"
```

### 法官相關
```
judges.title                 → "Judge Profiles"
judges.approval_rate         → "Approval Rate"
judges.total_cases           → "Total Cases"
judges.biography             → "Biography"
```

### 分析相關
```
analytics.title              → "Analytics"
analytics.success_rate       → "Success Rate"
analytics.outcome_by_court   → "Outcome by Court"
```

---

## 測試清單

在修改每個組件後，驗證：

- [ ] `npm run build` 無錯誤
- [ ] 瀏覽器開發工具無 console 警告
- [ ] 語言切換正常（EN ↔ 中文）
- [ ] localStorage 記住語言選擇（重新整理頁面後保持）
- [ ] 所有 `{{variable}}` 插值正確顯示（不顯示 `[IMMI_VAR_n]`）
- [ ] 案例全文（`CaseTextViewer`）保持英文原文
- [ ] 後端 API 資料（法官名、法院名、案例標題）保持英文原文

---

## 優化建議

### 代碼分割
- 考慮使用 React.lazy 搭配 Suspense 分割大型 pages
- 當前 index-BWd3EH6i.js 538.93 kB，超過 500 kB 警告

### 效能考量
- i18next 預設同步加載，已足夠（文件大小 <5 KB）
- 無需延遲加載語言檔案

### 未來擴展
- 新增語言只需：
  1. 建立 `frontend/src/i18n/locales/{lang}.json`
  2. 更新 `i18n/index.ts` 的 resources
  3. 重新執行翻譯腳本或手動翻譯
  4. 更新 `Topbar.tsx` 語言選項（如需）

---

## 成本與統計

| 指標 | 數值 |
|------|------|
| 英文字串數 | 235 |
| 英文字元數 | ~7,000 |
| 翻譯 API 費率 | $20/100 萬字元 |
| **實際成本** | **$0.00**（免費額度內） |
| Google Translate 免費額度 | 500,000 字元/月 |
| 檔案大小增幅 | +3-5 KB（gzip） |

---

## 後續步驟

1. **完成第二階段**: 按優先級修改所有 pages 和 components
2. **E2E 測試**: 執行 `npm run e2e` 確保所有 E2E 測試通過（預期英文環境）
3. **手動測試**: 在瀏覽器中逐頁測試中英切換
4. **提交**: `git add` i18n 檔案 + 修改過的 components，建立 PR
5. **文檔更新**: 在主 README.md 中記錄 i18n 支援

---

## 常見問題

### Q: 為什麼不翻譯案例全文？
A: 案例是法律文件，原文準確性至關重要。使用者可透過瀏覽器翻譯擴展自行翻譯全文。

### Q: 為什麼不翻譯後端 API 資料（法官名、法院名等）？
A: 這些是資料庫中的英文原文，翻譯會造成資料不一致。應在 UI 層翻譯標籤，資料保持原樣。

### Q: 如何在新頁面快速加入 i18n？
A: 
1. 在頁面 import `useTranslation`
2. 呼叫 `const { t } = useTranslation()`
3. 將所有硬編碼字串替換為 `t("key.name")`
4. 檢查字串是否在 en.json 中，沒有則新增

### Q: 如何新增新字串到翻譯？
A:
1. 在 `en.json` 中新增 key-value
2. 執行 `GOOGLE_TRANSLATE_API_KEY="..." npx tsx scripts/translate-locales.ts` 重新翻譯
3. 手動驗證中文翻譯質量，必要時編輯 zh-TW.json

---

**更新於**: 2026-02-19
**作者**: Claude Code i18n 實現
**狀態**: 第一階段完成，等待第二階段開發
