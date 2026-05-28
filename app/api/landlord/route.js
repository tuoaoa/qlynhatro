import { NextResponse } from 'next/server';
const { createDatabase, all, run, get, close, executeTransaction } = require('../../../scripts/sqlite_helper');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(process.cwd(), 'qlynhatro.db');
const SECRET = 'NTRO_SECRET_2026';

function generateSignature(token, month) {
  return crypto.createHmac('sha256', SECRET).update(`${token}:${month}`).digest('hex').substring(0, 16);
}

// Audit log helper
async function logEvent(db, invoiceId, eventType, details = {}) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await run(db, `
    INSERT INTO invoice_events (id, invoice_id, event_type, event_details)
    VALUES (?, ?, ?, ?)
  `, [eventId, invoiceId, eventType, JSON.stringify(details)]);
}

export async function GET(request) {
  const db = await createDatabase(dbPath);
  try {
    // Self-healing database migrations for settings, residents, and uploads
    try { await run(db, "ALTER TABLE properties ADD COLUMN meter_collect_start_day INTEGER DEFAULT 25"); } catch (_) {}
    try { await run(db, "ALTER TABLE properties ADD COLUMN meter_collect_end_day INTEGER DEFAULT 30"); } catch (_) {}
    try { await run(db, "ALTER TABLE properties ADD COLUMN auto_send_zalo INTEGER DEFAULT 0"); } catch (_) {}
    try { await run(db, "ALTER TABLE invoices ADD COLUMN resident_count INTEGER DEFAULT 1"); } catch (_) {}
    try { await run(db, "ALTER TABLE tenants ADD COLUMN cccd_front_url TEXT"); } catch (_) {}
    try { await run(db, "ALTER TABLE tenants ADD COLUMN cccd_back_url TEXT"); } catch (_) {}
    try { await run(db, "ALTER TABLE rental_contracts ADD COLUMN evidence_urls TEXT"); } catch (_) {}

    const currentMonth = '2026-05'; 

    // 1. Fetch Property Info
    const property = await get(db, 'SELECT * FROM properties LIMIT 1');

    // 2. Fetch Areas
    const areas = await all(db, 'SELECT * FROM areas');

    // 3. Fetch Rooms (with Area Name & active Tenant Name if occupied)
    const rooms = await all(db, `
      SELECT r.*, r.status as room_status, a.name as area_name,
             c.tenant_id, t.name as tenant_name, t.phone as tenant_phone,
             i.status as invoice_status, i.anomaly_status, i.access_token, i.total_amount, i.id as invoice_id, i.resident_count
      FROM rooms r
      LEFT JOIN areas a ON r.area_id = a.id
      LEFT JOIN rental_contracts c ON r.id = c.room_id AND c.status = 'ACTIVE'
      LEFT JOIN tenants t ON c.tenant_id = t.id
      LEFT JOIN invoices i ON r.id = i.room_id AND i.billing_month = ?
    `, [currentMonth]);

    // Format secure links with HMAC signature
    const roomsFormatted = rooms.map(room => {
      if (room.access_token) {
        room.signature = generateSignature(room.access_token, currentMonth);
      }
      return room;
    });

    // 4. Fetch Tenants
    const tenants = await all(db, `
      SELECT t.*, c.room_id, r.room_number
      FROM tenants t
      LEFT JOIN rental_contracts c ON t.id = c.tenant_id AND c.status = 'ACTIVE'
      LEFT JOIN rooms r ON c.room_id = r.id
    `);

    // 5. Fetch Active Contracts
    const contracts = await all(db, `
      SELECT c.*, r.room_number, t.name as tenant_name
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN tenants t ON c.tenant_id = t.id
    `);

    // 6. Tab 1: Rooms requiring meter recordings (Pending Meter)
    const pendingMeters = await all(db, `
      SELECT r.room_number, t.name as tenant_name, t.phone as tenant_phone, i.access_token, i.id as invoice_id, i.resident_count
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN tenants t ON i.tenant_id = t.id
      WHERE i.status = 'PENDING_METER' AND i.billing_month = ?
    `, [currentMonth]);

    const pendingMetersFormatted = pendingMeters.map(item => {
      item.signature = generateSignature(item.access_token, currentMonth);
      return item;
    });

    // 7. Tab 2: Rooms with anomalies
    const anomalies = await all(db, `
      SELECT r.room_number, t.name as tenant_name, i.id as invoice_id, i.anomaly_status,
             i.electricity_old, i.electricity_new, i.water_old, i.water_new
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN tenants t ON i.tenant_id = t.id
      WHERE i.anomaly_status != 'NONE' AND i.status IN ('PENDING_CONFIRMATION', 'PENDING_PAYMENT') AND i.billing_month = ?
    `, [currentMonth]);

    // 8. Tab 3: Rooms awaiting payment (Unpaid)
    const unpaid = await all(db, `
      SELECT r.room_number, t.name as tenant_name, t.phone as tenant_phone, i.id as invoice_id, i.total_amount, i.resident_count
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN tenants t ON i.tenant_id = t.id
      WHERE i.status IN ('PENDING_CONFIRMATION', 'PENDING_PAYMENT') AND i.billing_month = ?
    `, [currentMonth]);

    // 9. Fetch Paid Invoices List (Paid)
    const paidInvoices = await all(db, `
      SELECT r.room_number, t.name as tenant_name, t.phone as tenant_phone, i.id as invoice_id, i.total_amount, i.resident_count, i.paid_at
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN tenants t ON i.tenant_id = t.id
      WHERE i.status = 'PAID' AND i.billing_month = ?
    `, [currentMonth]);

    // 10. Revenue Summary
    const summary = await get(db, `
      SELECT 
        SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END) as collected,
        SUM(total_amount) as total_expected,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
        COUNT(*) as total_invoices
      FROM invoices
      WHERE billing_month = ?
    `, [currentMonth]);

    // 11. Detailed Category Revenue Stats
    const detailedRevenue = await get(db, `
      SELECT 
        SUM(room_amount) as expected_room,
        SUM(CASE WHEN status = 'PAID' THEN room_amount ELSE 0 END) as collected_room,
        
        SUM(electricity_amount) as expected_electricity,
        SUM(CASE WHEN status = 'PAID' THEN electricity_amount ELSE 0 END) as collected_electricity,
        
        SUM(water_amount) as expected_water,
        SUM(CASE WHEN status = 'PAID' THEN water_amount ELSE 0 END) as collected_water,
        
        SUM(internet_amount) as expected_internet,
        SUM(CASE WHEN status = 'PAID' THEN internet_amount ELSE 0 END) as collected_internet,
        
        SUM(service_amount) as expected_service,
        SUM(CASE WHEN status = 'PAID' THEN service_amount ELSE 0 END) as collected_service,
        
        SUM(garbage_amount) as expected_garbage,
        SUM(CASE WHEN status = 'PAID' THEN garbage_amount ELSE 0 END) as collected_garbage,
        
        SUM(total_amount) as expected_total,
        SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END) as collected_total
      FROM invoices
      WHERE billing_month = ?
    `, [currentMonth]);

    await close(db);
    return NextResponse.json({
      property,
      areas,
      rooms: roomsFormatted,
      tenants,
      contracts,
      pendingMeters: pendingMetersFormatted,
      anomalies,
      unpaid,
      paidInvoices,
      detailedRevenue: detailedRevenue || {},
      summary: {
        collected: summary.collected || 0,
        totalExpected: summary.total_expected || 0,
        paidCount: summary.paid_count || 0,
        totalInvoices: summary.total_invoices || 0
      }
    });
  } catch (err) {
    await close(db);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    const db = await createDatabase(dbPath);

    // 1. Save Config Settings
    if (action === 'save_settings') {
      const { 
        name, address, bankName, bankAccount, bankOwner, 
        electricityPrice, waterPrice, internetPrice, servicePrice, garbagePrice,
        meterCollectStartDay, meterCollectEndDay, autoSendZalo
      } = body;
      
      const prop = await get(db, 'SELECT id FROM properties LIMIT 1');
      const propId = prop ? prop.id : 'prop_anbinh';

      await run(db, `
        UPDATE properties
        SET name = ?, address = ?, bank_name = ?, bank_account = ?, bank_owner = ?,
            electricity_price = ?, water_price = ?, internet_price = ?, service_price = ?, garbage_price = ?,
            meter_collect_start_day = ?, meter_collect_end_day = ?, auto_send_zalo = ?
        WHERE id = ?
      `, [
        name, address, bankName, bankAccount, bankOwner,
        parseFloat(electricityPrice), parseFloat(waterPrice), parseFloat(internetPrice), parseFloat(servicePrice), parseFloat(garbagePrice),
        parseInt(meterCollectStartDay || 25), parseInt(meterCollectEndDay || 30), parseInt(autoSendZalo ? 1 : 0),
        propId
      ]);

      await close(db);
      return NextResponse.json({ success: true, message: 'Đã lưu cấu hình cài đặt chủ trọ thành công.' });
    }

    // 2. Create Area
    if (action === 'create_area') {
      const { name } = body;
      if (!name) {
        await close(db);
        return NextResponse.json({ error: 'Tên khu vực không được để trống' }, { status: 400 });
      }

      const id = `area_${Date.now()}`;
      const prop = await get(db, 'SELECT id FROM properties LIMIT 1');
      await run(db, 'INSERT INTO areas (id, property_id, name) VALUES (?, ?, ?)', [id, prop.id, name]);

      await close(db);
      return NextResponse.json({ success: true, message: 'Đã thêm khu vực mới thành công.' });
    }

    // 3. Create Room
    if (action === 'create_room') {
      const { roomNumber, areaId, price, electricityOld, waterOld, notes } = body;
      if (!roomNumber || !areaId || !price) {
        await close(db);
        return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin phòng bắt buộc.' }, { status: 400 });
      }

      const id = `room_${Date.now()}`;
      const prop = await get(db, 'SELECT id FROM properties LIMIT 1');
      await run(db, `
        INSERT INTO rooms (id, property_id, area_id, room_number, price, status, electricity_old, water_old, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, prop.id, areaId, roomNumber, parseFloat(price), 'VACANT',
        parseFloat(electricityOld || 0), parseFloat(waterOld || 0), notes || ''
      ]);

      await close(db);
      return NextResponse.json({ success: true, message: 'Đã tạo phòng mới thành công.' });
    }

    // 4. Create Tenant
    if (action === 'create_tenant') {
      const { name, phone, cccd, cccdFrontUrl, cccdBackUrl, notes } = body;
      if (!name || !phone) {
        await close(db);
        return NextResponse.json({ error: 'Vui lòng nhập tên và số điện thoại khách thuê.' }, { status: 400 });
      }

      const id = `tenant_${Date.now()}`;
      await run(db, 'INSERT INTO tenants (id, name, phone, cccd, cccd_front_url, cccd_back_url, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        id, name, phone, cccd || '', cccdFrontUrl || null, cccdBackUrl || null, notes || ''
      ]);

      await close(db);
      return NextResponse.json({ success: true, message: 'Đã thêm khách thuê mới thành công.' });
    }

    // 5. Assign Tenant (Move-In / Rental Contract)
    if (action === 'assign_tenant') {
      const { roomId, tenantId, coTenants, equipmentNotes, evidenceUrls, rentAmount, depositAmount, checkInDate, billingStartDate } = body;
      if (!roomId || !tenantId || !rentAmount || !checkInDate || !billingStartDate) {
        await close(db);
        return NextResponse.json({ error: 'Vui lòng điền đầy đủ các thông tin hợp đồng bắt buộc.' }, { status: 400 });
      }

      const contractId = `contract_${Date.now()}`;
      const coTenantsJson = coTenants ? JSON.stringify(coTenants) : null;
      const evidenceUrlsJson = evidenceUrls ? JSON.stringify(evidenceUrls) : null;
      
      // Execute as transaction to ensure atomic room state changes
      await executeTransaction(db, async (tx) => {
        // Create Contract
        await tx.run(`
          INSERT INTO rental_contracts (id, room_id, tenant_id, co_tenants, equipment_notes, evidence_urls, check_in_date, rent_amount, deposit_amount, billing_start_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [contractId, roomId, tenantId, coTenantsJson, equipmentNotes || null, evidenceUrlsJson, checkInDate, parseFloat(rentAmount), parseFloat(depositAmount || 0), billingStartDate, 'ACTIVE']);

        // Update Room status to OCCUPIED
        await tx.run('UPDATE rooms SET status = "OCCUPIED" WHERE id = ?', [roomId]);
      });

      await close(db);
      return NextResponse.json({ success: true, message: 'Đã hoàn thành thủ tục Move-in & Ký hợp đồng thuê thành công.' });
    }

    // 6. Bulk Monthly Open
    if (action === 'bulk_open') {
      const month = body.targetMonth || '2026-05';
      
      const activeContracts = await all(db, `
        SELECT c.id as contract_id, c.rent_amount, c.room_id, c.tenant_id, c.co_tenants,
               r.electricity_old as room_elec, r.water_old as room_water
        FROM rental_contracts c
        JOIN rooms r ON c.room_id = r.id
        WHERE c.status = 'ACTIVE' AND r.status = 'OCCUPIED'
      `);

      let count = 0;
      for (const contract of activeContracts) {
        // Verify invoice not already created for this month
        const exists = await get(db, 'SELECT id FROM invoices WHERE room_id = ? AND billing_month = ?', [contract.room_id, month]);
        if (exists) continue;

        // Try getting last month's final readings as current old readings
        const prevInvoice = await get(db, `
          SELECT electricity_new, water_new FROM invoices 
          WHERE room_id = ? AND status = 'PAID'
          ORDER BY billing_month DESC LIMIT 1
        `, [contract.room_id]);

        const elecOld = prevInvoice && prevInvoice.electricity_new ? prevInvoice.electricity_new : contract.room_elec;
        const waterOld = prevInvoice && prevInvoice.water_new ? prevInvoice.water_new : contract.room_water;

        const token = crypto.randomBytes(6).toString('hex');
        const expiresAt = '2026-06-15'; // Expiry for tokens
        const invoiceId = `inv_${contract.room_id}_${month.replace('-', '')}`;

        // Compute occupant count
        let residentCount = 1;
        if (contract.co_tenants) {
          try {
            const coList = JSON.parse(contract.co_tenants);
            if (Array.isArray(coList)) {
              residentCount += coList.length;
            }
          } catch (_) {}
        }

        await run(db, `
          INSERT INTO invoices (
            id, room_id, tenant_id, contract_id, billing_month, access_token, token_expires_at,
            electricity_old, water_old, room_amount, status, resident_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId, contract.room_id, contract.tenant_id, contract.contract_id, month, token, expiresAt,
          elecOld, waterOld, contract.rent_amount, 'PENDING_METER', residentCount
        ]);

        await logEvent(db, invoiceId, 'MONTH_OPENED_BULK', {
          month,
          electricityOld: elecOld,
          waterOld: waterOld
        });
        count++;
      }

      await close(db);
      return NextResponse.json({ success: true, message: `Khởi tạo tháng ${month} thành công cho ${count} phòng đang thuê.` });
    }

    // 7. Manually Confirm Payment (Mark Paid)
    if (action === 'mark_paid') {
      const { invoiceId } = body;
      if (!invoiceId) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu mã hóa đơn để thanh toán.' }, { status: 400 });
      }

      const invoice = await get(db, 'SELECT room_id, total_amount, electricity_new, water_new FROM invoices WHERE id = ?', [invoiceId]);
      if (!invoice) {
        await close(db);
        return NextResponse.json({ error: 'Hóa đơn không tồn tại.' }, { status: 404 });
      }

      await executeTransaction(db, async (tx) => {
        // Update Invoice status to PAID
        await tx.run(`
          UPDATE invoices
          SET status = 'PAID', paid_at = ?
          WHERE id = ?
        `, [new Date().toISOString(), invoiceId]);

        // Propagate current readings to the room row as history for carry-over
        if (invoice.electricity_new !== null && invoice.water_new !== null) {
          await tx.run(`
            UPDATE rooms
            SET electricity_old = ?, water_old = ?
            WHERE id = ?
          `, [invoice.electricity_new, invoice.water_new, invoice.room_id]);
        }

        // Insert into payments
        const paymentId = `pay_${Date.now()}`;
        await tx.run(`
          INSERT INTO payments (id, invoice_id, amount, paid_at, payment_method, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [paymentId, invoiceId, invoice.total_amount, new Date().toISOString(), 'CASH/BANK', 'Thanh toán trực tiếp chủ trọ']);
      });

      await logEvent(db, invoiceId, 'PAYMENT_PAID', {
        paidAt: new Date().toISOString(),
        confirmedManually: true
      });

      await close(db);
      return NextResponse.json({ success: true, message: 'Đã duyệt thanh toán thành công.' });
    }

    // 8. Send automatic Zalo message via Zalo Bot Platform
    if (action === 'send_zalo') {
      const { phone, message } = body;
      if (!phone || !message) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu số điện thoại hoặc nội dung tin nhắn.' }, { status: 400 });
      }

      const botToken = '2234032595052848922:DwXEMvkLmmKxzyzEreSxltwwobQmYLKiYiqRlaOOimIQOJKwfswJMOHHSBjOGhtZ';
      const url = `https://bot-api.zaloplatforms.com/bot${botToken}/sendMessage`;

      let botSent = false;
      let botError = null;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: phone,
            text: message
          })
        });
        const resJson = await response.json();
        if (response.ok && resJson.ok) {
          botSent = true;
        } else {
          botError = resJson.description || resJson.message || 'Lỗi gửi tin nhắn Zalo Bot';
        }
      } catch (err) {
        botError = err.message;
      }

      await close(db);
      return NextResponse.json({ 
        success: true, 
        botSent, 
        botError,
        message: botSent ? 'Đã gửi tin nhắn tự động qua Zalo Bot thành công!' : `Zalo Bot chưa gửi được tự động (${botError}). Chuyển hướng sang gửi thủ công...` 
      });
    }

    // 9. Edit Room
    if (action === 'edit_room') {
      const { id, roomNumber, areaId, price, electricityOld, waterOld, notes } = body;
      if (!id || !roomNumber || !areaId || !price) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu thông tin phòng trọ để cập nhật.' }, { status: 400 });
      }
      await run(db, `
        UPDATE rooms
        SET room_number = ?, area_id = ?, price = ?, electricity_old = ?, water_old = ?, notes = ?
        WHERE id = ?
      `, [roomNumber, areaId, parseFloat(price), parseFloat(electricityOld || 0), parseFloat(waterOld || 0), notes || '', id]);
      await close(db);
      return NextResponse.json({ success: true, message: 'Đã cập nhật thông tin phòng thành công.' });
    }

    // 10. Delete Room
    if (action === 'delete_room') {
      const { id } = body;
      if (!id) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu mã phòng để xóa.' }, { status: 400 });
      }
      await run(db, 'DELETE FROM rooms WHERE id = ?', [id]);
      await close(db);
      return NextResponse.json({ success: true, message: 'Đã xóa phòng trọ thành công.' });
    }

    // 11. Edit Tenant
    if (action === 'edit_tenant') {
      const { id, name, phone, cccd, cccdFrontUrl, cccdBackUrl, notes } = body;
      if (!id || !name || !phone) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu thông tin khách thuê để cập nhật.' }, { status: 400 });
      }
      await run(db, `
        UPDATE tenants
        SET name = ?, phone = ?, cccd = ?, cccd_front_url = ?, cccd_back_url = ?, notes = ?
        WHERE id = ?
      `, [name, phone, cccd || '', cccdFrontUrl || null, cccdBackUrl || null, notes || '', id]);
      await close(db);
      return NextResponse.json({ success: true, message: 'Đã cập nhật khách thuê thành công.' });
    }

    // 12. Delete Tenant
    if (action === 'delete_tenant') {
      const { id } = body;
      if (!id) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu mã khách thuê để xóa.' }, { status: 400 });
      }
      await run(db, 'DELETE FROM tenants WHERE id = ?', [id]);
      await close(db);
      return NextResponse.json({ success: true, message: 'Đã xóa khách thuê thành công.' });
    }

    // 13. Edit Area
    if (action === 'edit_area') {
      const { id, name } = body;
      if (!id || !name) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu thông tin khu vực/tầng để cập nhật.' }, { status: 400 });
      }
      await run(db, 'UPDATE areas SET name = ? WHERE id = ?', [name, id]);
      await close(db);
      return NextResponse.json({ success: true, message: 'Đã cập nhật tên khu vực/tầng thành công.' });
    }

    // 14. Delete Area
    if (action === 'delete_area') {
      const { id } = body;
      if (!id) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu mã khu vực/tầng để xóa.' }, { status: 400 });
      }
      await executeTransaction(db, async (tx) => {
        // Set associated rooms' area_id to null to maintain database integrity safely
        await tx.run('UPDATE rooms SET area_id = NULL WHERE area_id = ?', [id]);
        // Delete the area
        await tx.run('DELETE FROM areas WHERE id = ?', [id]);
      });
      await close(db);
      return NextResponse.json({ success: true, message: 'Đã xóa khu vực/tầng thành công.' });
    }

    // 15. Bulk Send Zalo (Automatic and Manual Trigger)
    if (action === 'bulk_send_zalo') {
      const month = body.targetMonth || '2026-05';
      const isReminder = !!body.isReminder; // Whether this is a reminder or the initial opening chot-so link

      // Get all active rooms, tenants and their invoices for this month
      const invoices = await all(db, `
        SELECT i.id as invoice_id, i.access_token, i.status as invoice_status,
               r.room_number, t.name as tenant_name, t.phone as tenant_phone
        FROM invoices i
        JOIN rooms r ON i.room_id = r.id
        JOIN tenants t ON i.tenant_id = t.id
        WHERE i.billing_month = ? AND i.status = 'PENDING_METER'
      `, [month]);

      let count = 0;
      let errors = [];
      const botToken = '2234032595052848922:DwXEMvkLmmKxzyzEreSxltwwobQmYLKiYiqRlaOOimIQOJKwfswJMOHHSBjOGhtZ';
      const url = `https://bot-api.zaloplatforms.com/bot${botToken}/sendMessage`;

      const host = request.headers.get('host') || '180.93.144.63';
      const protocol = request.headers.get('x-forwarded-proto') || 'http';

      for (const inv of invoices) {
        const sig = generateSignature(inv.access_token, month);
        const link = `${protocol}://${host}/qlynhatro/r/${inv.access_token}?m=${month}&s=${sig}`;
        
        const messageText = isReminder
          ? `[NHẮC NHỞ MÉT ĐIỆN NƯỚC] Kính gửi anh/chị ${inv.tenant_name} (Phòng ${inv.room_number}), vui lòng chụp ảnh và tự nhập số điện nước tháng ${month} trước ngày kết thúc thời hạn. Nhấn vào link sau để chốt số: ${link}`
          : `Kính gửi anh/chị ${inv.tenant_name} (Phòng ${inv.room_number}), đã đến kỳ chốt số điện nước tháng ${month}. Vui lòng nhấn vào liên kết sau để tự chụp ảnh và chốt số: ${link}`;

        try {
          const resBot = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: inv.tenant_phone,
              text: messageText
            })
          });
          const resJson = await resBot.json();
          if (resBot.ok && resJson.ok) {
            count++;
            await logEvent(db, inv.invoice_id, isReminder ? 'ZALO_REMINDER_SENT' : 'ZALO_BULK_SENT', { phone: inv.tenant_phone });
          } else {
            errors.push(`${inv.room_number}: ${resJson.description || 'Lỗi gửi Zalo'}`);
          }
        } catch (err) {
          errors.push(`${inv.room_number}: ${err.message}`);
        }
      }

      await close(db);
      return NextResponse.json({
        success: true,
        message: `Đã gửi thành công tin nhắn Zalo đến ${count} phòng.`,
        errors
      });
    }

    // 16. Update Invoice Resident Count and Recalculate
    if (action === 'update_invoice_residents') {
      const { invoiceId, residentCount } = body;
      if (!invoiceId || residentCount === undefined) {
        await close(db);
        return NextResponse.json({ error: 'Thiếu mã hóa đơn hoặc số lượng người ở.' }, { status: 400 });
      }

      const countVal = parseInt(residentCount);
      if (isNaN(countVal) || countVal < 1) {
        await close(db);
        return NextResponse.json({ error: 'Số lượng người ở phải lớn hơn hoặc bằng 1.' }, { status: 400 });
      }

      // Check current invoice
      const invoice = await get(db, 'SELECT * FROM invoices WHERE id = ?', [invoiceId]);
      if (!invoice) {
        await close(db);
        return NextResponse.json({ error: 'Hóa đơn không tồn tại.' }, { status: 404 });
      }

      const config = await get(db, 'SELECT * FROM properties LIMIT 1');

      await executeTransaction(db, async (tx) => {
        // Update resident_count
        await tx.run('UPDATE invoices SET resident_count = ? WHERE id = ?', [countVal, invoiceId]);

        // If the invoice has already recorded meter and is in PENDING_CONFIRMATION or PENDING_PAYMENT, recalculate amounts!
        if (invoice.status === 'PENDING_CONFIRMATION' || invoice.status === 'PENDING_PAYMENT') {
          const eUsage = invoice.electricity_new - invoice.electricity_old;
          const electricityAmount = eUsage * config.electricity_price;
          
          const waterAmount = config.water_price * countVal;
          const internetAmount = config.internet_price * countVal;
          const serviceAmount = config.service_price * countVal;
          const garbageAmount = (config.garbage_price || 0) * countVal;

          const totalAmount = invoice.room_amount + electricityAmount + waterAmount + internetAmount + serviceAmount + garbageAmount;

          await tx.run(`
            UPDATE invoices
            SET water_amount = ?,
                internet_amount = ?,
                service_amount = ?,
                garbage_amount = ?,
                total_amount = ?
            WHERE id = ?
          `, [waterAmount, internetAmount, serviceAmount, garbageAmount, totalAmount, invoiceId]);
        }
      });

      await close(db);
      return NextResponse.json({ success: true, message: 'Đã cập nhật số người và tự động tính lại chi phí thành công.' });
    }

    // Fallback if action is unsupported
    await close(db);
    return NextResponse.json({ error: 'Yêu cầu không được hỗ trợ.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
