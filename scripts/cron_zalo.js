const path = require('path');
const crypto = require('crypto');
const { createDatabase, all, run, get, close, executeTransaction } = require('./sqlite_helper');

const dbPath = path.join(__dirname, '..', 'qlynhatro.db');
const SECRET = 'NTRO_SECRET_2026';

function generateSignature(token, month) {
  return crypto.createHmac('sha256', SECRET).update(`${token}:${month}`).digest('hex').substring(0, 16);
}

// Zalo Bot configurations
const botToken = '2234032595052848922:DwXEMvkLmmKxzyzEreSxltwwobQmYLKiYiqRlaOOimIQOJKwfswJMOHHSBjOGhtZ';
const botUrl = `https://bot-api.zaloplatforms.com/bot${botToken}/sendMessage`;

async function sendZaloMessage(phone, message) {
  try {
    const response = await fetch(botUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: phone, text: message })
    });
    const resJson = await response.json();
    return response.ok && resJson.ok;
  } catch (err) {
    console.error(`Lỗi gửi tin nhắn Zalo đến ${phone}:`, err.message);
    return false;
  }
}

async function runCron() {
  console.log(`[${new Date().toISOString()}] Bắt đầu chạy kiểm tra Cron gửi Zalo tự động...`);
  const db = await createDatabase(dbPath);

  try {
    const prop = await get(db, 'SELECT * FROM properties LIMIT 1');
    if (!prop) {
      console.log('Không tìm thấy cấu hình toà nhà/nhà trọ trong database. Thoát.');
      await close(db);
      return;
    }

    if (prop.auto_send_zalo !== 1) {
      console.log('Chức năng "Tự động gửi tin nhắn Zalo" đang TẮT. Thoát.');
      await close(db);
      return;
    }

    const today = new Date();
    const currentDay = today.getDate();
    const startDay = prop.meter_collect_start_day || 25;
    const endDay = prop.meter_collect_end_day || 30;

    const year = today.getFullYear();
    const monthVal = String(today.getMonth() + 1).padStart(2, '0');
    const currentMonth = `${year}-${monthVal}`; // e.g. 2026-05

    // Force run switches for manual server debugging (e.g. node cron_zalo.js --force-start)
    const forceStart = process.argv.includes('--force-start');
    const forceRemind = process.argv.includes('--force-remind');

    const shouldStart = currentDay === startDay || forceStart;
    const shouldRemind = (currentDay > startDay && currentDay <= endDay) || forceRemind;

    const host = '180.93.144.63'; // VPS Nginx endpoint host
    const protocol = 'http';

    if (shouldStart) {
      console.log(`Hôm nay là ngày bắt đầu chốt số (Ngày ${currentDay} hàng tháng). Tiến hành tự động khởi tạo tháng mới & gửi chốt số...`);
      
      const activeContracts = await all(db, `
        SELECT c.id as contract_id, c.rent_amount, c.room_id, c.tenant_id,
               r.electricity_old as room_elec, r.water_old as room_water,
               r.room_number, t.name as tenant_name, t.phone as tenant_phone
        FROM rental_contracts c
        JOIN rooms r ON c.room_id = r.id
        JOIN tenants t ON c.tenant_id = t.id
        WHERE c.status = 'ACTIVE' AND r.status = 'OCCUPIED'
      `);

      let openedCount = 0;
      let sentCount = 0;

      for (const contract of activeContracts) {
        // Verify invoice not already created for this month
        let exists = await get(db, 'SELECT id, access_token FROM invoices WHERE room_id = ? AND billing_month = ?', [contract.room_id, currentMonth]);
        let token = exists ? exists.access_token : crypto.randomBytes(6).toString('hex');
        const invoiceId = `inv_${contract.room_id}_${currentMonth.replace('-', '')}`;

        if (!exists) {
          // Carry over previous readings
          const prevInvoice = await get(db, `
            SELECT electricity_new, water_new FROM invoices 
            WHERE room_id = ? AND status = 'PAID'
            ORDER BY billing_month DESC LIMIT 1
          `, [contract.room_id]);

          const elecOld = prevInvoice && prevInvoice.electricity_new ? prevInvoice.electricity_new : contract.room_elec;
          const waterOld = prevInvoice && prevInvoice.water_new ? prevInvoice.water_new : contract.room_water;
          const expiresAt = '2026-06-15';

          await run(db, `
            INSERT INTO invoices (
              id, room_id, tenant_id, contract_id, billing_month, access_token, token_expires_at,
              electricity_old, water_old, room_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, contract.room_id, contract.tenant_id, contract.contract_id, currentMonth, token, expiresAt,
            elecOld, waterOld, contract.rent_amount, 'PENDING_METER'
          ]);
          openedCount++;
        }

        // Send initial Zalo message
        const sig = generateSignature(token, currentMonth);
        const link = `${protocol}://${host}/qlynhatro/r/${token}?m=${currentMonth}&s=${sig}`;
        const messageText = `[TỰ ĐỘNG CHỐT SỐ] Kính gửi anh/chị ${contract.tenant_name} (Phòng ${contract.room_number}), đã đến kỳ chốt số điện nước tháng ${currentMonth}. Vui lòng nhấn vào liên kết sau để tự chụp ảnh và chốt số: ${link}`;
        
        const success = await sendZaloMessage(contract.tenant_phone, messageText);
        if (success) {
          sentCount++;
        }
      }
      console.log(`Hoàn thành ngày khởi tạo chốt số: Đã mở ${openedCount} hoá đơn mới, gửi chốt số thành công đến ${sentCount} khách thuê.`);
    } 
    
    else if (shouldRemind) {
      console.log(`Hôm nay nằm trong khung thời gian chốt số (Ngày ${currentDay} hàng tháng). Tự động nhắc nhở khách thuê chưa chốt số...`);
      
      const pendingInvoices = await all(db, `
        SELECT i.id as invoice_id, i.access_token,
               r.room_number, t.name as tenant_name, t.phone as tenant_phone
        FROM invoices i
        JOIN rooms r ON i.room_id = r.id
        JOIN tenants t ON i.tenant_id = t.id
        WHERE i.billing_month = ? AND i.status = 'PENDING_METER'
      `, [currentMonth]);

      let remindCount = 0;
      for (const inv of pendingInvoices) {
        const sig = generateSignature(inv.access_token, currentMonth);
        const link = `${protocol}://${host}/qlynhatro/r/${inv.access_token}?m=${currentMonth}&s=${sig}`;
        const messageText = `[TỰ ĐỘNG NHẮC NHỞ MÉT ĐIỆN NƯỚC] Kính gửi anh/chị ${inv.tenant_name} (Phòng ${inv.room_number}), vui lòng chụp ảnh và tự chốt số điện nước tháng ${currentMonth} trước thời hạn chốt sổ. Nhấp vào đây để thực hiện: ${link}`;
        
        const success = await sendZaloMessage(inv.tenant_phone, messageText);
        if (success) {
          remindCount++;
        }
      }
      console.log(`Hoàn thành ngày nhắc nhở: Đã nhắc nhở thành công ${remindCount} khách chưa chốt số.`);
    } 
    
    else {
      console.log(`Hôm nay là ngày ${currentDay} hàng tháng, nằm ngoài khoảng thời gian kích hoạt tự động (từ ${startDay} đến ${endDay}). Không cần thực hiện hành động.`);
    }

  } catch (err) {
    console.error('Lỗi chạy Cron tự động chốt số Zalo:', err.message);
  } finally {
    await close(db);
    console.log(`[${new Date().toISOString()}] Kết thúc tiến trình Cron.`);
  }
}

runCron();
