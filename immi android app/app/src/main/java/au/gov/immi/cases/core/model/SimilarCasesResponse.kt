package au.gov.immi.cases.core.model

import com.squareup.moshi.JsonClass

/**
 * Raw response shape from GET /api/v1/cases/{id}/similar.
 *
 * The endpoint returns {"similar": [...], "available": bool} — no standard envelope.
 * Each entry contains case_id, citation, title, outcome, similarity_score.
 */
@JsonClass(generateAdapter = true)
data class SimilarCasesResponse(
    val similar: List<ImmigrationCase> = emptyList(),
    val available: Boolean = false
)
