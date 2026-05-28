import { NextResponse } from 'next/server';
const { createDatabase, run, get, close } = require('../../../scripts/sqlite_helper');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(process.cwd(), 'qlynhatro.db');
const SECRET = 'NTRO_SECRET_2026';

// Lightweight IP Rate Limiter
const requestCounts = new Map();
const LIMIT_WINDOW = 60 * 1000; // 1 min
const MAX_REQUESTS = 30;

function rateLimit(ip) {
  const now = Date.now();
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + LIMIT_WINDOW });
    return true;
  }

  const client = requestCounts.get(ip);
  if (now > client.resetTime) {
    client.count = 1;
    client.resetTime = now + LIMIT_WINDOW;
    return true;
  }

  client.count++;
  return client.count <= MAX_REQUESTS;
}

function generateSignature(token, month) {
  return crypto.createHmac('sha256', SECRET).update(`${token}:${month}`).digest('hex').substring(0, 16);
}

export async function GET(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const month = searchParams.get('m');
  const signature = searchParams.get('s');

  if (!token || !month || !signature) {
    return NextResponse.json({ error: 'Thiếu tham số hoặc chữ ký bảo mật đường dẫn.' }, { status: 400 });
  }

  const expectedSig = generateSignature(token, month);
  if (signature !== expectedSig) {
    return NextResponse.json({ error: 'Liên kết không hợp lệ hoặc chữ ký số bị sai.' }, { status: 403 });
  }

  const db = await createDatabase(dbPath);
  try {
    const invoice = await get(db, `
      SELECT i.*, r.room_number, r.price as room_price, t.name as tenant_name, t.phone as tenant_phone,
             c.co_tenants
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN tenants t ON i.tenant_id = t.id
      LEFT JOIN rental_contracts c ON i.contract_id = c.id
      WHERE i.access_token = ? AND i.billing_month = ?
    `, [token, month]);

    if (!invoice) {
      await close(db);
      return NextResponse.json({ error: 'Đường dẫn chốt số không hợp lệ cho tháng này.' }, { status: 404 });
    }

    const expiryDate = new Date(invoice.token_expires_at);
    if (new Date() > expiryDate) {
      await close(db);
      return NextResponse.json({ error: 'Đường dẫn chốt số tháng này đã hết hạn bảo mật.' }, { status: 403 });
    }

    const config = await get(db, 'SELECT * FROM properties LIMIT 1');

    const prevMonthParts = month.split('-');
    let prevYear = parseInt(prevMonthParts[0]);
    let prevMonthNum = parseInt(prevMonthParts[1]) - 1;
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYear -= 1;
    }
    const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    const prevInvoice = await get(db, `
      SELECT electricity_new, electricity_old, water_new, water_old
      FROM invoices
      WHERE room_id = ? AND billing_month = ?
    `, [invoice.room_id, prevMonth]);

    const historicalUsage = {
      electricity: prevInvoice ? (prevInvoice.electricity_new - prevInvoice.electricity_old) : 100,
      water: prevInvoice ? (prevInvoice.water_new - prevInvoice.water_old) : 8,
    };

    await close(db);
    return NextResponse.json({
      invoice,
      config,
      historicalUsage
    });
  } catch (err) {
    await close(db);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Log events inside dynamic audit table
async function logEvent(db, invoiceId, eventType, details = {}) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await run(db, `
    INSERT INTO invoice_events (id, invoice_id, event_type, event_details)
    VALUES (?, ?, ?, ?)
  `, [eventId, invoiceId, eventType, JSON.stringify(details)]);
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Yêu cầu quá nhanh. Vui lòng đợi 1 phút.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { token, month, signature, electricityNew, waterNew, confirm } = body;

    if (!token || !month || !signature) {
      return NextResponse.json({ error: 'Thiếu tham số hoặc chữ ký bảo mật.' }, { status: 400 });
    }

    const expectedSig = generateSignature(token, month);
    if (signature !== expectedSig) {
      return NextResponse.json({ error: 'Chữ ký bảo mật không chính xác.' }, { status: 403 });
    }

    const db = await createDatabase(dbPath);

    const invoice = await get(db, `
      SELECT i.*, r.room_number, r.price as room_price, t.name as tenant_name,
             c.co_tenants
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN tenants t ON i.tenant_id = t.id
      LEFT JOIN rental_contracts c ON i.contract_id = c.id
      WHERE i.access_token = ? AND i.billing_month = ?
    `, [token, month]);

    if (!invoice) {
      await close(db);
      return NextResponse.json({ error: 'Hóa đơn tháng này không tồn tại.' }, { status: 404 });
    }

    const config = await get(db, 'SELECT * FROM properties LIMIT 1');

    // Scenario A: Client is confirming the invoice
    if (confirm === true) {
      // Ensure self-healing column exists
      try { await run(db, "ALTER TABLE invoices ADD COLUMN payment_memo TEXT UNIQUE"); } catch (_) {}

      // Unique Payment Memo suffix NTRO-[Room]-[Month]-[3-chars]
      const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().substring(0, 3);
      const addInfo = `NTRO-${invoice.room_number}-T${month.replace('-', '')}-${randomSuffix}`;

      await run(db, `
        UPDATE invoices
        SET status = 'PENDING_PAYMENT', payment_memo = ?
        WHERE id = ?
      `, [addInfo, invoice.id]);
      
      const bankName = config.bank_name || 'VCB';
      const bankAccount = config.bank_account || '0071001234567';
      const bankOwner = config.bank_owner || 'Nguyen Van A';
      
      const vietqrUrl = `https://img.vietqr.io/image/${bankName}-${bankAccount}-compact2.png?amount=${invoice.total_amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(bankOwner)}`;

      // Write audit log
      await logEvent(db, invoice.id, 'INVOICE_CONFIRMED', {
        confirmedAt: new Date().toISOString(),
        totalAmount: invoice.total_amount,
        memo: addInfo
      });

      await close(db);
      return NextResponse.json({
        success: true,
        status: 'PENDING_PAYMENT',
        totalAmount: invoice.total_amount,
        vietqrUrl,
        memo: addInfo,
        bankName,
        bankAccount,
        bankOwner
      });
    }

    // Scenario B: Client is submitting new meter readings
    const eNew = parseFloat(electricityNew);
    const wNew = parseFloat(waterNew);

    if (eNew < invoice.electricity_old || wNew < invoice.water_old) {
      await close(db);
      return NextResponse.json({ error: 'Lỗi: Số điện nước mới không được nhỏ hơn chỉ số cũ.' }, { status: 400 });
    }

    const prevMonthParts = month.split('-');
    let prevYear = parseInt(prevMonthParts[0]);
    let prevMonthNum = parseInt(prevMonthParts[1]) - 1;
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYear -= 1;
    }
    const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    const prevInvoice = await get(db, `
      SELECT electricity_new, electricity_old, water_new, water_old
      FROM invoices
      WHERE room_id = ? AND billing_month = ? AND status = 'PAID'
    `, [invoice.room_id, prevMonth]);

    const prevElecUsage = prevInvoice ? (prevInvoice.electricity_new - prevInvoice.electricity_old) : 100;
    const prevWaterUsage = prevInvoice ? (prevInvoice.water_new - prevInvoice.water_old) : 8;

    const eUsage = eNew - invoice.electricity_old;
    const wUsage = wNew - invoice.water_old;

    let anomalyStatus = 'NONE';
    if (eUsage > prevElecUsage * 1.5 || wUsage > prevWaterUsage * 1.5) {
      anomalyStatus = 'ABNORMAL_HIGH';
    } else if (eUsage < prevElecUsage * 0.3 || wUsage < prevWaterUsage * 0.3) {
      anomalyStatus = 'ABNORMAL_LOW';
    }

    const electricityAmount = eUsage * config.electricity_price;

    const residentCount = invoice.resident_count || 1;

    const waterAmount = config.water_price * residentCount;
    const internetAmount = config.internet_price * residentCount;
    const serviceAmount = config.service_price * residentCount;
    const garbageAmount = (config.garbage_price || 0) * residentCount;
    const totalAmount = invoice.room_amount + electricityAmount + waterAmount + internetAmount + serviceAmount + garbageAmount;

    await run(db, `
      UPDATE invoices
      SET electricity_new = ?,
          water_new = ?,
          electricity_amount = ?,
          water_amount = ?,
          internet_amount = ?,
          service_amount = ?,
          garbage_amount = ?,
          total_amount = ?,
          anomaly_status = ?,
          status = 'PENDING_CONFIRMATION'
      WHERE id = ?
    `, [
      eNew, wNew,
      electricityAmount, waterAmount, internetAmount, serviceAmount, garbageAmount,
      totalAmount, anomalyStatus,
      invoice.id
    ]);

    // Write audit log
    await logEvent(db, invoice.id, 'METER_SUBMITTED', {
      electricityNew: eNew,
      waterNew: wNew,
      electricityUsage: eUsage,
      waterUsage: wUsage,
      electricityAmount,
      waterAmount,
      anomalyStatus
    });

    await close(db);
    return NextResponse.json({
      success: true,
      status: 'PENDING_CONFIRMATION',
      anomalyStatus,
      totalAmount,
      electricityAmount,
      waterAmount,
      electricityUsage: eUsage,
      waterUsage: wUsage
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
