# Legal Concepts 資料品質分析報告

**分析日期**: 2026-02-15
**資料集**: `/Users/d/Developer/IMMI-Case-/downloaded_cases/immigration_cases.csv`
**總記錄數**: 62,536

---

## 執行摘要

本報告對 `legal_concepts` 欄位進行全面的資料品質檢查，涵蓋分布分析、垃圾值檢測、一致性驗證、缺失值分析等多個維度。

### 關鍵發現

✅ **整體填充率佳**: 99.14% 的記錄有 legal_concepts (61,999/62,536)

⚠️ **主要品質問題**:
1. **大小寫不一致** - 678 個 concepts 有多種大小寫變體（例如 "Jurisdictional error" vs "jurisdictional error"）
2. **過多前後空白** - 92,518 個 concept tokens 有多餘空白
3. **ARTA 法院缺失率高** - ARTA 有 9.97% 缺失率（225/2,257），遠高於其他法院
4. **泛用詞氾濫** - 128 個記錄只有泛用詞如 "Review"、"Migration"
5. **記錄內重複** - 5 個記錄有重複的 concepts
6. **垃圾值** - 包含數字、單字母、HTML 遺留、過長片段等異常值

---

## 1. 基本統計

| 指標 | 數值 | 百分比 |
|------|------|--------|
| 總記錄數 | 62,536 | 100.00% |
| 有 legal_concepts | 61,999 | 99.14% |
| 缺少 legal_concepts | 537 | 0.86% |
| **Concept Tokens** | | |
| 總 tokens 數 | 154,517 | - |
| 唯一 concepts | 18,560 | - |
| 平均每記錄 concepts 數 | 2.49 | - |
| 中位數 | 2 | - |
| 最小值 | 1 | - |
| 最大值 | 17 | - |

---

## 2. 最常見的 Legal Concepts (Top 20)

| 排名 | Concept | 出現次數 | 百分比 |
|------|---------|----------|--------|
| 1 | Jurisdictional error | 9,823 | 6.36% |
| 2 | refugee status | 7,628 | 4.94% |
| 3 | Merits review | 4,711 | 3.05% |
| 4 | MIGRATION | 4,614 | 2.99% |
| 5 | Judicial review principles | 4,478 | 2.90% |
| 6 | Time limitation | 2,911 | 1.88% |
| 7 | Credibility assessment | 2,554 | 1.65% |
| 8 | Well-founded fear of persecution | 2,460 | 1.59% |
| 9 | s.36 | 2,336 | 1.51% |
| 10 | Procedural fairness | 2,214 | 1.43% |
| 11 | Migration Act | 2,117 | 1.37% |
| 12 | merits review | 2,100 | 1.36% |
| 13 | Unreasonableness | 2,003 | 1.30% |
| 14 | Complementary protection | 1,855 | 1.20% |
| 15 | Migration law | 1,656 | 1.07% |
| 16 | Country information | 1,534 | 0.99% |
| 17 | protection visa | 1,436 | 0.93% |
| 18 | migration law | 1,374 | 0.89% |
| 19 | Costs | 1,369 | 0.89% |
| 20 | Protection visa | 1,339 | 0.87% |

**觀察**:
- Top 20 概念涵蓋約 30% 的 tokens
- "Jurisdictional error" 壓倒性優勢（6.36%）
- "refugee status" 和 "Merits review" 也非常常見
- 明顯存在大小寫重複（如 #3 "Merits review" vs #12 "merits review"）

---

## 3. 垃圾值與異常值

### 3.1 純數字 Concepts

發現 **9 個**純數字 concepts:
- `1958`, `1994` (可能是法規年份)
- `8202`, `262111`, `4020`, `8516` (可能是條款編號或職業代碼)

**建議**: 數字應加上前綴（如 "s.8202"、"ANZSCO 262111"）以提供語境。

### 3.2 單字母 Concepts

發現 **3 個**單字母 concepts:
- `c`, `r`

**建議**: 這些是無意義的垃圾值，應刪除或合併到完整詞彙。

### 3.3 過長的文本片段

發現 **3 個** concepts 包含過多換行符和過長內容（200+ 字元），例如:
```
MIGRATION
–Student (Temporary) (Class TU) visa – subclass 500 (Student)
visa–   genuine temporary entrant criterion not met– economic
ties with Australia–no strong incentive to return to her home coun
```

**建議**: 這些是從 catchwords 擷取時未清理的遺留文本，應重新處理。

### 3.4 非 ASCII 字元

發現 **2,842 個** concepts 包含非 ASCII 字元，包括:
- 智慧引號（`'`, `"`）
- 破折號（`–`）
- 省略符號（`...`）

**範例**:
- `Bachelor's level`
- `visa – India – separation from wife`
- `of 'aged dependent relative' i`

**建議**: 標準化為 ASCII 或明確接受 Unicode。

### 3.5 過短的 Concepts (< 5 字元)

| Concept | 出現次數 | 評估 |
|---------|----------|------|
| `s.36` | 2,336 | ✅ 有效（法條引用） |
| `AAT` | 1,057 | ✅ 有效（縮寫） |
| `s.65` | 462 | ✅ 有效 |
| `visa` | 377 | ⚠️ 過度泛用 |
| `Bias` | 175 | ✅ 有效 |
| `nan` | 22 | ❌ 垃圾值（pandas NaN） |
| `not` | 19 | ❌ 垃圾值 |
| `Cook` | 57 | ⚠️ 需確認（國家名？） |

**建議**:
- 刪除 `nan`, `not` 等明顯錯誤
- `visa` 過度泛用，應與其他詞結合（如 "student visa"）

---

## 4. 格式問題

### 4.1 前後空白

發現 **92,518 個** concept tokens 有多餘的前後空白。

**範例**:
```
' whether the applicant has breached condition 8202'
' children reside in home country'
' Carer visa assessment'
```

**建議**: 需要對所有 concepts 執行 `.strip()` 清理。

### 4.2 不一致的分隔符

發現 **1,868 個**記錄使用非分號分隔符，包括:
- 斜線 `/` (例如: `Interlocutory/interim orders`)
- 逗號 `,`
- 豎線 `|`

**範例**:
```
Serious/significant harm; s.424A information provision
Time limitation; Interlocutory/interim orders
```

**建議**:
- 如果 `/` 表示「或」的關係，應拆分為兩個獨立 concepts
- 如果表示複合概念（如 "Serious/significant harm"），應保留但需文檔化

### 4.3 記錄內重複

發現 **5 個**記錄有重複的 concepts:

1. `[2019] AATA 2908`: `genuine temporary entrant` 重複 2 次
2. `[2020] AATA 5548`: `English language requirement` 重複 2 次
3. `[2021] AATA 1169`: `visa` 重複 2 次
4. `[2021] AATA 598`: `requirements` 重複 2 次
5. `[2021] AATA 1173`: `cancellation` 重複 2 次

**建議**: 去重處理。

---

## 5. 大小寫不一致問題（嚴重）

發現 **678 個** concepts 有多種大小寫變體。

### Top 10 不一致 Concepts

| Concept (lowercase) | 總次數 | 主要變體 | 變體次數 |
|---------------------|--------|----------|----------|
| jurisdictional error | 10,157 | Jurisdictional error | 9,823 |
| | | Jurisdictional Error | 203 |
| | | jurisdictional error | 131 |
| refugee status | 7,864 | refugee status | 7,628 |
| | | Refugee status | 236 |
| merits review | 6,811 | Merits review | 4,711 |
| | | merits review | 2,100 |
| migration | 4,969 | MIGRATION | 4,614 |
| | | migration | 230 |
| | | Migration | 125 |
| migration law | 3,030 | Migration law | 1,656 |
| | | migration law | 1,374 |
| credibility assessment | 2,967 | Credibility assessment | 2,554 |
| | | credibility assessment | 413 |
| complementary protection | 2,836 | Complementary protection | 1,855 |
| | | complementary protection | 981 |
| protection visa | 2,815 | protection visa | 1,436 |
| | | Protection visa | 1,339 |
| | | Protection Visa | 37 |
| well-founded fear of persecution | 2,465 | Well-founded fear of persecution | 2,460 |
| | | well-founded fear of persecution | 5 |
| procedural fairness | 2,437 | Procedural fairness | 2,214 |
| | | procedural fairness | 217 |
| | | Procedural Fairness | 6 |

**影響**:
- 嚴重影響去重和統計
- 導致相同概念被視為不同項目
- 影響搜尋和過濾功能

**建議**:
1. **統一為 Title Case**（首字母大寫）- 符合法律文件慣例
2. **例外**: 全大寫的縮寫保持不變（如 `AAT`, `MIGRATION` 若為專有縮寫）
3. 執行全局標準化腳本

---

## 6. 泛用詞問題

發現 **128 個**記錄「只有」泛用詞，缺乏具體法律概念。

**範例**:
- `[2015] FCA 1139`: `Review`
- `[2015] FCA 1215`: `Review`
- `[2015] FCA 1216`: `Review`

**泛用詞清單**:
- Migration, Law, Visa, Australia, Decision, Appeal, Review, Application, Immigration, Tribunal

**建議**:
- 這些記錄應重新處理，嘗試從 catchwords 或 full_text 提取更具體的概念
- 至少添加案件類型或簽證類型相關的 concepts

---

## 7. 缺失值分析（537 個記錄）

### 7.1 按法院分布

| 法院 | 缺失數 | 該法院總數 | 缺失率 |
|------|--------|-----------|--------|
| AATA | 295 | 37,762 | 0.78% |
| **ARTA** | **225** | **2,257** | **9.97%** ⚠️ |
| FCCA | 17 | 11,157 | 0.15% |
| FCA | 0 | 7,154 | 0.00% ✅ |
| FedCFamC2G | 0 | 4,102 | 0.00% ✅ |
| HCA | 0 | 104 | 0.00% ✅ |

**關鍵發現**: ARTA（新成立的行政覆審法庭）缺失率高達 **9.97%**，遠高於其他法院。

### 7.2 按年份分布

| 年份 | 缺失數 |
|------|--------|
| 2025 | 191 |
| 2024 | 60 |
| 2019 | 98 |
| 2018 | 91 |
| 2010 | 52 |
| 2026 | 14 |
| 0 (異常) | 5 |

**觀察**:
- 2025 年缺失最多（191 個），主要來自 ARTA
- 年份 `0` 的 5 個記錄是無效資料（所有欄位都是 NaN）

### 7.3 缺失記錄的其他欄位填充率

| 欄位 | 填充率 |
|------|--------|
| case_nature | 100.00% (537/537) |
| outcome | 100.00% (537/537) |
| visa_type | 77.84% (418/537) |
| catchwords | 73.74% (396/537) |

**建議**:
- **396 個**缺失記錄有 catchwords，可嘗試從中提取 legal_concepts
- 所有缺失記錄都有 case_nature，可作為後備推斷依據

### 7.4 缺失記錄範例

**[2024] AATA 134** (Protection visa / Employer Nomination Scheme visa):
```
MIGRATION – Employer Nomination (Permanent) (Class EN) visa
– Subclass 186 (Employer Nomination Scheme) – Direct Entry stream
– Software Engineer – subject of an approved nomination – decision under r...
```
→ 可推斷: `Employer Nomination Scheme`, `Subclass 186`, `Software Engineer`

**[2024] AATA 10** (Citizenship):
```
CITIZENSHIP – application for citizenship by conferral – where
applicant approved for grant of citizenship – where applicant failed to
make pledge of commitment within 12 month period and approval of ...
```
→ 可推斷: `Citizenship by conferral`, `Pledge of commitment`

---

## 8. 與其他欄位的相關性

### 8.1 Legal Concepts vs Case Nature

| Case Nature | 記錄數 | 有 concepts 率 |
|-------------|--------|---------------|
| Protection visa | 16,646 | 99.54% |
| Judicial review | 14,849 | 99.99% |
| Merits review | 9,407 | 97.68% |
| Visa cancellation | 5,250 | 99.94% |
| Appeal | 3,542 | 99.10% |
| Visa refusal | 2,872 | 99.90% |
| Student visa application | 1,435 | **89.90%** ⚠️ |

**觀察**: "Student visa application" 的填充率較低（89.90%），可能需要針對性處理。

### 8.2 Legal Concepts vs Visa Type

#### Student Visa 相關性

- **總記錄**: 9,442
- **有 legal_concepts**: 9,273 (98.21%)
- **包含 "student"**: 1,965 (21.19%) ⚠️
- **包含 "GTE"**: 788 (8.50%) ⚠️

**問題**: 只有 21% 的 Student visa 記錄的 concepts 中包含 "student"，相關性偏低。

#### Protection Visa 相關性

- **總記錄**: 25,333
- **有 legal_concepts**: 25,301 (99.87%)
- **包含 "refugee"**: 5,587 (22.08%) ⚠️
- **包含 "persecution"**: 2,206 (8.72%) ⚠️

**問題**: 只有 22% 的 Protection visa 記錄包含 "refugee"，許多記錄的 concepts 是程序性的（如 "Jurisdictional error"）而非實質性的。

### 8.3 隨機抽樣驗證

從 30 個隨機樣本中發現 **16 個** (53%) 可能存在不一致問題，主要是:
- Protection visa 案件的 concepts 只有程序性概念（如 "Time limitation"、"Jurisdictional error"），缺少實質性概念（refugee、persecution）
- Student visa 案件缺少 student/GTE 相關概念

**範例**:
- `[2019] FCCA 393` - Protection visa，但 concepts 只有 "Procedural fairness"
- `[2020] FCCA 536` - Student visa，但 concepts 只有 "Jurisdictional error"

---

## 9. 年份 0 的異常記錄

發現 **5 個** year=0 的記錄，所有欄位都是 NaN（包括 citation、date、legal_concepts）。

**建議**: 這些是無效記錄，應從資料集中刪除。

---

## 10. Legal Concepts 長度分布

| 指標 | 值 |
|------|-----|
| 平均 concepts 數 | 2.49 |
| 中位數 | 2 |
| 最小值 | 1 |
| 最大值 | 17 |
| 只有 1 個 concept | 27,718 (44.7%) |

**Concepts 最多的記錄** (17 個):
- `[2021] AATA 5041`: Country Information; Human Rights; Iraq; REFUGEE; Refugee...
- `[2022] AATA 1932`: China; Christian; Country Information; Local; REFUGEE...

**只有 1 個 concept 的記錄**（27,718 個，佔 44.7%）:
- `Judicial review principles`
- `Jurisdictional error`
- `Credibility assessment`

**觀察**: 近半數記錄只有 1 個 concept，可能需要更豐富的標註。

---

## 建議與行動計畫

### 🚨 高優先級（資料完整性）

1. **刪除無效記錄**
   - 刪除 5 個 year=0 的 NaN 記錄

2. **清理空白**
   - 對所有 legal_concepts 執行 `.strip()` 清理前後空白
   - 影響: 92,518 個 tokens

3. **去重**
   - 移除記錄內的重複 concepts
   - 影響: 5 個記錄

4. **刪除垃圾值**
   - 移除 `nan`, `not`, `c`, `r` 等無意義值
   - 影響: ~50 個 tokens

### ⚠️ 中優先級（一致性）

5. **大小寫標準化**
   - 統一為 Title Case（首字母大寫）
   - 保留縮寫全大寫（AAT, IELTS 等）
   - 影響: 678 個 concepts，約 50,000+ tokens

6. **處理 ARTA 缺失值**
   - 針對 ARTA 的 225 個缺失記錄，從 catchwords 提取 concepts
   - 或重新執行 LLM 提取

7. **補充缺失值**
   - 處理 396 個有 catchwords 但無 concepts 的記錄
   - 使用 regex 或 LLM 提取

8. **標準化分隔符**
   - 處理 1,868 個使用 `/` 的記錄
   - 決定是否拆分或保留

### 💡 低優先級（品質提升）

9. **豐富泛用詞記錄**
   - 為 128 個只有泛用詞的記錄添加更具體的 concepts

10. **提升 visa_type 相關性**
    - Student visa 記錄中增加 student/GTE 相關 concepts
    - Protection visa 記錄中增加 refugee/persecution 相關 concepts

11. **數字前綴化**
    - 將純數字轉換為有意義的概念（如 `1958` → `Migration Act 1958`）

12. **非 ASCII 標準化**
    - 統一智慧引號、破折號等格式

---

## 附錄：資料品質評分

| 維度 | 評分 (1-10) | 說明 |
|------|-------------|------|
| **完整性** | 9/10 | 99.14% 填充率優秀，但 ARTA 缺失率偏高 |
| **準確性** | 7/10 | 存在垃圾值、過長片段、單字母等異常 |
| **一致性** | 4/10 | 嚴重的大小寫不一致問題（678 個變體） |
| **格式規範** | 5/10 | 92,518 個 tokens 有多餘空白，分隔符不統一 |
| **相關性** | 6/10 | 與 visa_type 相關性偏低（~20%），程序性 concepts 過多 |
| **無重複性** | 9/10 | 僅 5 個記錄有重複，總體良好 |
| **語義豐富度** | 6/10 | 44.7% 只有 1 個 concept，128 個只有泛用詞 |

**總體評分**: **6.6/10** - 需要改進，特別是一致性和格式規範

---

## 結論

`legal_concepts` 欄位的**填充率優秀**（99.14%），但存在**嚴重的一致性問題**（大小寫不統一、空白過多）和**語義深度不足**（過度依賴程序性概念，缺乏實質性標註）。

建議優先執行:
1. 大小寫標準化
2. 空白清理
3. ARTA 缺失值處理
4. 從 catchwords 補充缺失的 396 個記錄

完成這些改進後，預估可將資料品質評分從 **6.6/10** 提升至 **8.5/10**。
