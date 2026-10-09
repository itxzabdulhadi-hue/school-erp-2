import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, setupTestApp, type Fixtures } from './setup';

let fx: Fixtures;
beforeAll(async () => { fx = await setupTestApp(); });

describe('finance', () => {
  it('collects a partial payment and updates the invoice', async () => {
    const pay = await request(fx.app).post('/api/v1/payments')
      .set('Authorization', bearer(fx.tokens.admin))
      .send({ invoiceId: fx.invoiceUnpaid, amount: 2000, method: 'cash' });
    expect(pay.status).toBe(201);
    expect(pay.body.data.receiptNo).toMatch(/^RCP-/);

    const inv = await request(fx.app).get(`/api/v1/invoices/${fx.invoiceUnpaid}`).set('Authorization', bearer(fx.tokens.admin));
    expect(inv.body.data.paid).toBe(2000);
    expect(inv.body.data.balance).toBe(3000);
    expect(inv.body.data.status).toBe('partial');
    expect(inv.body.data.payments).toHaveLength(1);
  });

  it('rejects overpayment', async () => {
    const res = await request(fx.app).post('/api/v1/payments')
      .set('Authorization', bearer(fx.tokens.admin))
      .send({ invoiceId: fx.invoiceUnpaid, amount: 99999 });
    expect(res.status).toBe(422);
  });

  it('marks the invoice paid when settled in full', async () => {
    await request(fx.app).post('/api/v1/payments')
      .set('Authorization', bearer(fx.tokens.admin))
      .send({ invoiceId: fx.invoiceUnpaid, amount: 3000, method: 'bank', reference: 'TRX-1' });
    const inv = await request(fx.app).get(`/api/v1/invoices/${fx.invoiceUnpaid}`).set('Authorization', bearer(fx.tokens.admin));
    expect(inv.body.data.status).toBe('paid');
    expect(inv.body.data.balance).toBe(0);

    const again = await request(fx.app).post('/api/v1/payments')
      .set('Authorization', bearer(fx.tokens.admin))
      .send({ invoiceId: fx.invoiceUnpaid, amount: 10 });
    expect(again.status).toBe(422);
  });

  it('renders a full receipt payload', async () => {
    const pays = await request(fx.app).get(`/api/v1/payments?invoiceId=${fx.invoiceUnpaid}`).set('Authorization', bearer(fx.tokens.admin));
    const receipt = await request(fx.app).get(`/api/v1/receipts/${pays.body.data[0].id}`).set('Authorization', bearer(fx.tokens.student));
    expect(receipt.status).toBe(200);
    expect(receipt.body.data.payment.receiptNo).toBeTruthy();
    expect(receipt.body.data.school.name).toBe('Test School');
    expect(receipt.body.data.student.id).toBe(fx.pupil1);
  });

  it('creates invoices with computed totals', async () => {
    const res = await request(fx.app).post('/api/v1/invoices')
      .set('Authorization', bearer(fx.tokens.admin))
      .send({
        studentId: fx.pupil2, title: 'Fee', issueDate: '2026-10-01', dueDate: '2026-10-15',
        lines: [{ label: 'Tuition', qty: 1, amount: 5000 }, { label: 'Transport', qty: 1, amount: 2500 }],
        discount: 500,
      });
    expect(res.status).toBe(201);
    const inv = await request(fx.app).get(`/api/v1/invoices/${res.body.data.id}`).set('Authorization', bearer(fx.tokens.admin));
    expect(inv.body.data.total).toBe(7000);
    expect(inv.body.data.lines).toHaveLength(2);
  });
});
