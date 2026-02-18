-- Add missing columns
ALTER TABLE immigration_cases ADD COLUMN IF NOT EXISTS visa_subclass TEXT;
ALTER TABLE immigration_cases ADD COLUMN IF NOT EXISTS visa_class_code TEXT;

-- Add indexes for performance (fixes get_case_statistics RPC timeout)
CREATE INDEX IF NOT EXISTS idx_cases_court_code ON immigration_cases(court_code);
CREATE INDEX IF NOT EXISTS idx_cases_year ON immigration_cases(year);
CREATE INDEX IF NOT EXISTS idx_cases_case_nature ON immigration_cases(case_nature);
CREATE INDEX IF NOT EXISTS idx_cases_source ON immigration_cases(source);
