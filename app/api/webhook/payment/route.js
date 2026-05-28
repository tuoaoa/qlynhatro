import { NextResponse } from 'next/server';
const { createDatabase, run, get, close } = require('../../../../scripts/sqlite_helper');
const path = require('path');

const dbPath = path.join(process.cwd(), 'qlynhatro.db');
const SECURE_TOKEN = process.env.PAYMENT_WEBHOOK_SECURE_TOKEN || 'chothuexemay_secure_webhook_token_2026';

// Log event helper for audit logging
async function logEvent(db, invoiceId, eventType, details = {}) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await run(db, `
    INSERT INTO invoice_events (id, invoice_id, event_type, event_details)
    VALUES (?, ?, ?, ?)
  `, [eventId, invoiceId, eventType, JSON.stringify(details)]);
}

export async function POST(request) {
  // Validate Security Token from headers (Casso Secure-Token or SePay API authorization)
  const authHeader = request.headers.get('Secure-Token') || request.headers.get('Authorization');
  if (authHeader && authHeader !== SECURE_TOKEN && authHeader !== `Bearer ${SECURE_TOKEN}`) {
    return NextResponse.json({ error: 'Chữ ký bảo mật Webhook không hợp lệ.' }, { status: 401 });
  }

  const db = await createDatabase(dbPath);
  
  // Ensure invoices self-healing column exists
  try {
    await run(db, "ALTER TABLE invoices ADD COLUMN payment_memo TEXT UNIQUE");
  } catch (_) {}

  try {
    const body = await request.json();
    console.log('--- RECEIVED PAYMENT WEBHOOK ---', JSON.stringify(body));

    // Handle Casso payload or SePay payload
    let transactions = [];
    if (body.data && Array.isArray(body.data)) {
      // Casso format
      transactions = body.data;
    } else if (body.content || body.transferAmount) {
      // SePay format
      transactions = [
        {
          tid: body.referenceCode || body.id,
          description: body.content || body.code,
          amount: body.transferAmount,
          when: body.transactionDate || new Date().toISOString()
        }
      ];
    } else {
      transactions = [body];
    }

    let processedCount = 0;
    let matchedInvoices = [];

    for (const tx of transactions) {
      const description = tx.description || '';
      const amount = parseFloat(tx.amount || tx.transferAmount || 0);

      // Search for our standard payment memo inside description: NTRO-[RoomNumber]-T[Month]-[3-chars Suffix]
      const memoRegex = /(NTRO-[A-Za-z0-9]+-T[0-9]+-[A-Z0-9]+)/;
      const match = description.match(memoRegex);

      if (match) {
        const detectedMemo = match[1].toUpperCase();
        console.log(`Detected valid Payment Memo in transfer content: ${detectedMemo}`);

        // Find invoice with matching payment memo
        const invoice = await get(db, `
          SELECT * FROM invoices 
          WHERE UPPER(payment_memo) = ? AND status IN ('PENDING_PAYMENT', 'PENDING_CONFIRMATION')
        `, [detectedMemo]);

        if (invoice) {
          console.log(`Matched invoice ID: ${invoice.id} for Room ${invoice.room_id}, Total: ${invoice.total_amount}`);

          // Validate amount (allow minor difference or complete match)
          if (amount >= invoice.total_amount - 1000) {
            const nowStr = new Date().toISOString();
            
            // 1. Update invoice status to PAID
            await run(db, `
              UPDATE invoices 
              SET status = 'PAID', paid_at = ?
              WHERE id = ?
            `, [nowStr, invoice.id]);

            // 2. Insert into payments table
            const paymentId = `pmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            await run(db, `
              INSERT INTO payments (id, invoice_id, amount, paid_at, payment_method, note)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [paymentId, invoice.id, amount, nowStr, 'BANK_TRANSFER', `Auto-webhook tid: ${tx.tid}`]);

            // 3. Log event
            await logEvent(db, invoice.id, 'INVOICE_PAID_AUTO_WEBHOOK', {
              transactionId: tx.tid,
              amount: amount,
              paidAt: nowStr,
              description: description
            });

            processedCount++;
            matchedInvoices.push(detectedMemo);
          } else {
            console.warn(`Amount mismatch! Expected: ${invoice.total_amount}, Transferred: ${amount}`);
            await logEvent(db, invoice.id, 'WEBHOOK_AMOUNT_MISMATCH', {
              transactionId: tx.tid,
              amount: amount,
              expectedAmount: invoice.total_amount
            });
          }
        }
      }
    }

    await close(db);
    return NextResponse.json({
      success: true,
      processed: processedCount,
      matched: matchedInvoices
    });
  } catch (err) {
    console.error('Webhook Error:', err);
    try { await close(db); } catch (_) {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
