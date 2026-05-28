const { createDatabase, run, close } = require('./sqlite_helper');
const path = require('path');

async function main() {
    const dbPath = path.join(__dirname, '../qlynhatro.db');
    const db = await createDatabase(dbPath);
    console.log('Cleaning local live database for open-source fresh start...');
    
    // Set all rooms to VACANT state
    await run(db, "UPDATE rooms SET status = 'VACANT'");
    
    // Clear active contracts or set them to ended
    await run(db, "DELETE FROM rental_contracts");
    
    // Clear all invoices and payments to start completely fresh
    await run(db, "DELETE FROM invoices");
    await run(db, "DELETE FROM invoice_events");
    await run(db, "DELETE FROM payments");
    
    await close(db);
    console.log('Cleaned successfully!');
}

main().catch(console.error);
