
CREATE POLICY "own receipt files select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own receipt files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own receipt files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
