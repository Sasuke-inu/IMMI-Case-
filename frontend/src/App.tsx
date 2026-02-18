import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { AppLayout } from "@/components/layout/AppLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { CasesPage } from "@/pages/CasesPage"
import { CaseDetailPage } from "@/pages/CaseDetailPage"
import { CaseEditPage } from "@/pages/CaseEditPage"
import { CaseAddPage } from "@/pages/CaseAddPage"
import { CaseComparePage } from "@/pages/CaseComparePage"
import { DownloadPage } from "@/pages/DownloadPage"
import { JobStatusPage } from "@/pages/JobStatusPage"
import { PipelinePage } from "@/pages/PipelinePage"
import { DataDictionaryPage } from "@/pages/DataDictionaryPage"
import { DesignTokensPage } from "@/pages/DesignTokensPage"
import { AnalyticsPage } from "@/pages/AnalyticsPage"
import { JudgeProfilesPage } from "@/pages/JudgeProfilesPage"
import { JudgeDetailPage } from "@/pages/JudgeDetailPage"
import { JudgeComparePage } from "@/pages/JudgeComparePage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/add" element={<CaseAddPage />} />
            <Route path="cases/compare" element={<CaseComparePage />} />
            <Route path="cases/:id" element={<CaseDetailPage />} />
            <Route path="cases/:id/edit" element={<CaseEditPage />} />
            <Route path="download" element={<DownloadPage />} />
            <Route path="jobs" element={<JobStatusPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="judge-profiles" element={<JudgeProfilesPage />} />
            <Route path="judge-profiles/compare" element={<JudgeComparePage />} />
            <Route path="judge-profiles/:name" element={<JudgeDetailPage />} />
            <Route path="data-dictionary" element={<DataDictionaryPage />} />
            <Route path="design-tokens" element={<DesignTokensPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  )
}
