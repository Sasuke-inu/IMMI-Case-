package au.gov.immi.cases.data.repository

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import au.gov.immi.cases.core.model.CasesFilter
import au.gov.immi.cases.core.model.ImmigrationCase
import au.gov.immi.cases.data.local.dao.CachedCaseDao
import au.gov.immi.cases.data.local.entity.CachedCaseEntity
import au.gov.immi.cases.feature.cases.paging.CasesPagingSource
import au.gov.immi.cases.network.api.CasesApiService
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Production implementation of [CasesRepository].
 *
 * Uses [CasesApiService] as the primary data source with [CachedCaseDao] for
 * offline caching of individual case detail views.
 *
 * All methods return immutable [Result] wrappers — callers must handle both
 * [Result.success] and [Result.failure] paths.
 */
@Singleton
class CasesRepositoryImpl @Inject constructor(
    private val api: CasesApiService,
    private val cachedCaseDao: CachedCaseDao
) : CasesRepository {

    companion object {
        /** Cache entries older than 24 hours are considered stale. */
        private const val CACHE_TTL_MS = 24 * 60 * 60 * 1000L
    }

    override fun getCasesPager(filter: CasesFilter): Flow<PagingData<ImmigrationCase>> {
        return Pager(
            config = PagingConfig(
                pageSize = 20,
                prefetchDistance = 5,
                enablePlaceholders = false
            ),
            pagingSourceFactory = { CasesPagingSource(api, filter) }
        ).flow
    }

    override suspend fun getCaseById(caseId: String): Result<ImmigrationCase> = runCatching {
        // 1. Check cache first
        val cached = cachedCaseDao.getCachedCase(caseId)
        if (cached != null) {
            val cacheAge = System.currentTimeMillis() - cached.cachedAt
            if (cacheAge < CACHE_TTL_MS) {
                return@runCatching cached.toImmigrationCase()
            }
        }

        // 2. Fetch from API
        val response = api.getCaseById(caseId)
        if (response.isSuccessful) {
            val case = response.body()?.case ?: error("Case not found: $caseId")
            // 3. Save to cache
            cachedCaseDao.insertCachedCase(CachedCaseEntity.fromImmigrationCase(case))
            case
        } else {
            // 4. If API fails but we have stale cache, return it
            cached?.toImmigrationCase()
                ?: error("Case not found: $caseId (HTTP ${response.code()})")
        }
    }

    override suspend fun createCase(case: ImmigrationCase): Result<ImmigrationCase> = runCatching {
        val response = api.createCase(case)
        if (!response.isSuccessful) {
            error("Failed to create case (HTTP ${response.code()})")
        }
        // Backend returns {"case": {...}} — same shape as CaseDetailResponse
        response.body()?.case ?: error("Failed to create case: empty response")
    }

    override suspend fun updateCase(
        caseId: String,
        case: ImmigrationCase
    ): Result<ImmigrationCase> = runCatching {
        val response = api.updateCase(caseId, case)
        if (!response.isSuccessful) {
            error("Failed to update case: $caseId (HTTP ${response.code()})")
        }
        // Backend returns {"case": {...}} — same shape as CaseDetailResponse
        response.body()?.case ?: error("Failed to update case: $caseId — empty response")
    }

    override suspend fun deleteCase(caseId: String): Result<Unit> = runCatching {
        val response = api.deleteCase(caseId)
        if (!response.isSuccessful) {
            error("Failed to delete case: $caseId (HTTP ${response.code()})")
        }
        // Remove from local cache after successful server deletion
        cachedCaseDao.deleteCachedCase(caseId)
    }

    override suspend fun getSimilarCases(caseId: String): Result<List<ImmigrationCase>> =
        runCatching {
            val response = api.getSimilarCases(caseId)
            if (!response.isSuccessful) {
                error("Failed to get similar cases (HTTP ${response.code()})")
            }
            // Backend returns {"similar": [...], "available": bool}
            response.body()?.similar ?: emptyList()
        }
}
