package au.gov.immi.cases.network.api

import au.gov.immi.cases.core.model.ApiResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface SystemApiService {

    @GET("csrf-token")
    suspend fun getCsrfToken(): Response<ApiResponse<Map<String, String>>>

    // /api/v1/stats returns the stats map directly (no {success,data} envelope)
    @GET("stats")
    suspend fun getStats(): Response<Map<String, Any>>

    // /api/v1/job-status returns job_manager.snapshot() — raw map, no envelope
    @GET("job-status")
    suspend fun getJobStatus(): Response<Map<String, Any>>

    @POST("pipeline/start")
    suspend fun startPipeline(
        @Body params: Map<String, Any>
    ): Response<ApiResponse<Map<String, Any>>>

    @POST("download/start")
    suspend fun startDownload(
        @Body params: Map<String, Any>
    ): Response<ApiResponse<Map<String, Any>>>
}
