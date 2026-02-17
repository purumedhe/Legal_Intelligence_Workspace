
-- General messages table for independent AI chat
CREATE TABLE public.general_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.general_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own general messages"
ON public.general_messages
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add analysis_data to cases for storing structured analysis results
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS analysis_data JSONB;
