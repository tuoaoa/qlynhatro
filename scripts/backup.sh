#!/bin/bash
# SQLite auto-backup script for qlynhatro
# Runs daily to create structured snapshots of database file.

DB_DIR="/Users/tuoaoa/Tuoaoa/devflow/qlynhatro"
BACKUP_DIR="$DB_DIR/backups"

mkdir -p "$BACKUP_DIR"

DATE=$(date +%F-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/qlynhatro-backup-$DATE.db"
ZIP_FILE="$BACKUP_DIR/qlynhatro-backup-$DATE.zip"

echo "Starting SQLite database backup..."
sqlite3 "$DB_DIR/qlynhatro.db" ".backup '$BACKUP_FILE'"

if [ -f "$BACKUP_FILE" ]; then
    echo "Compression backup db..."
    zip -j "$ZIP_FILE" "$BACKUP_FILE"
    rm "$BACKUP_FILE"
    echo "Backup completed successfully: $ZIP_FILE"
    
    # Auto-purge backups older than 7 days
    find "$BACKUP_DIR" -name "qlynhatro-backup-*.zip" -mtime +7 -exec rm {} \;
    echo "Purged backups older than 7 days."
else
    echo "Error: SQLite backup failed!"
    exit 1
fi
