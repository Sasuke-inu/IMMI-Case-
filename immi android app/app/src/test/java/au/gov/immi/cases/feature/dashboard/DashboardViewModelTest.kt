package au.gov.immi.cases.feature.dashboard

import app.cash.turbine.test
import au.gov.immi.cases.core.model.DashboardStats
import au.gov.immi.cases.data.repository.AnalyticsRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DashboardViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private val mockRepository = mockk<AnalyticsRepository>()
    private lateinit var viewModel: DashboardViewModel

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ─── 1. Initial state is Loading ─────────────────────────────────────────────

    @Test
    fun `initial state is Loading`() = runTest {
        coEvery { mockRepository.getStats() } returns Result.success(DashboardStats())
        viewModel = DashboardViewModel(mockRepository)
        // 在 coroutine 執行前，狀態應為 Loading
        assertEquals(DashboardUiState.Loading, viewModel.uiState.value)
    }

    // ─── 2. Load stats success sets data with total cases ────────────────────────

    @Test
    fun `load stats success sets data with total cases`() = runTest {
        val stats = DashboardStats(totalCases = 149016)
        coEvery { mockRepository.getStats() } returns Result.success(stats)
        viewModel = DashboardViewModel(mockRepository)

        viewModel.uiState.test {
            awaitItem() // Loading
            testDispatcher.scheduler.advanceUntilIdle()
            val success = awaitItem() as DashboardUiState.Success
            assertEquals(149016, success.stats.totalCases)
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ─── 3. Load stats success extracts court distribution ───────────────────────

    @Test
    fun `load stats success extracts court distribution`() = runTest {
        val courts = mapOf("AATA" to 39203, "FCA" to 14987, "MRTA" to 52970)
        val stats = DashboardStats(totalCases = 149016, courts = courts)
        coEvery { mockRepository.getStats() } returns Result.success(stats)
        viewModel = DashboardViewModel(mockRepository)

        viewModel.uiState.test {
            awaitItem() // Loading
            testDispatcher.scheduler.advanceUntilIdle()
            val success = awaitItem() as DashboardUiState.Success
            assertEquals(3, success.stats.courts.size)
            assertEquals(39203, success.stats.courts["AATA"])
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ─── 4. Load stats error sets error state ────────────────────────────────────

    @Test
    fun `load stats error sets error state`() = runTest {
        coEvery { mockRepository.getStats() } returns Result.failure(Exception("Network error"))
        viewModel = DashboardViewModel(mockRepository)

        viewModel.uiState.test {
            awaitItem() // Loading
            testDispatcher.scheduler.advanceUntilIdle()
            val error = awaitItem() as DashboardUiState.Error
            assertEquals("Network error", error.message)
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ─── 5. Retry after error reloads stats ──────────────────────────────────────

    @Test
    fun `retry after error reloads stats`() = runTest {
        coEvery { mockRepository.getStats() } returns Result.failure(Exception("Timeout"))
        viewModel = DashboardViewModel(mockRepository)
        testDispatcher.scheduler.advanceUntilIdle()

        // 現在 retry
        coEvery { mockRepository.getStats() } returns Result.success(DashboardStats(totalCases = 5000))
        viewModel.loadStats()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value as DashboardUiState.Success
        assertEquals(5000, state.stats.totalCases)
        coVerify(exactly = 2) { mockRepository.getStats() }
    }

    // ─── 6. withFullText is parsed from stats data ───────────────────────────────

    @Test
    fun `withFullText is parsed from stats data`() = runTest {
        val stats = DashboardStats(totalCases = 100, withFullText = 95)
        coEvery { mockRepository.getStats() } returns Result.success(stats)
        viewModel = DashboardViewModel(mockRepository)

        viewModel.uiState.test {
            awaitItem() // Loading
            testDispatcher.scheduler.advanceUntilIdle()
            val success = awaitItem() as DashboardUiState.Success
            assertEquals(95, success.stats.withFullText)
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ─── 7. Dashboard stats totalCases defaults to zero on null data ─────────────

    @Test
    fun `dashboard stats totalCases defaults to zero on null data`() = runTest {
        val stats = DashboardStats.fromApiMap(emptyMap())
        assertEquals(0, stats.totalCases)
        assertEquals(0, stats.withFullText)
        assertTrue(stats.courts.isEmpty())
    }
}
