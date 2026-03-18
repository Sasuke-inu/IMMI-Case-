package au.gov.immi.cases.data.repository

import au.gov.immi.cases.core.model.CaseDetailResponse
import au.gov.immi.cases.core.model.ImmigrationCase
import au.gov.immi.cases.core.model.SimilarCasesResponse
import au.gov.immi.cases.data.local.dao.CachedCaseDao
import au.gov.immi.cases.data.local.entity.CachedCaseEntity
import au.gov.immi.cases.network.api.CasesApiService
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import retrofit2.Response
import java.io.IOException

class CasesRepositoryTest {

    private val mockApi = mockk<CasesApiService>()
    private val mockDao = mockk<CachedCaseDao>(relaxed = true)
    private lateinit var repository: CasesRepositoryImpl

    @BeforeEach
    fun setUp() {
        repository = CasesRepositoryImpl(mockApi, mockDao)
    }

    // ─── getCaseById ─────────────────────────────────────────────────────────────

    @Test
    fun `getCaseById returns success when API returns case`() = runTest {
        val case = ImmigrationCase(caseId = "abc123", citation = "[2024] AATA 1")
        val detailResponse = CaseDetailResponse(case = case)
        coEvery { mockApi.getCaseById("abc123") } returns Response.success(detailResponse)

        val result = repository.getCaseById("abc123")

        assertTrue(result.isSuccess)
        assertEquals("abc123", result.getOrNull()?.caseId)
    }

    @Test
    fun `getCaseById returns failure when API throws`() = runTest {
        coEvery { mockApi.getCaseById(any()) } throws IOException("Network error")

        val result = repository.getCaseById("abc123")

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Network") == true)
    }

    @Test
    fun `getCaseById returns failure when response body is null`() = runTest {
        coEvery { mockApi.getCaseById("missing") } returns Response.success(null)

        val result = repository.getCaseById("missing")

        assertTrue(result.isFailure)
    }

    // ─── createCase ──────────────────────────────────────────────────────────────

    @Test
    fun `createCase returns new case on success`() = runTest {
        val newCase = ImmigrationCase(caseId = "new1", citation = "[2025] ARTA 5")
        // Backend returns {"case": {...}} — same shape as CaseDetailResponse
        val detailResponse = CaseDetailResponse(case = newCase)
        coEvery { mockApi.createCase(any()) } returns Response.success(201, detailResponse)

        val result = repository.createCase(newCase)

        assertTrue(result.isSuccess)
        assertEquals("new1", result.getOrNull()?.caseId)
    }

    @Test
    fun `createCase returns failure when body case is null`() = runTest {
        val detailResponse = CaseDetailResponse(case = null)
        coEvery { mockApi.createCase(any()) } returns Response.success(201, detailResponse)

        val result = repository.createCase(ImmigrationCase())

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("empty response") == true)
    }

    @Test
    fun `createCase returns failure on HTTP error`() = runTest {
        coEvery { mockApi.createCase(any()) } returns Response.error(
            400,
            """{"error":"Title or citation is required"}""".toResponseBody()
        )

        val result = repository.createCase(ImmigrationCase())

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 400") == true)
    }

    // ─── updateCase ──────────────────────────────────────────────────────────────

    @Test
    fun `updateCase sends correct data`() = runTest {
        val updatedCase = ImmigrationCase(caseId = "abc123", outcome = "Granted")
        // Backend returns {"case": {...}} — same shape as CaseDetailResponse
        val detailResponse = CaseDetailResponse(case = updatedCase)
        coEvery { mockApi.updateCase("abc123", any()) } returns Response.success(detailResponse)

        val result = repository.updateCase("abc123", updatedCase)

        assertTrue(result.isSuccess)
        assertEquals("Granted", result.getOrNull()?.outcome)
    }

    @Test
    fun `updateCase returns failure on network error`() = runTest {
        val case = ImmigrationCase(caseId = "abc123")
        coEvery { mockApi.updateCase(any(), any()) } throws IOException("Timeout")

        val result = repository.updateCase("abc123", case)

        assertTrue(result.isFailure)
    }

    @Test
    fun `updateCase returns failure on HTTP error`() = runTest {
        val case = ImmigrationCase(caseId = "abc123")
        coEvery { mockApi.updateCase(any(), any()) } returns Response.error(
            404,
            """{"error":"Case not found"}""".toResponseBody()
        )

        val result = repository.updateCase("abc123", case)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 404") == true)
    }

    // ─── deleteCase ──────────────────────────────────────────────────────────────

    @Test
    fun `deleteCase returns success`() = runTest {
        // Backend returns {"success": true} — raw map
        coEvery { mockApi.deleteCase("abc123") } returns Response.success(
            mapOf("success" to true as Any)
        )

        val result = repository.deleteCase("abc123")

        assertTrue(result.isSuccess)
    }

    @Test
    fun `deleteCase returns failure when API throws`() = runTest {
        coEvery { mockApi.deleteCase(any()) } throws IOException("Network error")

        val result = repository.deleteCase("abc123")

        assertTrue(result.isFailure)
    }

    @Test
    fun `deleteCase returns failure on HTTP error`() = runTest {
        coEvery { mockApi.deleteCase("notfound") } returns Response.error(
            404,
            """{"error":"Case not found"}""".toResponseBody()
        )

        val result = repository.deleteCase("notfound")

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 404") == true)
    }

    // ─── getSimilarCases ─────────────────────────────────────────────────────────

    @Test
    fun `getSimilarCases returns list`() = runTest {
        val cases = listOf(
            ImmigrationCase(caseId = "sim1"),
            ImmigrationCase(caseId = "sim2")
        )
        // Backend returns {"similar": [...], "available": true}
        val response = SimilarCasesResponse(similar = cases, available = true)
        coEvery { mockApi.getSimilarCases("abc123") } returns Response.success(response)

        val result = repository.getSimilarCases("abc123")

        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()?.size)
    }

    @Test
    fun `getSimilarCases returns empty list when similar is empty`() = runTest {
        val response = SimilarCasesResponse(similar = emptyList(), available = true)
        coEvery { mockApi.getSimilarCases("abc123") } returns Response.success(response)

        val result = repository.getSimilarCases("abc123")

        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrNull()?.size)
    }

    @Test
    fun `getSimilarCases returns failure on HTTP error`() = runTest {
        coEvery { mockApi.getSimilarCases("bad") } returns Response.error(
            400,
            """{"error":"Invalid case ID"}""".toResponseBody()
        )

        val result = repository.getSimilarCases("bad")

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("HTTP 400") == true)
    }

    // ─── Cache-first strategy ─────────────────────────────────────────────────

    @Test
    fun `getCaseById returns cached case when fresh`() = runTest {
        val cached = CachedCaseEntity(
            caseId = "abc123",
            citation = "[2024] AATA 1",
            title = "Test Case",
            court = "AATA",
            courtCode = "AATA",
            year = 2024,
            outcome = "Granted",
            judges = "Smith J",
            caseNature = "Protection visa",
            visaType = "866",
            tags = "",
            textSnippet = "snippet",
            cachedAt = System.currentTimeMillis() // fresh
        )
        coEvery { mockDao.getCachedCase("abc123") } returns cached

        val result = repository.getCaseById("abc123")

        assertTrue(result.isSuccess)
        assertEquals("abc123", result.getOrNull()?.caseId)
        assertEquals("[2024] AATA 1", result.getOrNull()?.citation)
        // API should NOT be called when cache is fresh
        coVerify(exactly = 0) { mockApi.getCaseById(any()) }
    }

    @Test
    fun `getCaseById fetches from API when cache expired`() = runTest {
        val staleTime = System.currentTimeMillis() - (25 * 60 * 60 * 1000L) // 25 hours ago
        val cached = CachedCaseEntity(
            caseId = "abc123",
            citation = "[2024] AATA 1",
            title = "Old Title",
            court = "AATA",
            courtCode = "AATA",
            year = 2024,
            outcome = "Refused",
            judges = "",
            caseNature = "",
            visaType = "",
            tags = "",
            textSnippet = "",
            cachedAt = staleTime
        )
        coEvery { mockDao.getCachedCase("abc123") } returns cached

        val freshCase = ImmigrationCase(caseId = "abc123", citation = "[2024] AATA 1", title = "New Title")
        coEvery { mockApi.getCaseById("abc123") } returns Response.success(
            CaseDetailResponse(case = freshCase)
        )

        val result = repository.getCaseById("abc123")

        assertTrue(result.isSuccess)
        assertEquals("New Title", result.getOrNull()?.title)
        // API should be called because cache is stale
        coVerify(exactly = 1) { mockApi.getCaseById("abc123") }
    }

    @Test
    fun `getCaseById saves to cache after API fetch`() = runTest {
        coEvery { mockDao.getCachedCase("new1") } returns null

        val apiCase = ImmigrationCase(caseId = "new1", citation = "[2025] ARTA 5", court = "ARTA")
        coEvery { mockApi.getCaseById("new1") } returns Response.success(
            CaseDetailResponse(case = apiCase)
        )

        val result = repository.getCaseById("new1")

        assertTrue(result.isSuccess)
        assertEquals("new1", result.getOrNull()?.caseId)
        // Verify it was saved to cache
        coVerify(exactly = 1) { mockDao.insertCachedCase(match { it.caseId == "new1" }) }
    }

    @Test
    fun `getCaseById returns stale cache when API fails`() = runTest {
        val staleTime = System.currentTimeMillis() - (25 * 60 * 60 * 1000L)
        val cached = CachedCaseEntity(
            caseId = "abc123",
            citation = "[2024] AATA 1",
            title = "Stale Case",
            court = "AATA",
            courtCode = "AATA",
            year = 2024,
            outcome = "Granted",
            judges = "",
            caseNature = "",
            visaType = "",
            tags = "",
            textSnippet = "",
            cachedAt = staleTime
        )
        coEvery { mockDao.getCachedCase("abc123") } returns cached
        coEvery { mockApi.getCaseById("abc123") } returns Response.error(
            500,
            """{"error":"Internal Server Error"}""".toResponseBody()
        )

        val result = repository.getCaseById("abc123")

        assertTrue(result.isSuccess)
        assertEquals("Stale Case", result.getOrNull()?.title)
    }

    @Test
    fun `deleteCase removes from cache`() = runTest {
        coEvery { mockApi.deleteCase("abc123") } returns Response.success(
            mapOf("success" to true as Any)
        )

        val result = repository.deleteCase("abc123")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { mockDao.deleteCachedCase("abc123") }
    }
}
