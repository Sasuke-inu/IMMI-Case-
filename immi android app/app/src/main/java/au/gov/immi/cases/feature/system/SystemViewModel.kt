package au.gov.immi.cases.feature.system

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import au.gov.immi.cases.network.api.SystemApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SystemUiState(
    val isLoading: Boolean = false,
    val jobs: Map<String, Any> = emptyMap(),
    val error: String? = null,
    val actionSuccess: String? = null
)

/**
 * ViewModel shared across [DownloadScreen], [JobStatusScreen], and [PipelineScreen].
 *
 * Provides job listing and the ability to trigger download / pipeline actions
 * via [SystemApiService]. Results are surfaced as [SystemUiState].
 */
@HiltViewModel
class SystemViewModel @Inject constructor(
    private val systemApi: SystemApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(SystemUiState())
    val uiState: StateFlow<SystemUiState> = _uiState.asStateFlow()

    fun loadJobs() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            runCatching {
                val resp = systemApi.getJobStatus()
                // /api/v1/job-status returns the snapshot map directly — no envelope
                if (resp.isSuccessful) {
                    resp.body() ?: emptyMap()
                } else {
                    emptyMap<String, Any>()
                }
            }.fold(
                onSuccess = { jobs ->
                    _uiState.update { it.copy(isLoading = false, jobs = jobs) }
                },
                onFailure = { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
            )
        }
    }

    fun startDownload() {
        viewModelScope.launch {
            _uiState.update { it.copy(error = null, actionSuccess = null) }
            runCatching { systemApi.startDownload(emptyMap()) }
                .onSuccess { _uiState.update { it.copy(actionSuccess = "Download started") } }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }

    fun startPipeline(courts: List<String> = emptyList()) {
        viewModelScope.launch {
            _uiState.update { it.copy(error = null, actionSuccess = null) }
            runCatching { systemApi.startPipeline(mapOf("courts" to courts)) }
                .onSuccess { _uiState.update { it.copy(actionSuccess = "Pipeline started") } }
                .onFailure { e -> _uiState.update { it.copy(error = e.message) } }
        }
    }
}
