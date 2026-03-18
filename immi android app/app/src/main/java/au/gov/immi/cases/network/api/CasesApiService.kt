package au.gov.immi.cases.network.api

import au.gov.immi.cases.core.model.CaseDetailResponse
import au.gov.immi.cases.core.model.CasesResponse
import au.gov.immi.cases.core.model.ImmigrationCase
import au.gov.immi.cases.core.model.SimilarCasesResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.QueryMap

interface CasesApiService {

    // ─── Cases CRUD ──────────────────────────────────────────────────────────────

    // /api/v1/cases returns {cases:[], page, page_size, total, total_pages} — no standard envelope
    @GET("cases")
    suspend fun getCases(
        @QueryMap params: Map<String, String>
    ): Response<CasesResponse>

    // /api/v1/cases/{id} returns {case: {...}, full_text: "..."} — no standard envelope
    @GET("cases/{id}")
    suspend fun getCaseById(
        @Path("id") id: String
    ): Response<CaseDetailResponse>

    // /api/v1/cases POST returns {"case": {...}} — same shape as CaseDetailResponse
    @POST("cases")
    suspend fun createCase(
        @Body case: ImmigrationCase
    ): Response<CaseDetailResponse>

    // /api/v1/cases/{id} PUT returns {"case": {...}} — same shape as CaseDetailResponse
    @PUT("cases/{id}")
    suspend fun updateCase(
        @Path("id") id: String,
        @Body case: ImmigrationCase
    ): Response<CaseDetailResponse>

    // /api/v1/cases/{id} DELETE returns {"success": true} — raw map
    @DELETE("cases/{id}")
    suspend fun deleteCase(
        @Path("id") id: String
    ): Response<Map<String, Any>>

    // /api/v1/cases/{id}/similar returns {"similar": [...], "available": bool}
    @GET("cases/{id}/similar")
    suspend fun getSimilarCases(
        @Path("id") id: String
    ): Response<SimilarCasesResponse>
}
