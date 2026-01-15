import { randomUUID } from 'crypto';
export class ProjectRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(data) {
        const now = new Date().toISOString();
        const project = {
            id: randomUUID(),
            ...data,
            createdAt: now,
            updatedAt: now,
        };
        const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, repository_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(project.id, project.name, project.description, project.repositoryUrl, project.createdAt, project.updatedAt);
        return project;
    }
    findAll() {
        const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            repositoryUrl: row.repository_url,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            repositoryUrl: row.repository_url,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    update(id, data) {
        const existing = this.findById(id);
        if (!existing)
            return null;
        const updatedAt = new Date().toISOString();
        const updates = [];
        const values = [];
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            values.push(data.description);
        }
        if (data.repositoryUrl !== undefined) {
            updates.push('repository_url = ?');
            values.push(data.repositoryUrl);
        }
        if (updates.length === 0)
            return existing;
        updates.push('updated_at = ?');
        values.push(updatedAt);
        values.push(id);
        const stmt = this.db.prepare(`
      UPDATE projects SET ${updates.join(', ')} WHERE id = ?
    `);
        stmt.run(...values);
        return this.findById(id);
    }
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
//# sourceMappingURL=ProjectRepository.js.map