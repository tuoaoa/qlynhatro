const { createDatabase, run, close } = require('./sqlite_helper');
const path = require('path');
const fs = require('fs');

async function init() {
    const dbPath = path.join(__dirname, '../qlynhatro.db');
    if (fs.existsSync(dbPath)) {
        console.log('Database already exists. Deleting to re-initialize...');
        fs.unlinkSync(dbPath);
    }

    const db = await createDatabase(dbPath);
    console.log('Opened SQLite database at:', dbPath);

    // 1. Create tables
    console.log('Creating tables...');

    // Properties
    await run(db, `
        CREATE TABLE IF NOT EXISTS properties (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            address TEXT,
            bank_name TEXT,
            bank_account TEXT,
            bank_owner TEXT,
            electricity_price REAL DEFAULT 3500,
            water_price REAL DEFAULT 15000,
            internet_price REAL DEFAULT 100000,
            service_price REAL DEFAULT 50000,
            garbage_price REAL DEFAULT 0,
            meter_collect_start_day INTEGER DEFAULT 25,
            meter_collect_end_day INTEGER DEFAULT 30,
            auto_send_zalo INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Areas
    await run(db, `
        CREATE TABLE IF NOT EXISTS areas (
            id TEXT PRIMARY KEY,
            property_id TEXT REFERENCES properties(id),
            name TEXT NOT NULL
        )
    `);

    // Rooms
    await run(db, `
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            property_id TEXT REFERENCES properties(id),
            area_id TEXT REFERENCES areas(id),
            room_number TEXT NOT NULL,
            price REAL NOT NULL,
            status TEXT DEFAULT 'VACANT', -- VACANT, OCCUPIED, MAINTENANCE
            notes TEXT,
            electricity_old REAL DEFAULT 0,
            water_old REAL DEFAULT 0,
            override_electricity_price REAL,
            override_water_price REAL,
            override_internet_price REAL,
            override_service_price REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tenants
    await run(db, `
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            cccd TEXT,
            cccd_front_url TEXT,
            cccd_back_url TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Rental Contracts
    await run(db, `
        CREATE TABLE IF NOT EXISTS rental_contracts (
            id TEXT PRIMARY KEY,
            room_id TEXT REFERENCES rooms(id),
            tenant_id TEXT REFERENCES tenants(id),
            co_tenants TEXT, -- JSON string list of co-residents
            equipment_notes TEXT, -- Handover notes
            evidence_urls TEXT, -- Handover photos/videos
            check_in_date TEXT NOT NULL,
            rent_amount REAL NOT NULL,
            deposit_amount REAL DEFAULT 0,
            billing_start_date TEXT NOT NULL,
            status TEXT DEFAULT 'ACTIVE', -- ACTIVE, ENDED
            move_out_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Invoices
    await run(db, `
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            room_id TEXT REFERENCES rooms(id),
            tenant_id TEXT REFERENCES tenants(id),
            contract_id TEXT REFERENCES rental_contracts(id),
            billing_month TEXT NOT NULL,
            access_token TEXT UNIQUE NOT NULL,
            token_expires_at TEXT NOT NULL,
            
            electricity_old REAL NOT NULL,
            electricity_new REAL,
            water_old REAL NOT NULL,
            water_new REAL,
            meter_photo_url TEXT,
            
            room_amount REAL NOT NULL,
            electricity_amount REAL DEFAULT 0,
            water_amount REAL DEFAULT 0,
            internet_amount REAL DEFAULT 0,
            service_amount REAL DEFAULT 0,
            garbage_amount REAL DEFAULT 0,
            total_amount REAL DEFAULT 0,
            
            status TEXT DEFAULT 'PENDING_METER', -- PENDING_METER, PENDING_CONFIRMATION, PENDING_PAYMENT, PAID
            anomaly_status TEXT DEFAULT 'NONE',
            resident_count INTEGER DEFAULT 1,
            paid_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Invoice Events (Auditing)
    await run(db, `
        CREATE TABLE IF NOT EXISTS invoice_events (
            id TEXT PRIMARY KEY,
            invoice_id TEXT REFERENCES invoices(id),
            event_type TEXT NOT NULL,
            event_details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Payments
    await run(db, `
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            invoice_id TEXT REFERENCES invoices(id),
            amount REAL NOT NULL,
            paid_at TEXT NOT NULL,
            payment_method TEXT DEFAULT 'BANK_TRANSFER',
            note TEXT
        )
    `);

    // 2. Populate mock data
    console.log('Populating mock data...');
    
    // Properties
    const propId = 'prop_anbinh';
    await run(db, `
        INSERT INTO properties (id, name, address, bank_name, bank_account, bank_owner, electricity_price, water_price, internet_price, service_price, garbage_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        propId, 'Nhà Trọ An Bình', '123 Đường Số 5, Linh Trung, Thủ Đức, TPHCM', 'Vietcombank', '0071001234567', 'Nguyen Van A', 3500, 15000, 100000, 50000, 10000
    ]);

    // Areas
    await run(db, 'INSERT INTO areas (id, property_id, name) VALUES (?, ?, ?)', ['area_day_a', propId, 'Dãy A']);
    await run(db, 'INSERT INTO areas (id, property_id, name) VALUES (?, ?, ?)', ['area_tang_1', propId, 'Tầng 1']);
    await run(db, 'INSERT INTO areas (id, property_id, name) VALUES (?, ?, ?)', ['area_tang_2', propId, 'Tầng 2']);

    // Rooms (A101, A102, A203) - Vacant by default
    await run(db, 'INSERT INTO rooms (id, property_id, area_id, room_number, price, status, electricity_old, water_old) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        'room_101', propId, 'area_day_a', 'P101', 2500000, 'VACANT', 1120, 208
    ]);
    await run(db, 'INSERT INTO rooms (id, property_id, area_id, room_number, price, status, electricity_old, water_old) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        'room_102', propId, 'area_tang_1', 'P201', 2000000, 'VACANT', 1610, 306
    ]);
    await run(db, 'INSERT INTO rooms (id, property_id, area_id, room_number, price, status, electricity_old, water_old) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        'room_203', propId, 'area_tang_2', 'P203', 3000000, 'VACANT', 2150, 410
    ]);

    // Tenants
    await run(db, 'INSERT INTO tenants (id, name, phone, cccd, notes) VALUES (?, ?, ?, ?, ?)', [
        'tenant_101', 'Lê Thị Huyền Trâm', '0785657688', '079096001234', 'Sinh viên đại học'
    ]);
    await run(db, 'INSERT INTO tenants (id, name, phone, cccd, notes) VALUES (?, ?, ?, ?, ?)', [
        'tenant_102', 'Nhã yên', '0967187263', '079096005678', 'Nhân viên văn phòng'
    ]);
    await run(db, 'INSERT INTO tenants (id, name, phone, cccd, notes) VALUES (?, ?, ?, ?, ?)', [
        'tenant_203', 'Lê Văn C', '0909090909', '079096009999', 'Gia đình trẻ'
    ]);

    await close(db);
    console.log('Database initialization completed successfully!');
}

init().catch(console.error);
