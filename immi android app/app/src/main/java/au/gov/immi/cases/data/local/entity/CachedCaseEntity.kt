package au.gov.immi.cases.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import au.gov.immi.cases.core.model.ImmigrationCase

/**
 * 本地快取的案件資料，只儲存常用欄位（不需全 31 欄）。
 * caseId 有 unique 索引，確保不重複快取同一案件。
 */
@Entity(
    tableName = "cached_cases",
    indices = [Index("caseId", unique = true)]
)
data class CachedCaseEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val caseId: String,
    val citation: String,
    val title: String,
    val court: String,
    val courtCode: String,
    val year: Int,
    val outcome: String,
    val judges: String,
    val caseNature: String,
    val visaType: String,
    val tags: String,
    val textSnippet: String,
    val cachedAt: Long = System.currentTimeMillis()
) {
    /** Convert cached entity back to domain model (only cached fields are populated). */
    fun toImmigrationCase(): ImmigrationCase = ImmigrationCase(
        caseId = caseId,
        citation = citation,
        title = title,
        court = court,
        courtCode = courtCode,
        year = year,
        outcome = outcome,
        judges = judges,
        caseNature = caseNature,
        visaType = visaType,
        tags = tags,
        textSnippet = textSnippet
    )

    companion object {
        /** Create a cache entity from a domain model. Non-cached fields are discarded. */
        fun fromImmigrationCase(case: ImmigrationCase): CachedCaseEntity = CachedCaseEntity(
            caseId = case.caseId,
            citation = case.citation,
            title = case.title,
            court = case.court,
            courtCode = case.courtCode,
            year = case.year,
            outcome = case.outcome,
            judges = case.judges,
            caseNature = case.caseNature,
            visaType = case.visaType,
            tags = case.tags,
            textSnippet = case.textSnippet
        )
    }
}
