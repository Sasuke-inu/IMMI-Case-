# IMMI-Case 全面改善計畫

> 基於安全審計、程式碼品質分析、架構審查、測試覆蓋率缺口分析
> 日期: 2026-02-13 | 當前測試覆蓋率: 36% | 目標: 80%

---

## 目錄

- [Phase 0: CRITICAL 安全修復](#phase-0-critical-安全修復)
- [Phase 1: 穩定性與線程安全](#phase-1-穩定性與線程安全)
- [Phase 2: 測試基礎建設](#phase-2-測試基礎建設)
- [Phase 3: 架構重構 — webapp 拆分](#phase-3-架構重構--webapp-拆分)
- [Phase 4: 資料層重構 — CaseRepository](#phase-4-資料層重構--caserepository)
- [Phase 5: 爬蟲層統一化](#phase-5-爬蟲層統一化)
- [Phase 6: Pipeline 改善](#phase-6-pipeline-改善)
- [Phase 7: 效能優化](#phase-7-效能優化)
- [Phase 8: 完整測試覆蓋](#phase-8-完整測試覆蓋)
- [Ralph Loop 模板](#ralph-loop-模板)

---

## Phase 0: CRITICAL 安全修復

**預估時間: 0.5 天 | 優先級: CRITICAL**

### Issue 0.1: 缺少 CSRF 保護 (CWE-352)

**位置:** `webapp.py` — 所有 POST 路由
**影響:** 任何惡意網站可偽造 POST 請求刪除案件或啟動爬蟲

#### 實施步驟

1. 安裝 flask-wtf: `pip install flask-wtf>=1.2.0`
2. 更新 `requirements.txt` 加入 `flask-wtf>=1.2.0`
3. 在 `webapp.py` 中初始化 CSRFProtect:
   ```python
   from flask_wtf.csrf import CSRFProtect
   csrf = CSRFProtect()
   # 在 create_app() 中: csrf.init_app(app)
   ```
4. 在所有 POST 表單模板中加入 `{{ csrf_token() }}`
5. 對 JSON API 端點（`/api/pipeline-action`）加 `@csrf.exempt` 但驗證 Origin header

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_csrf_token_present_in_forms` | Unit | 所有 POST 表單包含 csrf_token hidden field |
| `test_post_without_csrf_rejected` | Integration | POST 無 token 回傳 400 |
| `test_post_with_valid_csrf_accepted` | Integration | POST 有 token 正常處理 |
| `test_api_endpoint_csrf_exempt` | Integration | JSON API 不需要 token |

---

### Issue 0.2: Flask Secret Key 硬編碼 (CWE-798)

**位置:** `webapp.py:46`
**影響:** Session cookie 可被偽造

#### 實施步驟

1. 移除 `"immi-case-dev-key-change-in-prod"` 預設值
2. 改為:
   ```python
   import secrets
   secret = os.environ.get("SECRET_KEY")
   if not secret:
       import warnings
       warnings.warn("SECRET_KEY not set! Using random key.", RuntimeWarning)
       secret = secrets.token_hex(32)
   app.secret_key = secret
   ```
3. 建立 `.env.example` 文件: `SECRET_KEY=your-secret-key-here`

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_secret_key_from_env` | Unit | 環境變數優先 |
| `test_secret_key_no_hardcoded_fallback` | Unit | 無硬編碼預設值 |
| `test_secret_key_random_when_missing` | Unit | 無環境變數時生成隨機 key |

---

### Issue 0.3: 預設綁定 0.0.0.0 (CWE-668)

**位置:** `web.py:17`
**影響:** 暴露在所有網路介面

#### 實施步驟

1. `web.py:17` 改為 `default="127.0.0.1"`
2. 加入 debug + 0.0.0.0 安全檢查

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_default_host_is_localhost` | Unit | 預設綁定 127.0.0.1 |
| `test_debug_with_public_host_warns` | Unit | debug + 0.0.0.0 發出警告 |

---

### Issue 0.4: 安全 HTTP 標頭 (CWE-693)

**位置:** `webapp.py` — 無 after_request handler
**影響:** 缺少 CSP, X-Frame-Options 等保護

#### 實施步驟

1. 在 `webapp.py` 中加入 `@app.after_request` handler
2. 設置: X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_security_headers_present` | Integration | 所有回應包含安全標頭 |
| `test_csp_header_value` | Integration | CSP 值正確 |

---

## Phase 1: 穩定性與線程安全

**預估時間: 1 天 | 優先級: HIGH**

### Issue 1.1: `_job_status` 競態條件 (CWE-362)

**位置:** `webapp.py:49-57`
**影響:** 多執行緒同時讀寫全域字典，可能啟動重複任務

#### 實施步驟

1. 在 `webapp.py` 加入 `_job_lock = threading.Lock()`
2. 所有讀取/修改 `_job_status` 的位置包裹 `with _job_lock:`
3. 特別注意 check-then-act 模式（第 275 行的 `if _job_status["running"]`）

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_concurrent_job_start_prevented` | Integration | 兩個快速連續 POST 只啟動一個任務 |
| `test_job_status_read_thread_safe` | Unit | 讀取 status 不會因寫入崩潰 |
| `test_job_status_api_returns_consistent_snapshot` | Integration | API 回傳一致的狀態快照 |

---

### Issue 1.2: 輸入驗證缺失 (CWE-20)

**位置:** `webapp.py:280-282, 315, 604-606, 629, 875`
**影響:** 非數字輸入導致 500 錯誤；無上限驗證

#### 實施步驟

1. 建立 `safe_int()` / `safe_float()` 工具函式（pipeline.py 已有類似的）
2. 替換所有裸 `int()` / `float()` 呼叫
3. 加入合理的 min/max 限制

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_safe_int_valid` | Unit | 正常數字轉換 |
| `test_safe_int_invalid_returns_default` | Unit | "abc" 回傳預設值 |
| `test_safe_int_respects_min_max` | Unit | 超出範圍被截斷 |
| `test_search_form_invalid_year` | Integration | 年份 "abc" 不導致 500 |
| `test_search_form_extreme_max_results` | Integration | max_results=99999999 被截斷 |
| `test_delay_minimum_enforced` | Integration | delay=0.001 被提升到 0.3 |

---

### Issue 1.3: 路徑遍歷風險 (CWE-22)

**位置:** `storage.py:231-236` (get_case_full_text), `storage.py:90-98` (save_case_text)
**影響:** 惡意 full_text_path 可讀取任意系統檔案

#### 實施步驟

1. 在 `get_case_full_text()` 加入 `os.path.realpath()` + 目錄前綴檢查
2. 在 `save_case_text()` 的 `os.path.join()` 後驗證路徑

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_path_traversal_blocked` | Unit | `../../etc/passwd` 回傳 None |
| `test_valid_path_within_output_dir` | Unit | 正常路徑可讀取 |
| `test_save_case_text_path_validation` | Unit | 檔名不會逃出目標目錄 |

---

### Issue 1.4: `update_case()` Mass Assignment (CWE-915)

**位置:** `storage.py:191-201`
**影響:** 可修改 `full_text_path` 等非預期欄位

#### 實施步驟

1. 在 `storage.py` 定義 `ALLOWED_UPDATE_FIELDS` frozenset
2. `update_case()` 改用白名單驗證

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_update_case_allowed_fields` | Unit | 允許的欄位可更新 |
| `test_update_case_blocked_fields` | Unit | full_text_path, source 被拒絕 |

---

### Issue 1.5: CSV 原子寫入

**位置:** `storage.py` save_cases_csv/json
**影響:** 寫入中途崩潰會損壞 CSV

#### 實施步驟

1. 先寫 `.tmp` 檔案，再 `os.replace()` 原子替換（`extract_llm_fields.py` 已用此模式）
2. 統一 CSV/JSON 寫入使用此安全模式

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_csv_write_atomic` | Unit | 寫入失敗不會留下損壞的 CSV |
| `test_csv_write_creates_tmp_first` | Unit | 臨時檔案先建立 |

---

## Phase 2: 測試基礎建設

**預估時間: 3 天 | 優先級: HIGH**

### Issue 2.1: 測試 fixtures 不足

#### 實施步驟

1. 在 `tests/conftest.py` 新增：
   - `mock_scraper_response` — mock HTML 回應
   - `mock_requests_session` — mock requests.Session
   - `time_mock` — mock time.time() / time.sleep()
2. 建立 `tests/fixtures/` 目錄，放置 HTML 樣本檔案：
   - `austlii_year_listing.html`
   - `austlii_case_detail.html`
   - `fedcourt_search_results.html`

### Issue 2.2: base.py 測試 (51% → 80%)

**缺失:** `_rate_limit()`, `fetch()` 完整錯誤分類

#### 新增 15 個測試

| 測試函式 | 驗證內容 |
|----------|----------|
| `test_rate_limit_enforces_delay` | 相鄰請求間隔 ≥ delay |
| `test_rate_limit_no_delay_first_request` | 第一個請求無延遲 |
| `test_fetch_timeout_error` | 返回 None, category="http_timeout" |
| `test_fetch_dns_error` | 返回 None, category="dns_error" |
| `test_fetch_connection_error` | category="connection_error" |
| `test_fetch_http_404` | category="http_404" |
| `test_fetch_http_500` | category="http_500" |
| `test_fetch_http_410` | category="http_410" (AustLII block) |
| `test_fetch_generic_request_error` | category="request_error" |
| `test_session_user_agent_set` | User-Agent header 正確 |
| `test_session_retry_configuration` | retry adapter 已安裝 |
| `test_fetch_success_returns_response` | 正常回應 |
| `test_fetch_rate_limits_between_calls` | 連續 fetch 之間有延遲 |
| `test_last_error_cleared_on_success` | 成功後 last_error 清除 |
| `test_fetch_sets_last_error_dict` | 失敗後 last_error 有完整資訊 |

### Issue 2.3: cli.py 測試 (69% → 80%)

**新增 11 個測試**（見測試覆蓋率分析報告）

### Issue 2.4: storage.py 邊界測試 (95% → 98%)

**新增 5 個測試**（hash 回退、summary_report、statistics 邊界）

---

## Phase 3: 架構重構 — webapp 拆分

**預估時間: 3 天 | 優先級: HIGH**

### Issue 3.1: webapp.py 905 行混合四種職責

**目標:** 拆分為 Flask Blueprints + jobs 模組

#### 實施步驟

```
# 目標結構
immi_case_downloader/
  web/
    __init__.py          # create_app() 工廠函式
    filters.py           # _filter_cases, 排序, 分頁
    security.py          # CSRF, 安全標頭, safe_int/safe_float
    routes/
      __init__.py
      dashboard.py       # / 路由
      cases.py           # /cases, /cases/<id>, edit, delete, add
      search.py          # /search
      download.py        # /download
      export.py          # /export/<fmt>
      pipeline.py        # /pipeline, /api/pipeline-*
      update_db.py       # /update-db
      api.py             # /api/job-status, data-dictionary
  jobs/
    __init__.py
    manager.py           # JobManager (取代 _job_status 全域字典)
    search_job.py        # _run_search_job
    download_job.py      # _run_download_job
    update_job.py        # _run_update_job
    bulk_download_job.py # _run_bulk_download_job
```

#### 步驟 1: 建立 JobManager 類別

```python
# jobs/manager.py
class JobManager:
    def __init__(self):
        self._lock = threading.RLock()
        self._current: JobStatus | None = None
        self._thread: threading.Thread | None = None

    @property
    def is_running(self) -> bool: ...
    def submit(self, job_type, target, args) -> bool: ...
    def get_status(self) -> dict: ...
    def update_progress(self, **kwargs): ...
```

#### 步驟 2: 提取 routes 到 Blueprints

從最獨立的開始：`export.py` → `cases.py` → `dashboard.py` → `search.py` → `download.py` → `pipeline.py` → `update_db.py`

#### 步驟 3: 提取 background jobs

將 `_run_search_job`, `_run_download_job` 等移到 `jobs/` 模組

#### 步驟 4: 移除舊的 `webapp.py`，`create_app()` 移到 `web/__init__.py`

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_job_manager_submit` | Unit | 提交新任務成功 |
| `test_job_manager_reject_duplicate` | Unit | 任務運行中拒絕新提交 |
| `test_job_manager_thread_safety` | Unit | 多執行緒存取安全 |
| `test_job_manager_dead_thread_detected` | Unit | 異常退出的執行緒被偵測 |
| `test_blueprint_registration` | Integration | 所有 Blueprint 正確註冊 |
| `test_routes_still_accessible` | Integration | 重構後所有 URL 仍可訪問 |
| `test_filter_cases_extracted` | Unit | 過濾邏輯獨立測試 |

---

## Phase 4: 資料層重構 — CaseRepository

**預估時間: 3-5 天 | 優先級: HIGH**

### Issue 4.1: CSV 全量讀寫，無鎖保護

**影響:** 53K 紀錄每次 CRUD 需 2-4 秒；100K 時需 8 秒
**根本原因:** 每次操作都 `load_all_cases()` + `save_cases_csv()`

### Issue 4.2: 5 個不同的 CSV 讀寫實現

#### 實施步驟

##### 步驟 1: 定義 CaseRepository Protocol

```python
# storage.py (or repository.py)
from typing import Protocol

class CaseRepository(Protocol):
    def find_by_id(self, case_id: str) -> ImmigrationCase | None: ...
    def find_all(self, filters: dict | None = None,
                 page: int = 1, per_page: int = 50) -> tuple[list[ImmigrationCase], int]: ...
    def save(self, case: ImmigrationCase) -> None: ...
    def save_many(self, cases: list[ImmigrationCase]) -> int: ...
    def delete(self, case_id: str) -> bool: ...
    def get_statistics(self) -> dict: ...
    def export_csv(self, filepath: str) -> None: ...
    def export_json(self, filepath: str) -> None: ...
```

##### 步驟 2: 實現 CsvCaseRepository（封裝現有邏輯）

- 啟動時一次載入到記憶體
- 使用 `threading.RLock` 保護讀寫
- 建立 `dict[case_id -> ImmigrationCase]` 索引
- CSV 寫入使用原子替換

##### 步驟 3: 實現 SqliteCaseRepository（中期目標）

- 使用 `sqlite3` WAL mode 支援多執行緒
- 為 `case_id`, `url`, `court_code`, `year` 建立索引
- Migration 腳本: CSV → SQLite

##### 步驟 4: 所有呼叫者改用 Repository

- `webapp.py` 路由
- `cli.py` 命令
- `pipeline.py` 各 phase
- `postprocess.py`, `download_fulltext.py` 改用 storage API

#### TDD 測試計畫

| 測試函式 | 類型 | 驗證內容 |
|----------|------|----------|
| `test_csv_repo_find_by_id` | Unit | O(1) 查找 |
| `test_csv_repo_find_all_with_filters` | Unit | 過濾正確 |
| `test_csv_repo_save_atomic` | Unit | 原子寫入 |
| `test_csv_repo_thread_safe_read` | Unit | 多執行緒讀取安全 |
| `test_csv_repo_thread_safe_write` | Unit | 多執行緒寫入安全 |
| `test_csv_repo_cache_invalidation` | Unit | CSV 修改後快取更新 |
| `test_sqlite_repo_find_by_id` | Unit | SQLite 查找 |
| `test_sqlite_repo_pagination` | Unit | LIMIT/OFFSET 分頁 |
| `test_sqlite_repo_statistics` | Unit | GROUP BY 統計 |
| `test_migration_csv_to_sqlite` | Integration | 資料完整遷移 |

---

## Phase 5: 爬蟲層統一化

**預估時間: 2 天 | 優先級: MEDIUM**

### Issue 5.1: Scraper 介面不一致

**AustLIIScraper.search_cases** vs **FederalCourtScraper.search_cases** 參數不同

#### 實施步驟

1. 定義 `CaseScraper` Protocol
2. 統一 `search_cases()` 簽名
3. 公開 `_browse_year()` 為 `crawl_year()`（移除私有方法直接呼叫）

### Issue 5.2: Metadata 提取重複三份

**位置:** `austlii.py:336-413`, `federal_court.py:230-255`, `postprocess.py:151-323`

#### 實施步驟

1. 建立 `MetadataExtractor` 類別
2. 將 regex patterns 集中管理
3. 使用 postprocess.py 最完整的版本作為基礎

### Issue 5.3: 爬蟲測試 (10% → 80%)

**新增 55 個 austlii.py 測試 + 40 個 federal_court.py 測試**

#### TDD 測試計畫（核心）

| 測試函式 | 驗證內容 |
|----------|----------|
| `test_browse_year_direct_url_success` | 直接 URL 解析案例 |
| `test_browse_year_fallback_to_viewdb` | 直接 URL 失敗回退到 viewdb |
| `test_parse_search_results_li_format` | `<li class="result">` 解析 |
| `test_parse_search_results_tr_format` | `<tr>` 表格解析 |
| `test_download_case_detail_success` | 成功下載全文 |
| `test_extract_metadata_judges` | 提取法官名 |
| `test_extract_metadata_outcome` | 提取判決結果 |
| `test_extract_metadata_visa_type` | 提取簽證類型 |
| `test_is_immigration_case_true` | 移民案例正確識別 |
| `test_is_immigration_case_false` | 非移民案例正確排除 |
| `test_metadata_extractor_unified` | 統一提取器與舊版結果一致 |

---

## Phase 6: Pipeline 改善

**預估時間: 2 天 | 優先級: MEDIUM**

### Issue 6.1: Pipeline 全域狀態

**位置:** `pipeline.py:219-236` `_pipeline_status`

#### 實施步驟

1. 將 `_pipeline_status` 封裝為 `SmartPipeline` 實例屬性
2. Phase 之間傳遞 in-memory 資料（不反覆讀寫 CSV）
3. Crawl phase 加入 checkpoint（每完成一個 DB 儲存）

### Issue 6.2: 配置硬編碼

**位置:** `config.py`

#### 實施步驟

1. 支援環境變數: `IMMI_OUTPUT_DIR`, `IMMI_DELAY`, `IMMI_TIMEOUT`
2. 建立 `.env.example` 範本

### Issue 6.3: Pipeline 測試 (15% → 80%)

**新增 45 個測試**

#### TDD 測試計畫（核心）

| 測試函式 | 驗證內容 |
|----------|----------|
| `test_config_from_form_quick_preset` | quick 預設正確 |
| `test_config_from_form_year_swap` | start > end 自動交換 |
| `test_pipeline_run_all_phases` | 三階段完整執行 |
| `test_pipeline_stop_requested` | 停止機制生效 |
| `test_crawl_with_fallback_strategies` | direct → viewdb → keyword |
| `test_clean_phase_dedup` | URL 去重 |
| `test_clean_phase_fix_year` | citation 提取年份 |
| `test_download_phase_checkpoint` | 每 200 次儲存 |
| `test_pipeline_log_thread_safe` | 多執行緒日誌安全 |

---

## Phase 7: 效能優化

**預估時間: 2 天 | 優先級: MEDIUM**

### Issue 7.1: CSV 讀取快取

**短期方案（Phase 4 SQLite 之前的臨時方案）:**

```python
_cases_cache = {"data": None, "mtime": 0}

def load_all_cases(base_dir):
    mtime = os.path.getmtime(filepath)
    if _cases_cache["data"] and _cases_cache["mtime"] == mtime:
        return list(_cases_cache["data"])  # 回傳副本
    # ... 載入 ...
    _cases_cache["data"] = cases
    _cases_cache["mtime"] = mtime
```

### Issue 7.2: Dashboard 統計快取

在 CaseRepository 中快取統計結果，只在資料變更時重算。

### Issue 7.3: Web 端點速率限制

```python
# flask-limiter
limiter = Limiter(get_remote_address, default_limits=["200/minute"])
# POST /search → 5/minute
# /export → 10/minute
```

#### TDD 測試計畫

| 測試函式 | 驗證內容 |
|----------|----------|
| `test_cache_hit_same_mtime` | 相同修改時間回傳快取 |
| `test_cache_miss_on_mtime_change` | 修改時間變更重新載入 |
| `test_rate_limit_search_post` | 超過限制回傳 429 |

---

## Phase 8: 完整測試覆蓋

**預估時間: 2 週 | 目標: 36% → 80%**

### 測試數量總表

| 模組 | 當前覆蓋率 | 新增測試數 | 目標覆蓋率 |
|------|----------|-----------|----------|
| `base.py` | 51% | 15 | 80%+ |
| `cli.py` | 69% | 11 | 80%+ |
| `storage.py` | 95% | 5 | 98%+ |
| `austlii.py` | 10% | 55 | 80%+ |
| `federal_court.py` | 13% | 40 | 80%+ |
| `pipeline.py` | 15% | 45 | 80%+ |
| `webapp.py` | 29% | 52 | 80%+ |
| **總計** | **36%** | **218+** | **80%+** |

### 實施順序

1. **Week 1:** base.py (15) + cli.py (11) + storage.py (5) = **31 個測試**
2. **Week 2:** austlii.py (55) + federal_court.py 核心 (15) = **70 個測試**
3. **Week 3:** federal_court.py 完整 (25) + pipeline.py (45) = **70 個測試**
4. **Week 4:** webapp.py (52) = **52 個測試**

### 測試工具需求

```
# requirements-test.txt 新增
responses>=0.25.0        # HTTP mock
freezegun>=1.4.0         # 時間 mock
```

---

## Ralph Loop 模板

以下是為每個 Phase 設計的 Ralph Loop PROMPT.md，用於迭代開發。

### Phase 0 Ralph Loop

```markdown
# PROMPT.md — Phase 0: CRITICAL Security Fixes

## Context
Working on /Users/d/Developer/IMMI-Case-
Python Flask web application for Australian immigration cases.

## Task
Fix CRITICAL security issues in order:

1. **CSRF Protection**
   - Install flask-wtf
   - Initialize CSRFProtect in webapp.py create_app()
   - Add {{ csrf_token() }} to ALL POST form templates
   - Exempt JSON API endpoints with Origin validation
   - Write tests: test_csrf_token_present, test_post_without_csrf_rejected

2. **Secret Key**
   - Remove hardcoded fallback in webapp.py:46
   - Use secrets.token_hex(32) when SECRET_KEY env var missing
   - Write tests: test_secret_key_no_hardcoded, test_secret_key_random

3. **Default Host**
   - Change web.py:17 default to "127.0.0.1"
   - Block debug + 0.0.0.0 combination
   - Write tests: test_default_host_localhost

4. **Security Headers**
   - Add @app.after_request handler with CSP, X-Frame-Options, etc.
   - Write tests: test_security_headers_present

## TDD Protocol
For EACH fix:
1. Write test FIRST (should FAIL)
2. Implement fix
3. Run test (should PASS)
4. Run full suite: python3 -m pytest

## Completion
Output <promise>SECURITY PHASE 0 COMPLETE</promise> when:
- All 4 issues fixed
- All new tests pass
- All existing 71 tests still pass
- No regressions
```

### Phase 1 Ralph Loop

```markdown
# PROMPT.md — Phase 1: Stability & Thread Safety

## Context
Working on /Users/d/Developer/IMMI-Case-
Phase 0 security fixes already applied.

## Task
Fix stability issues:

1. **Thread-safe _job_status** (webapp.py:49)
   - Add _job_lock = threading.Lock()
   - Wrap ALL reads/writes with `with _job_lock:`
   - Tests: test_concurrent_job_start_prevented

2. **Input validation** (webapp.py:280+)
   - Create safe_int(val, default, min, max) → int
   - Create safe_float(val, default, min, max) → float
   - Replace ALL bare int()/float() calls
   - Tests: test_safe_int_*, test_search_form_invalid_year

3. **Path traversal protection** (storage.py:231)
   - Add os.path.realpath() + prefix check in get_case_full_text()
   - Add path validation in save_case_text()
   - Tests: test_path_traversal_blocked

4. **Mass assignment protection** (storage.py:191)
   - Define ALLOWED_UPDATE_FIELDS frozenset
   - Filter updates in update_case()
   - Tests: test_update_case_blocked_fields

5. **Atomic CSV writes** (storage.py)
   - Write to .tmp then os.replace()
   - Tests: test_csv_write_atomic

## TDD Protocol
Write test FIRST, then implement. Run full suite after each fix.

## Completion
Output <promise>STABILITY PHASE 1 COMPLETE</promise> when all tests pass.
```

### Phase 3 Ralph Loop (Webapp 拆分)

```markdown
# PROMPT.md — Phase 3: Webapp Blueprint Split

## Context
Working on /Users/d/Developer/IMMI-Case-
Phases 0-2 complete. webapp.py is 905 lines with mixed concerns.

## Task
Split webapp.py into Flask Blueprints:

1. **Create JobManager class** (jobs/manager.py)
   - Thread-safe with RLock
   - submit(), get_status(), update_progress()
   - Tests: test_job_manager_*

2. **Extract routes into Blueprints** (one at a time, in order):
   a. web/routes/export.py (simplest, ~40 lines)
   b. web/routes/cases.py (CRUD, ~120 lines)
   c. web/routes/dashboard.py (~30 lines)
   d. web/routes/search.py (~40 lines)
   e. web/routes/download.py (~40 lines)
   f. web/routes/pipeline.py (~60 lines)
   g. web/routes/update_db.py (~100 lines)
   h. web/routes/api.py (JSON endpoints, ~60 lines)

3. **Extract _filter_cases** to web/filters.py

4. **Extract background jobs** to jobs/ module

5. **Create web/__init__.py** with create_app() factory

6. **Update web.py** to import from new location

7. **Delete old webapp.py** (after all tests pass)

## Protocol
- After EACH Blueprint extraction, run: python3 -m pytest
- ALL 71+ existing tests MUST still pass
- Add new tests for extracted modules

## Completion
Output <promise>WEBAPP SPLIT COMPLETE</promise> when:
- webapp.py deleted or reduced to < 50 lines
- All routes work via Blueprints
- All tests pass
```

### Phase 4 Ralph Loop (CaseRepository)

```markdown
# PROMPT.md — Phase 4: CaseRepository

## Context
Working on /Users/d/Developer/IMMI-Case-
Webapp split into Blueprints. Need unified data access layer.

## Task

1. **Define CaseRepository Protocol**
   - find_by_id, find_all, save, save_many, delete, get_statistics

2. **Implement CsvCaseRepository**
   - In-memory cache with dict index
   - RLock for thread safety
   - Atomic CSV writes
   - Tests: test_csv_repo_*

3. **Migrate all callers**
   - Routes use injected repository
   - CLI uses repository
   - Pipeline uses repository
   - Tests verify behavior unchanged

4. **(Optional) SQLite implementation**
   - SqliteCaseRepository with WAL mode
   - Migration script CSV → SQLite
   - Tests: test_sqlite_repo_*

## TDD Protocol
Write Repository Protocol tests first (against interface).
Then implement CsvCaseRepository to pass those tests.

## Completion
Output <promise>REPOSITORY COMPLETE</promise> when all tests pass.
```

---

## 問題優先級總覽

| # | 問題 | 嚴重程度 | Phase | 預估 |
|---|------|----------|-------|------|
| 0.1 | CSRF 保護缺失 | CRITICAL | 0 | 2h |
| 0.2 | Secret Key 硬編碼 | CRITICAL | 0 | 0.5h |
| 0.3 | 預設 0.0.0.0 綁定 | HIGH | 0 | 0.5h |
| 0.4 | 安全 HTTP 標頭 | HIGH | 0 | 1h |
| 1.1 | _job_status 競態 | HIGH | 1 | 2h |
| 1.2 | 輸入驗證缺失 | HIGH | 1 | 2h |
| 1.3 | 路徑遍歷風險 | MEDIUM | 1 | 1h |
| 1.4 | Mass Assignment | MEDIUM | 1 | 0.5h |
| 1.5 | CSV 原子寫入 | MEDIUM | 1 | 1h |
| 2.1-2.4 | 測試基礎建設 | HIGH | 2 | 3d |
| 3.1 | webapp.py 905 行 | HIGH | 3 | 3d |
| 4.1-4.2 | CSV 全量讀寫 | CRITICAL | 4 | 3-5d |
| 5.1 | Scraper 介面不一致 | MEDIUM | 5 | 1d |
| 5.2 | Metadata 重複三份 | MEDIUM | 5 | 1d |
| 6.1 | Pipeline 全域狀態 | MEDIUM | 6 | 1d |
| 6.2 | 配置硬編碼 | MEDIUM | 6 | 0.5d |
| 7.1 | CSV 讀取快取 | MEDIUM | 7 | 0.5d |
| 7.2 | 統計快取 | LOW | 7 | 0.5d |
| 7.3 | Web 速率限制 | MEDIUM | 7 | 1d |
| 8.x | 218 個新測試 | HIGH | 8 | 2w |

---

## 正面發現（不需修復）

- Jinja2 自動轉義 — XSS 防護良好
- 爬蟲層有速率限制和重試
- 檔名淨化涵蓋大部分危險字符
- Pipeline 正確使用 threading.Lock
- 無硬編碼 API key/credentials
- `downloaded_cases/` 已在 .gitignore
- `EDITABLE_FIELDS` 白名單正確限制 webapp 可編輯欄位
- `ImmigrationCase.from_dict()` 正確處理 NaN 轉換
