import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class DatabaseConnection {
    static instance = null;
    static getConnection(dbPath = join(process.cwd(), 'repodepot.db')) {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new Database(dbPath);
            DatabaseConnection.instance.pragma('foreign_keys = ON');
            DatabaseConnection.initializeSchema();
        }
        return DatabaseConnection.instance;
    }
    static initializeSchema() {
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        // Execute each statement separately
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        for (const statement of statements) {
            DatabaseConnection.instance.exec(statement);
        }
    }
    static close() {
        if (DatabaseConnection.instance) {
            DatabaseConnection.instance.close();
            DatabaseConnection.instance = null;
        }
    }
}
export const getDb = (dbPath) => DatabaseConnection.getConnection(dbPath);
//# sourceMappingURL=connection.js.map