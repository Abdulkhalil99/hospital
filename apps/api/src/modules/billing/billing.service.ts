import { BillingRepository }  from './billing.repository';
import {
  CreateInvoiceInput, AddInvoiceItemInput,
  RecordPaymentInput, ApplyDiscountInput,
  InsuranceClaimInput,
} from './billing.types';
import {
  NotFoundError, ConflictError, ForbiddenError, ValidationError,
} from '@/shared/errors/app-error';
import { eventBus } from '@/shared/events/event-bus';
import { EVENTS }   from '@/shared/events/event-types';
import { logger }   from '@/infrastructure/logger/logger';

export class BillingService {
  private repo = new BillingRepository();

  // ── Guard ─────────────────────────────────────────────────
  private async getInvoiceOrFail(id: string) {
    const inv = await this.repo.findInvoiceById(id);
    if (!inv) throw new NotFoundError('Invoice', id);
    return inv;
  }

  // ── Charge types ──────────────────────────────────────────
  async getChargeTypes() {
    return this.repo.getChargeTypes();
  }

  // ── Invoices ──────────────────────────────────────────────
  async createInvoice(data: CreateInvoiceInput, createdBy: string) {
    const invoice = await this.repo.createInvoice(data, createdBy);
    logger.info('Invoice created', { invoiceId: invoice.id, patientId: data.patientId });
    eventBus.emit(EVENTS.INVOICE_GENERATED, { invoiceId: invoice.id, patientId: data.patientId });
    return invoice;
  }

  async getInvoiceById(id: string) {
    const invoice = await this.getInvoiceOrFail(id);
    const [items, payments] = await Promise.all([
      this.repo.getItems(id),
      this.repo.getPayments(id),
    ]);
    return { invoice, items, payments };
  }

  async listInvoices(filters: {
    patientId?: string; status?: string;
    from?: string; to?: string;
    page?: number; limit?: number;
  }) {
    const limit  = Math.min(100, filters.limit  ?? 20);
    const offset = ((filters.page ?? 1) - 1) * limit;
    const { rows, total } = await this.repo.listInvoices({ ...filters, limit, offset });
    return {
      data:       rows,
      pagination: { page: filters.page ?? 1, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Issue invoice (draft → issued) ────────────────────────
  async issueInvoice(id: string, issuedBy: string) {
    const invoice = await this.getInvoiceOrFail(id);

    if (invoice.status !== 'draft') {
      throw new ConflictError(`Invoice is already ${invoice.status}. Only draft invoices can be issued.`);
    }

    const items = await this.repo.getItems(id);
    if (items.length === 0) {
      throw new ValidationError([{ message: 'Cannot issue an invoice with no line items.' }]);
    }

    // Due date: 30 days from today
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const updated = await this.repo.updateInvoiceStatus(id, 'issued', {
      issued_at: new Date(),
      due_date:  dueDate,
      updated_by: issuedBy,
    });

    logger.info('Invoice issued', {
      invoiceId:     id,
      invoiceNumber: invoice.invoice_number,
      total:         invoice.total_amount,
    });

    return updated;
  }

  // ── Add line item ─────────────────────────────────────────
  async addItem(data: AddInvoiceItemInput) {
    const invoice = await this.getInvoiceOrFail(data.invoiceId);

    if (['paid', 'void', 'cancelled'].includes(invoice.status)) {
      throw new ForbiddenError(
        `Cannot add items to an invoice with status '${invoice.status}'.`,
      );
    }

    const item = await this.repo.addItem(data);
    logger.info('Invoice item added', { invoiceId: data.invoiceId, description: data.description });
    return item;
  }

  async removeItem(invoiceId: string, itemId: string) {
    const invoice = await this.getInvoiceOrFail(invoiceId);

    if (invoice.status === 'paid') {
      throw new ForbiddenError('Cannot remove items from a paid invoice.');
    }

    const removed = await this.repo.removeItem(itemId, invoiceId);
    if (!removed) throw new NotFoundError('Invoice item', itemId);
  }

  // ── Payments ──────────────────────────────────────────────
  async recordPayment(data: RecordPaymentInput, receivedBy: string) {
    const invoice = await this.getInvoiceOrFail(data.invoiceId);

    if (['draft', 'cancelled', 'void'].includes(invoice.status)) {
      throw new ForbiddenError(
        `Cannot record payment for an invoice with status '${invoice.status}'.`,
      );
    }

    if (data.amount > invoice.balance_due) {
      throw new ValidationError([{
        message: `Payment amount (${data.amount}) exceeds balance due (${invoice.balance_due}).`,
      }]);
    }

    const payment = await this.repo.recordPayment(data, receivedBy);

    // Auto-generate receipt
    const receipt = await this.repo.generateReceipt(payment.id, data.invoiceId, receivedBy);

    logger.info('Payment recorded', {
      invoiceId:     data.invoiceId,
      amount:        data.amount,
      method:        data.paymentMethod,
      receiptNumber: receipt.receipt_number,
    });

    eventBus.emit(EVENTS.PAYMENT_RECEIVED, {
      invoiceId:     data.invoiceId,
      amount:        data.amount,
      patientId:     invoice.patient_id,
      receiptNumber: receipt.receipt_number,
    });

    return { payment, receipt };
  }

  async getPayments(invoiceId: string) {
    await this.getInvoiceOrFail(invoiceId);
    return this.repo.getPayments(invoiceId);
  }

  // ── Discounts ─────────────────────────────────────────────
  async requestDiscount(data: ApplyDiscountInput, requestedBy: string) {
    await this.getInvoiceOrFail(data.invoiceId);

    if (data.discountType === 'percentage' && !data.percentage) {
      throw new ValidationError([{ message: 'percentage is required for discount type "percentage".' }]);
    }
    if (data.discountType === 'fixed' && !data.amount) {
      throw new ValidationError([{ message: 'amount is required for discount type "fixed".' }]);
    }

    const discount = await this.repo.requestDiscount({
      invoiceId:    data.invoiceId,
      discountType: data.discountType,
      amount:       data.amount,
      percentage:   data.percentage,
      reason:       data.reason,
      requestedBy,
    });

    logger.info('Discount requested', { invoiceId: data.invoiceId, type: data.discountType });
    return discount;
  }

  async approveDiscount(discountId: string, approvedBy: string) {
    await this.repo.approveDiscount(discountId, approvedBy);
    logger.info('Discount approved', { discountId, by: approvedBy });
    return { message: 'Discount applied to invoice.' };
  }

  async getPendingDiscounts() {
    return this.repo.getPendingDiscounts();
  }

  // ── Insurance claim ───────────────────────────────────────
  async submitInsuranceClaim(data: InsuranceClaimInput, createdBy: string) {
    const invoice = await this.getInvoiceOrFail(data.invoiceId);

    if (data.claimAmount > invoice.total_amount) {
      throw new ValidationError([{
        message: `Claim amount (${data.claimAmount}) cannot exceed invoice total (${invoice.total_amount}).`,
      }]);
    }

    const claim = await this.repo.createInsuranceClaim({
      ...data, createdBy,
    });

    logger.info('Insurance claim submitted', {
      invoiceId: data.invoiceId,
      company:   data.insuranceCompany,
      amount:    data.claimAmount,
    });

    return claim;
  }

  // ── Void invoice ──────────────────────────────────────────
  async voidInvoice(id: string, voidedBy: string) {
    const invoice = await this.getInvoiceOrFail(id);

    if (invoice.paid_amount > 0) {
      throw new ForbiddenError(
        'Cannot void an invoice that has received payments. Issue a refund first.',
      );
    }
    if (invoice.status === 'void') {
      throw new ConflictError('Invoice is already void.');
    }

    const updated = await this.repo.updateInvoiceStatus(id, 'void', { updated_by: voidedBy });
    logger.info('Invoice voided', { invoiceId: id, by: voidedBy });
    return updated;
  }

  // ── Reports ───────────────────────────────────────────────
  async getDailyRevenue(date?: string) {
    return this.repo.getDailyRevenue(date);
  }

  async getRevenueByPeriod(from: string, to: string) {
    return this.repo.getRevenueByPeriod(from, to);
  }

  async getOutstandingBalances() {
    return this.repo.getOutstandingBalances();
  }

  async getCashierSummary(date?: string) {
    return this.repo.getCashierSummary(date);
  }
}
