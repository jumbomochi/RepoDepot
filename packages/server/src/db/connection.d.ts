import Database from 'better-sqlite3';
export declare class DatabaseConnection {
    private static instance;
    static getConnection(dbPath?: string): Database.Database;
    private static initializeSchema;
    static close(): void;
}
export declare const getDb: (dbPath?: string) => Database.Database;
