-- The original schema let any signed-in user delete or overwrite files in the reports bucket
-- under a folder named after their user id. 20261004122000 replaced its read and upload rules
-- but not these two. The app keeps report files at the bucket root and never updates them;
-- the only delete it needs is reports_objects_delete_own_orphan. Permissive policies are
-- OR'ed, so these would let a file's folder owner delete or replace it even while a report
-- uses it.

DROP POLICY IF EXISTS "File owners can delete files" ON storage.objects;
DROP POLICY IF EXISTS "File owners can update files" ON storage.objects;
