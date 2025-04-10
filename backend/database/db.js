const path = require('path');
const Database = require('better-sqlite3');

class DatabaseService {
  constructor() {
    const dbPath = path.join(__dirname, 'ea_store.db');
    this.db = new Database(dbPath);
    this.createTables();
  }

  // 🔧 NUEVO: sanitizador para asegurar compatibilidad
  sanitizeValues(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (value instanceof Date) return [key, value.toISOString()];
        if (typeof value === 'boolean') return [key, value ? 1 : 0];
        if (value === undefined) return [key, null];
        return [key, value];
      })
    );
  }

  insert(table, values) {
    const cleanValues = this.sanitizeValues(values);
    const keys = Object.keys(cleanValues);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(Object.values(cleanValues));
    return { id: result.lastInsertRowid };
  }

  update(table, values, where) {
    const cleanValues = this.sanitizeValues(values);
    const cleanWhere = this.sanitizeValues(where);
    const setClause = Object.keys(cleanValues).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(cleanWhere).map(key => `${key} = ?`).join(' AND ');
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const stmt = this.db.prepare(sql);
    stmt.run([...Object.values(cleanValues), ...Object.values(cleanWhere)]);
  }

  query(sql, params = []) {
    return this.db.prepare(sql).all(params);
  }

  queryOne(sql, params = []) {
    return this.db.prepare(sql).get(params);
  }

  get(table, id) {
    return this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  }

  delete(table, id) {
    return this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  }

  createTables() {
    // Asegurate que tus tablas existen. Podés expandir esto:
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT,
        nombre TEXT,
        descripcion TEXT,
        precio REAL,
        costo REAL,
        iva INTEGER,
        categoria TEXT,
        stock INTEGER,
        stock_minimo INTEGER,
        marca TEXT,
        activo INTEGER,
        created_at TEXT,
        updated_at TEXT
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS movimientos_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER,
        cantidad REAL,
        tipo TEXT,
        motivo TEXT,
        stock_anterior INTEGER,
        stock_nuevo INTEGER,
        fecha TEXT,
        usuario TEXT,
        sincronizado INTEGER
      )
    `).run();
  }
}

module.exports = DatabaseService;
