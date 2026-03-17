-- Add notification_emails column to opportunities table
ALTER TABLE public.opportunities
ADD COLUMN notification_emails TEXT[] DEFAULT '{}';

-- Create vendor_submissions table
CREATE TABLE IF NOT EXISTS public.vendor_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.vendor_submissions ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON TABLE public.vendor_submissions TO authenticated;

-- Policies for vendor_submissions
CREATE POLICY "Admins can CRUD all vendor submissions" ON public.vendor_submissions
    FOR ALL
    TO authenticated
    USING (is_admin());

CREATE POLICY "Vendors can insert their own submissions" ON public.vendor_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Vendors can view their own submissions" ON public.vendor_submissions
    FOR SELECT
    TO authenticated
    USING (vendor_id = auth.uid());

-- Storage policies for the existing "opportunity-files" bucket
-- Note: the directory path should start with 'submissions/'
CREATE POLICY "Admins can view and delete all submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'opportunity-files' AND is_admin());

CREATE POLICY "Admins can insert submission files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'opportunity-files' AND is_admin());

CREATE POLICY "Admins can delete submission files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'opportunity-files' AND is_admin());

CREATE POLICY "Vendors can upload into submissions folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'opportunity-files' AND 
  (storage.foldername(name))[1] = 'submissions'
);

CREATE POLICY "Vendors can view their own submissions folder files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'opportunity-files' AND 
  (storage.foldername(name))[1] = 'submissions'
);
