# i18n 翻譯快速指南（子代理用）

## 快速開始

### 1. 導入 useTranslation
```tsx
import { useTranslation } from "react-i18next"
```

### 2. 在組件中使用
```tsx
export function MyComponent() {
  const { t } = useTranslation()
  // 現在可以使用 t() 函數
}
```

### 3. 替換字串的三種模式

#### A. 簡單字串
```tsx
// 之前：<h2>Judge Profiles</h2>
// 之後：<h2>{t("nav.judge_profiles")}</h2>
```

#### B. 動態插值
```tsx
// 之前：<span>Showing {start}-{end} of {total}</span>
// 之後：<span>{t("pagination.showing", { start, end, total })}</span>
```

#### C. 條件文字
```tsx
// 之前：{isLoading && "Loading..."}
// 之後：{isLoading && t("common.loading_ellipsis")}
```

## 常用 i18n 金鑰

### 導航
- `nav.dashboard`, `nav.cases`, `nav.judge_profiles`, `nav.analytics`
- `nav.download`, `nav.pipeline`, `nav.data_tools`

### 通用
- `common.search`, `common.loading_ellipsis`, `common.retry`
- `common.cancel`, `common.confirm`, `common.delete`

### 按鈕
- `buttons.start_pipeline`, `buttons.export_csv`

### 儀表板
- `dashboard.title`, `dashboard.total_cases`, `dashboard.with_full_text`

### 分頁
- `pagination.showing` (使用插值：start, end, total)

### 案例
- `cases.title`, `cases.case_details`, `cases.citation`
- `cases.court`, `cases.outcome`, `cases.empty_state_title`

### 法官
- `judges.title`, `judges.total_cases`, `judges.approval_rate`
- `judges.biography`, `judges.court_comparison`

### 分析
- `analytics.title`, `analytics.success_rate`

### 過濾器
- `filters.court`, `filters.year_from`, `filters.outcome`
- `filters.show_with_full_text`, `filters.clear_filters`

### 狀態/錯誤
- `empty_states.no_cases_title`, `empty_states.no_data`
- `errors.api_error`, `errors.failed_to_load`

## 檔案位置

**翻譯檔案** (Git 追蹤):
- `frontend/src/i18n/locales/en.json` — 英文來源
- `frontend/src/i18n/locales/zh-TW.json` — 繁體中文

**檢查 key 是否存在**:
```bash
# 在 frontend 目錄
jq '.nav.dashboard' src/i18n/locales/en.json
jq '.nav.dashboard' src/i18n/locales/zh-TW.json
```

## 新增字串的流程

如果遇到在 JSON 中找不到的字串：

1. **編輯 en.json**，在適當分類中新增：
   ```json
   {
     "my_category": {
       "new_key": "English text here"
     }
   }
   ```

2. **手動在 zh-TW.json 中新增中文** (或申請翻譯):
   ```json
   {
     "my_category": {
       "new_key": "中文文本"
     }
   }
   ```

3. **不翻譯的情況**：
   - 案例全文（`CaseTextViewer` 的 text prop）
   - API 資料名稱（法官名、法院名、案例標題）
   - 結果值常數（Affirmed/Dismissed）

## 驗證清單

修改每個檔案後：

- [ ] 導入 `useTranslation` ✓
- [ ] 呼叫 `const { t } = useTranslation()` ✓
- [ ] 所有硬編碼字串替換為 `t()` ✓
- [ ] 複雜插值使用 `t("key", { var1, var2 })` ✓
- [ ] 在 en.json 和 zh-TW.json 中都有對應 key ✓
- [ ] 運行 `npm run build` 無 TypeScript 錯誤 ✓

## 常見錯誤

### ❌ 錯誤 1：忘記導入
```tsx
// WRONG
export function MyComponent() {
  return <h1>{t("nav.dashboard")}</h1>  // t 未定義！
}

// CORRECT
import { useTranslation } from "react-i18next"
export function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t("nav.dashboard")}</h1>
}
```

### ❌ 錯誤 2：字串在 JSON 中不存在
```tsx
// WRONG
t("nav.nonexistent_key")  // 會回傳 "nav.nonexistent_key" 字面值！

// CORRECT
// 先在 en.json 和 zh-TW.json 中新增該 key
t("nav.my_new_key")
```

### ❌ 錯誤 3：忘記插值變數
```tsx
// WRONG - 插值變數不會被替換
<span>{t("pagination.showing")}</span>

// CORRECT
<span>{t("pagination.showing", { start, end, total })}</span>
```

### ❌ 錯誤 4：翻譯不該翻譯的內容
```tsx
// WRONG - 案例全文不應翻譯
<div>{t(caseText)}</div>

// CORRECT - 保持原樣
<CaseTextViewer text={caseText} />
```

## 並行工作建議

由於有 49 個檔案要修改，建議按以下順序並行：

**第 1 波**（同時進行）:
- Pages: Dashboard, Cases, CaseDetail, AnalyticsPage
- Shared: Pagination, GlobalSearch, ConfirmModal, ApiErrorState

**第 2 波**（同時進行）:
- Pages: JudgeProfiles, Download, Pipeline
- Analytics: ChartCard, TopJudgesChart, OutcomeByCourtChart

**第 3 波**（同時進行）:
- Judges: JudgeLeaderboard, JudgeBioCard, CourtComparison
- Dashboard: StatCard, CourtChart, NatureChart

## 提交檢查

完成修改後，每個子代理應該：

1. 執行 `npm run build` — 檢查 TypeScript 無誤
2. 檢查新增/修改的字串都在 JSON 中
3. 提交更改到 Git

範例提交訊息：
```
i18n: integrate useTranslation in {ComponentName} and related pages

- Added useTranslation() hooks to {count} components
- Translated {count} strings using i18n keys
- Verified en.json and zh-TW.json have all keys
```

---

**總線索**: 235 個字串 ÷ 49 個檔案 ≈ 5 字串/檔案
**目標**: 每個子代理快速修改 6-8 個檔案，完成後通知主代理

