import type Database from 'better-sqlite3';
import { Project } from '@repodepot/shared';
export declare class ProjectRepository {
    private db;
    constructor(db: Database.Database);
    create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project;
    findAll(): Project[];
    findById(id: string): Project | null;
    update(id: string, data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Project | null;
    delete(id: string): boolean;
}
