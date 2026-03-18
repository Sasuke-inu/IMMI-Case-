package au.gov.immi.cases.network.interceptor

import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response

/**
 * OkHttp Interceptor 負責 CSRF token 管理：
 * 1. 首次 state-changing 請求（POST/PUT/DELETE/PATCH）前，先自動獲取 /api/v1/csrf-token
 * 2. 注入 X-CSRFToken 標頭到所有 state-changing 請求
 * 3. 快取 token（避免重複請求），使用 @Volatile + synchronized 確保執行緒安全
 * 4. [invalidate] 可在 token 過期或 401 時手動清除
 */
class CsrfInterceptor(private val serverUrl: String) : Interceptor {

    @Volatile
    private var csrfToken: String? = null

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val method = original.method

        // GET 和 HEAD 請求不需要 CSRF token
        if (method == "GET" || method == "HEAD") {
            return chain.proceed(original)
        }

        val token = ensureToken(chain)
        // Skip adding header if token fetch failed — let the request proceed
        // without a CSRF header rather than sending an empty one (which always 400s)
        if (token.isEmpty()) {
            return chain.proceed(original)
        }
        val request = original.newBuilder()
            .header("X-CSRFToken", token)
            .build()
        return chain.proceed(request)
    }

    /**
     * 取得 CSRF token（若快取存在則直接回傳，否則從伺服器獲取）
     * 使用 double-checked locking 確保執行緒安全且效能最佳
     */
    private fun ensureToken(chain: Interceptor.Chain): String {
        // 第一次非同步檢查（快速路徑，無鎖）
        csrfToken?.let { return it }

        // 進入同步區塊（慢速路徑，確保只有一個執行緒獲取 token）
        synchronized(this) {
            // 第二次同步檢查（防止多執行緒重複獲取）
            csrfToken?.let { return it }

            val tokenRequest = Request.Builder()
                .url("$serverUrl/api/v1/csrf-token")
                .get()
                .build()

            val response = chain.proceed(tokenRequest)
            val body = response.body?.string() ?: ""
            response.close()

            // 從 JSON 回應中解析 csrf_token 欄位
            // 格式：{"success": true, "data": {"csrf_token": "xxx"}}
            val token = extractCsrfToken(body)
            // Only cache a non-empty token; an empty string would be permanently cached
            // and cause every subsequent write request to fail with 403.
            if (token.isNotEmpty()) csrfToken = token
            return token
        }
    }

    /**
     * 從 JSON 字串中提取 csrf_token 的值
     * 使用 Regex 解析，避免引入額外的 JSON 解析依賴
     */
    private fun extractCsrfToken(json: String): String {
        return Regex(""""csrf_token"\s*:\s*"([^"]+)"""")
            .find(json)
            ?.groupValues
            ?.get(1)
            ?: ""
    }

    /**
     * 使快取的 token 失效，下次 state-changing 請求時將重新獲取
     * 應在收到 401/403 回應或已知 token 過期時呼叫
     */
    fun invalidate() {
        csrfToken = null
    }
}
