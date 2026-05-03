export interface CreateInvoiceInput {
  patientId:   string;
  encounterId?: string;
  notes?:       string;
}

export interface AddInvoiceItemInput {
  invoiceId:      string;
  description:    string;
  descriptionFa?: string;
  quantity:       number;
  unitPrice:      number;
  discountPercent?: number;
  chargeTypeId?:  string;
  encounterId?:   string;
  labOrderId?:    string;
  dispensingId?:  string;
  imagingOrderId?: string;
}

export interface RecordPaymentInput {
  invoiceId:        string;
  amount:           number;
  paymentMethod:    'cash' | 'card' | 'bank_transfer' | 'insurance' | 'mobile_pay' | 'other';
  referenceNumber?: string;
  notes?:           string;
}

export interface ApplyDiscountInput {
  invoiceId:     string;
  discountType:  'percentage' | 'fixed' | 'full_waiver';
  amount?:       number;
  percentage?:   number;
  reason:        string;
}

export interface InsuranceClaimInput {
  invoiceId:         string;
  insuranceCompany:  string;
  policyNumber:      string;
  claimAmount:       number;
  notes?:            string;
}

export interface InvoiceRow {
  id:              string;
  invoice_number:  string;
  patient_id:      string;
  encounter_id:    string | null;
  subtotal:        number;
  discount_amount: number;
  tax_amount:      number;
  total_amount:    number;
  paid_amount:     number;
  balance_due:     number;
  currency:        string;
  status:          string;
  issued_at:       Date | null;
  due_date:        Date | null;
  paid_at:         Date | null;
  notes:           string | null;
  patient_name?:   string;
  patient_mrn?:    string;
}
