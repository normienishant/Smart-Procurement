export type TenderStatus = 'uploaded' | 'analyzing' | 'analyzed' | 'reviewing' | 'submitted' | 'rejected';

export interface Tender {
  id: string;
  title: string;
  file_name: string;
  file_text: string;
  status: TenderStatus;
  created_at: string;
  // new fields
  tender_type?: string;
  department?: string;
  organization?: string;
  tender_id?: string;
  bid_number?: string;
  estimated_value?: number;
  emd?: number;
  tender_fee?: number;
  performance_security?: number;
  bid_submission_date?: string;
  opening_date?: string;
  bid_validity?: string;
}

export interface EligibilityRequirements {
  turnover_required?: string;
  experience_required?: string;
  oem_authorization_needed?: boolean;
  maf_required?: boolean;
  iso_certificates_required?: string;
  msme_benefits?: boolean;
  startup_exemption?: boolean;
  pan?: boolean;
  gst?: boolean;
  itr?: boolean;
  balance_sheet?: boolean;
  ca_certificate?: boolean;
}

export interface TechnicalSpec {
  spec: string;
  value: string;
  unit: string;
}

export interface ImportantClause {
  clause: string;
  text: string;
}

export interface TenderAnalysis {
  id: string;
  tender_id: string;
  client_name: string;
  project_name: string;
  project_location: string;
  scope_of_work: string;
  materials_required: string[];
  deadlines_milestones: { milestone: string; date: string }[];
  risks_penalties: { risk: string; penalty: string }[];
  payment_terms: string;
  raw_json: Record<string, unknown>;
  created_at: string;
  // new fields
  eligibility_requirements?: EligibilityRequirements;
  technical_specs?: TechnicalSpec[];
  important_clauses?: ImportantClause[];
}