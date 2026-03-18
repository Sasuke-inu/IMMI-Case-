package au.gov.immi.cases.network

import au.gov.immi.cases.core.model.ImmigrationCase
import au.gov.immi.cases.network.api.CasesApiService
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class CasesApiServiceTest {

    private lateinit var server: MockWebServer
    private lateinit var service: CasesApiService

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
        val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/api/v1/"))
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
        service = retrofit.create(CasesApiService::class.java)
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `getCases returns paged list`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                        "cases": [
                            {"case_id": "abc123", "title": "Case One", "court": "AATA"},
                            {"case_id": "def456", "title": "Case Two", "court": "FCA"}
                        ],
                        "page": 1,
                        "page_size": 20,
                        "total": 2,
                        "total_pages": 1
                    }
                    """.trimIndent()
                )
        )

        val response = service.getCases(emptyMap())

        assertTrue(response.isSuccessful)
        val body = response.body()
        assertNotNull(body)
        // CasesResponse uses .cases (not .data) — no standard {success, data, meta} envelope
        assertEquals(2, body!!.cases.size)
        assertEquals("abc123", body.cases[0].caseId)
        assertEquals("def456", body.cases[1].caseId)
        assertEquals(2, body.total)
        assertEquals(1, body.page)
    }

    @Test
    fun `getCaseById returns single case`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                        "case": {"case_id": "abc123", "title": "Test Case", "court": "AATA", "court_code": "AATA"},
                        "full_text": "Full text of the case decision..."
                    }
                    """.trimIndent()
                )
        )

        val response = service.getCaseById("abc123")

        assertTrue(response.isSuccessful)
        val body = response.body()
        assertNotNull(body)
        // CaseDetailResponse uses .case (not .data) — no standard envelope
        assertEquals("abc123", body!!.case?.caseId)
        assertEquals("Test Case", body.case?.title)
    }

    @Test
    fun `getCases sends correct query params`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"cases": [], "page": 1, "page_size": 20, "total": 0, "total_pages": 0}""")
        )

        service.getCases(mapOf("court_code" to "AATA", "year" to "2024"))

        val recordedRequest = server.takeRequest()
        val requestUrl = recordedRequest.requestUrl.toString()
        assertTrue(
            requestUrl.contains("court_code=AATA"),
            "URL should contain court_code=AATA, was: $requestUrl"
        )
        assertTrue(
            requestUrl.contains("year=2024"),
            "URL should contain year=2024, was: $requestUrl"
        )
    }

    @Test
    fun `createCase sends POST with body`() = runTest {
        // Backend returns {"case": {...}} — CaseDetailResponse shape
        server.enqueue(
            MockResponse()
                .setResponseCode(201)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """{"case": {"case_id": "new001", "title": "New Case"}}"""
                )
        )

        val newCase = ImmigrationCase(
            caseId = "new001",
            title = "New Case",
            court = "AATA"
        )
        val response = service.createCase(newCase)

        val recordedRequest = server.takeRequest()
        assertEquals("POST", recordedRequest.method)
        val requestBody = recordedRequest.body.readUtf8()
        assertTrue(
            requestBody.contains("case_id") || requestBody.contains("new001"),
            "Request body should contain case_id, was: $requestBody"
        )
        assertTrue(response.isSuccessful || response.code() == 201)
    }

    @Test
    fun `deleteCase sends DELETE request`() = runTest {
        // Backend returns {"success": true} — raw map
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"success": true}""")
        )

        service.deleteCase("abc123")

        val recordedRequest = server.takeRequest()
        assertEquals("DELETE", recordedRequest.method)
        assertTrue(recordedRequest.path!!.contains("abc123"))
    }

    @Test
    fun `getSimilarCases returns list`() = runTest {
        // Backend returns {"similar": [...], "available": true} — SimilarCasesResponse
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                        "similar": [
                            {"case_id": "sim001", "title": "Similar Case 1"},
                            {"case_id": "sim002", "title": "Similar Case 2"}
                        ],
                        "available": true
                    }
                    """.trimIndent()
                )
        )

        val response = service.getSimilarCases("abc123")

        assertTrue(response.isSuccessful)
        val body = response.body()
        assertNotNull(body)
        // getSimilarCases returns SimilarCasesResponse — no standard envelope
        assertEquals(2, body!!.similar.size)
        assertEquals("sim001", body.similar[0].caseId)
    }

}
