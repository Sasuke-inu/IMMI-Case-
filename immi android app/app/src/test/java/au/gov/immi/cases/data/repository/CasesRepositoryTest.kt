package au.gov.immi.cases.data.repository

import au.gov.immi.cases.core.model.ApiResponse
import au.gov.immi.cases.core.model.ImmigrationCase
import au.gov.immi.cases.data.local.dao.CachedCaseDao
import au.gov.immi.cases.network.api.CasesApiService
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
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
        val detailResponse = au.gov.immi.cases.core.model.CaseDetailResponse(case = case)
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

    // ─── deleteCase ──────────────────────────────────────────────────────────────

    @Test
    fun `deleteCase returns success`() = runTest {
        val apiResponse = ApiResponse<Any?>(success = true)
        coEvery { mockApi.deleteCase("abc123") } returns Response.success(apiResponse)

        val result = repository.deleteCase("abc123")

        assertTrue(result.isSuccess)
    }

    @Test
    fun `deleteCase returns failure when API throws`() = runTest {
        coEvery { mockApi.deleteCase(any()) } throws IOException("Network error")

        val result = repository.deleteCase("abc123")

        assertTrue(result.isFailure)
    }

    // ─── getSimilarCases ─────────────────────────────────────────────────────────

    @Test
    fun `getSimilarCases returns list`() = runTest {
        val cases = listOf(
            ImmigrationCase(caseId = "sim1"),
            ImmigrationCase(caseId = "sim2")
        )
        val apiResponse = ApiResponse(success = true, data = cases)
        coEvery { mockApi.getSimilarCases("abc123") } returns Response.success(apiResponse)

        val result = repository.getSimilarCases("abc123")

        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()?.size)
    }

    @Test
    fun `getSimilarCases returns empty list when data is null`() = runTest {
        val apiResponse = ApiResponse<List<ImmigrationCase>>(success = true, data = null)
        coEvery { mockApi.getSimilarCases("abc123") } returns Response.success(apiResponse)

        val result = repository.getSimilarCases("abc123")

        assertTrue(result.isSuccess)
        assertEquals(0, result.getOrNull()?.size)
    }

    // ─── updateCase ──────────────────────────────────────────────────────────────

    @Test
    fun `updateCase sends correct data`() = runTest {
        val updatedCase = ImmigrationCase(caseId = "abc123", outcome = "Granted")
        val apiResponse = ApiResponse(success = true, data = updatedCase)
        coEvery { mockApi.updateCase("abc123", any()) } returns Response.success(apiResponse)

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

    // ─── createCase ──────────────────────────────────────────────────────────────

    @Test
    fun `createCase returns new case on success`() = runTest {
        val newCase = ImmigrationCase(caseId = "new1", citation = "[2025] ARTA 5")
        val apiResponse = ApiResponse(success = true, data = newCase)
        coEvery { mockApi.createCase(any()) } returns Response.success(apiResponse)

        val result = repository.createCase(newCase)

        assertTrue(result.isSuccess)
        assertEquals("new1", result.getOrNull()?.caseId)
    }

    @Test
    fun `createCase returns failure when body data is null`() = runTest {
        val apiResponse = ApiResponse<ImmigrationCase>(success = true, data = null)
        coEvery { mockApi.createCase(any()) } returns Response.success(apiResponse)

        val result = repository.createCase(ImmigrationCase())

        assertTrue(result.isFailure)
    }
}
