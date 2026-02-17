export interface ImmigrationCase {
  case_id: string
  citation: string
  title: string
  court: string
  court_code: string
  date: string
  year: number
  url: string
  judges: string
  catchwords: string
  outcome: string
  visa_type: string
  legislation: string
  text_snippet: string
  full_text_path: string
  source: string
  user_notes: string
  tags: string
  case_nature: string
  legal_concepts: string
  visa_subclass: string
  visa_class_code: string
  applicant_name: string
  respondent: string
  country_of_origin: string
  visa_subclass_number: string
  hearing_date: string
  is_represented: string
  representative: string
}

export interface CaseFilters {
  court?: string
  year?: number
  visa_type?: string
  source?: string
  tag?: string
  nature?: string
  keyword?: string
  sort_by?: string
  sort_dir?: "asc" | "desc"
  page?: number
  page_size?: number
}

export interface PaginatedCases {
  cases: ImmigrationCase[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface DashboardStats {
  total_cases: number
  courts: Record<string, number>
  years: Record<string, number>
  with_full_text: number
  sources: Record<string, number>
  outcomes: Record<string, number>
  recent_cases: ImmigrationCase[]
}

export interface FilterOptions {
  courts: string[]
  years: number[]
  visa_types: string[]
  sources: string[]
  tags: string[]
  natures: string[]
}

export interface JobStatus {
  running: boolean
  type?: string
  progress?: string
  total?: number
  completed?: number
  message?: string
  errors?: string[]
  results?: string[]
}
