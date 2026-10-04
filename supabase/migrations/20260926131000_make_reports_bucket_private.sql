-- Make reports bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'reports';
