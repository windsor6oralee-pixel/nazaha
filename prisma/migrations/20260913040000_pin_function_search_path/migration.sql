-- Pin search_path on SECURITY-relevant helper functions so a caller cannot
-- redirect unqualified names by changing their own search_path
-- (Supabase linter 0011_function_search_path_mutable). Neither function
-- references any schema object, so an empty search_path is safe.
ALTER FUNCTION app_current_org() SET search_path = '';
ALTER FUNCTION audit_logs_immutable() SET search_path = '';
