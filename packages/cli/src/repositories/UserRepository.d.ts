import type Database from 'better-sqlite3';
import { User } from '@repodepot/shared';
export declare class UserRepository {
    private db;
    constructor(db: Database.Database);
    create(data: Omit<User, 'id' | 'createdAt'>): User;
    findAll(): User[];
    findById(id: string): User | null;
    findByUsername(username: string): User | null;
    findByEmail(email: string): User | null;
    update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): User | null;
    delete(id: string): boolean;
}
