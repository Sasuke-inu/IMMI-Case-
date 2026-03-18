package au.gov.immi.cases.network

import au.gov.immi.cases.network.api.AnalyticsApiService
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class AnalyticsApiServiceTest {

    private lateinit var server: MockWebServer
    private lateinit var service: AnalyticsApiService

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
        val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/api/v1/"))
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
        service = retrofit.create(AnalyticsApiService::class.java)
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `getOutcomes returns data map`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                        "success": true,
                        "data": {
                            "by_court": {"AATA": {"Granted": 120, "Dismissed": 80}},
                            "total": 200
                        }
                    }
                    """.trimIndent()
                )
        )

        val response = service.getOutcomes()

        assertTrue(response.isSuccessful)
        val body = response.body()
        assertNotNull(body)
        // AnalyticsApiService returns Map<String, Any> — check map keys directly
        assertTrue(body!!.containsKey("success"))
        assertTrue(body.containsKey("data"))
    }

    @Test
    fun `getJudgeProfile sends name query param`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                        "success": true,
                        "data": {
                            "name": "Smith",
                            "total_cases": 150,
                            "outcomes": {"Granted": 80, "Dismissed": 70}
                        }
                    }
                    """.trimIndent()
                )
        )

        service.getJudgeProfile("Smith")

        val recordedRequest = server.takeRequest()
        val requestUrl = recordedRequest.requestUrl.toString()
        assertTrue(
            requestUrl.contains("name=Smith"),
            "URL should contain name=Smith, was: $requestUrl"
        )
    }

    @Test
    fun `getFilterOptions returns options map`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                        "success": true,
                        "data": {
                            "courts": ["AATA", "FCA", "RRTA"],
                            "years": [2020, 2021, 2022, 2023, 2024],
                            "outcomes": ["Granted", "Dismissed", "Remitted"]
                        }
                    }
                    """.trimIndent()
                )
        )

        val response = service.getFilterOptions()

        assertTrue(response.isSuccessful)
        val body = response.body()
        assertNotNull(body)
        // AnalyticsApiService returns Map<String, Any> — check map keys directly
        assertTrue(body!!.containsKey("success"))
        assertTrue(body.containsKey("data"))
    }

    @Test
    fun `compareJudges sends names param`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                        "success": true,
                        "data": {
                            "judges": ["Smith", "Jones"],
                            "comparison": {}
                        }
                    }
                    """.trimIndent()
                )
        )

        service.compareJudges("Smith,Jones")

        val recordedRequest = server.takeRequest()
        val requestUrl = recordedRequest.requestUrl.toString()
        assertTrue(
            requestUrl.contains("names="),
            "URL should contain names= param, was: $requestUrl"
        )
    }

    @Test
    fun `getLegalConcepts returns data`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                        "success": true,
                        "data": {
                            "concepts": [
                                {"name": "Natural Justice", "count": 250},
                                {"name": "Jurisdictional Error", "count": 180}
                            ]
                        }
                    }
                    """.trimIndent()
                )
        )

        val response = service.getLegalConcepts()

        assertTrue(response.isSuccessful)
        val body = response.body()
        assertNotNull(body)
        // AnalyticsApiService returns Map<String, Any> — check map key
        assertTrue(body!!.containsKey("success"))
    }

    @Test
    fun `getJudges with filter params sends query`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"success": true, "data": {"judges": []}}""")
        )

        service.getJudges(mapOf("court" to "AATA", "year" to "2024"))

        val recordedRequest = server.takeRequest()
        val requestUrl = recordedRequest.requestUrl.toString()
        assertTrue(
            requestUrl.contains("court=AATA"),
            "URL should contain court=AATA, was: $requestUrl"
        )
    }
}
