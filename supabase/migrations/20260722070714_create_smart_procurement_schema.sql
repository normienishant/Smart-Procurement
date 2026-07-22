/*
# Smart Procurement MVP Schema

## Summary
Creates the full schema for the AI-powered procurement workflow application.

## New Tables

### tenders
Stores uploaded tender documents and tracks their workflow status.
- id: UUID primary key
- title: Document display name
- file_name: Original filename
- file_text: Extracted text content from the document (used for AI analysis)
- status: Workflow state (uploaded | analyzing | analyzed | reviewing | submitted | rejected)
- created_at: Timestamp

### tender_analysis
Stores the AI-extracted structured summary of a tender document.
- id: UUID primary key
- tender_id: FK to tenders
- client_name, project_name, project_location: Client & project details
- scope_of_work, materials_required: Scope details
- deadlines_milestones: JSON array of deadline/milestone objects
- risks_penalties: JSON array of identified risks
- payment_terms: Payment term details
- raw_json: Full raw AI response for debugging
- created_at: Timestamp

### boq_items
Bill of Quantities line items extracted by AI, editable by users.
- id: UUID primary key
- tender_id: FK to tenders
- item_code: ERP item code
- description: Item description
- quantity: Numeric quantity
- unit: Unit of measure
- unit_rate: Price per unit
- total_amount: Computed total
- notes: Optional user notes
- position: Sort order for display
- created_at: Timestamp

## Security
- RLS enabled on all tables with anon + authenticated access (single-tenant, no auth required)
*/

-- Tenders table
CREATE TABLE IF NOT EXISTS tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_name text NOT NULL,
  file_text text DEFAULT '',
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tenders" ON tenders;
CREATE POLICY "anon_select_tenders" ON tenders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tenders" ON tenders;
CREATE POLICY "anon_insert_tenders" ON tenders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tenders" ON tenders;
CREATE POLICY "anon_update_tenders" ON tenders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tenders" ON tenders;
CREATE POLICY "anon_delete_tenders" ON tenders FOR DELETE TO anon, authenticated USING (true);

-- Tender analysis table
CREATE TABLE IF NOT EXISTS tender_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  client_name text DEFAULT '',
  project_name text DEFAULT '',
  project_location text DEFAULT '',
  scope_of_work text DEFAULT '',
  materials_required jsonb DEFAULT '[]',
  deadlines_milestones jsonb DEFAULT '[]',
  risks_penalties jsonb DEFAULT '[]',
  payment_terms text DEFAULT '',
  raw_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tender_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_analysis" ON tender_analysis;
CREATE POLICY "anon_select_analysis" ON tender_analysis FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_analysis" ON tender_analysis;
CREATE POLICY "anon_insert_analysis" ON tender_analysis FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_analysis" ON tender_analysis;
CREATE POLICY "anon_update_analysis" ON tender_analysis FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_analysis" ON tender_analysis;
CREATE POLICY "anon_delete_analysis" ON tender_analysis FOR DELETE TO anon, authenticated USING (true);

-- BOQ items table
CREATE TABLE IF NOT EXISTS boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  item_code text DEFAULT '',
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'NOS',
  unit_rate numeric NOT NULL DEFAULT 0,
  total_amount numeric GENERATED ALWAYS AS (quantity * unit_rate) STORED,
  notes text DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_boq" ON boq_items;
CREATE POLICY "anon_select_boq" ON boq_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_boq" ON boq_items;
CREATE POLICY "anon_insert_boq" ON boq_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_boq" ON boq_items;
CREATE POLICY "anon_update_boq" ON boq_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_boq" ON boq_items;
CREATE POLICY "anon_delete_boq" ON boq_items FOR DELETE TO anon, authenticated USING (true);

-- Indexes for FK lookups
CREATE INDEX IF NOT EXISTS idx_tender_analysis_tender_id ON tender_analysis(tender_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_tender_id ON boq_items(tender_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_position ON boq_items(tender_id, position);
