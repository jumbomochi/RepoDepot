import type Database from 'better-sqlite3';
import { Issue, IssueStatus, IssuePriority } from '@repodepot/shared';
export declare class IssueRepository {
    private db;
    constructor(db: Database.Database);
    create(data: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>): Issue;
    findAll(filters?: {
        projectId?: string;
        status?: IssueStatus;
        assigneeId?: string;
        priority?: IssuePriority;
    }): Issue[];
    findById(id: string): Issue | null;
    findByProject(projectId: string): Issue[];
    update(id: string, data: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt' | 'projectId' | 'reporterId'>>): Issue | null;
    delete(id: string): boolean;
    private mapRowToIssue;
}
