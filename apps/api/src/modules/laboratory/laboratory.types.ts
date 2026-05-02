export interface CollectSampleInput {
  orderId:      string;
  sampleType:   string;
  barcodeOverride?: string;   // auto-generated if not provided
  notes?:       string;
}

export interface ReceiveSampleInput {
  barcode:         string;
  notes?:          string;
}

export interface RejectSampleInput {
  barcode:          string;
  rejectionReason:  string;
}

export interface EnterResultInput {
  sampleId:      string;
  components:    ResultComponentInput[];
}

export interface ResultComponentInput {
  componentName:  string;
  resultValue:    string;           // always string — "4.5", ">1000", "Positive"
  unit?:          string;
}

export interface ValidateResultInput {
  resultIds:   string[];            // validate multiple at once
}

export interface ReleaseResultInput {
  resultIds:   string[];
}

export interface SampleRow {
  id:               string;
  order_id:         string;
  patient_id:       string;
  lab_test_id:      string | null;
  barcode:          string;
  sample_type:      string;
  status:           string;
  collected_at:     Date | null;
  collected_by:     string | null;
  received_at:      Date | null;
  received_by:      string | null;
  rejection_reason: string | null;
  notes:            string | null;
  created_at:       Date;
  patient_name?:    string;
  patient_mrn?:     string;
  test_name?:       string;
  urgency?:         string;
}

export interface ResultRow {
  id:               string;
  sample_id:        string;
  order_id:         string;
  patient_id:       string;
  component_name:   string;
  result_value:     string | null;
  result_numeric:   number | null;
  unit:             string | null;
  normal_min:       number | null;
  normal_max:       number | null;
  flag:             string | null;
  is_critical:      boolean;
  entered_by:       string;
  entered_at:       Date;
  validated_by:     string | null;
  validated_at:     Date | null;
  released_at:      Date | null;
}
