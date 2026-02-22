-- Repopulate date_sort for any rows where date was corrected but date_sort is still NULL.
UPDATE immigration_cases
SET date_sort = safe_date_to_sortint(date)
WHERE (date_sort IS NULL)
  AND (date IS NOT NULL)
  AND (TRIM(date) != '');
