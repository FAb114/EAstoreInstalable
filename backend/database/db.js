const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isElectron = !!process.versions.electron;

let userDataPath;

// Detecta si estamos en Electron y usa app.getPath, si no, usa una ruta manual
if (isElectron) {
  const { app } = require('electron');
  userDataPath = app.getPath('userData');
} else {
  userDataPath = path.join(__dirname, '..', '..', 'userData');
}

const dbDirectory = path.join(userDataPath, 'database');

if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

class DatabaseService {
  constructor() {
    this.dbPath = path.join(dbDirectory, 'eastore.db');
    this.db = new Database(this.dbPath);
    this.connected = true;
    this.createTables();
    this.checkForUpdates();
  }

  createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        dni TEXT,
        cuit TEXT,
        direccion TEXT,
        email TEXT,
        telefono TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        precio REAL NOT NULL,
        costo REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 5,
        iva REAL DEFAULT 21.0,
        categoria TEXT,
        marca TEXT,
        activo INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS movimientos_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        motivo TEXT NOT NULL,
        stock_anterior INTEGER NOT NULL,
        stock_nuevo INTEGER NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        usuario TEXT,
        sincronizado INTEGER DEFAULT 0,
        FOREIGN KEY (producto_id) REFERENCES productos (id)
      )`,
      `CREATE TABLE IF NOT EXISTS facturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT UNIQUE,
        tipo TEXT NOT NULL,
        cliente_id INTEGER,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total REAL NOT NULL,
        estado TEXT DEFAULT 'pendiente',
        forma_pago TEXT,
        cae TEXT,
        vencimiento_cae TEXT,
        sincronizado INTEGER DEFAULT 0,
        enviado_afip INTEGER DEFAULT 0,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
      )`,
      `CREATE TABLE IF NOT EXISTS factura_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER NOT NULL,
        producto_id INTEGER,
        descripcion TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_unitario REAL NOT NULL,
        subtotal REAL NOT NULL,
        iva REAL,
        FOREIGN KEY (factura_id) REFERENCES facturas (id),
        FOREIGN KEY (producto_id) REFERENCES productos (id)
      )`,
      `CREATE TABLE IF NOT EXISTS pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER,
        monto REAL NOT NULL,
        metodo TEXT NOT NULL,
        referencia TEXT,
        estado TEXT DEFAULT 'pendiente',
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sincronizado INTEGER DEFAULT 0,
        FOREIGN KEY (factura_id) REFERENCES facturas (id)
      )`,
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operacion TEXT NOT NULL,
        tabla TEXT NOT NULL,
        datos TEXT NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        intentos INTEGER DEFAULT 0
      )`
    ];

    const transaction = this.db.transaction(() => {
      for (const query of queries) {
        this.db.prepare(query).run();
      }
    });

    try {
      transaction();
      console.log('✅ Tablas creadas correctamente');
    } catch (err) {
      console.error('❌ Error al crear tablas:', err);
      throw err;
    }
  }

  checkForUpdates() {
    try {
      const tablasProductos = this.db.prepare("PRAGMA table_info(productos)").all();

      const hasStockMinimo = tablasProductos.some(column => column.name === 'stock_minimo');
      if (!hasStockMinimo) {
        this.db.prepare("ALTER TABLE productos ADD COLUMN stock_minimo INTEGER DEFAULT 5").run();
        console.log('🛠 Columna stock_minimo añadida a productos');
      }

      const hasMarca = tablasProductos.some(column => column.name === 'marca');
      if (!hasMarca) {
        this.db.prepare("ALTER TABLE productos ADD COLUMN marca TEXT").run();
        console.log('🛠 Columna marca añadida a productos');
      }

      const hasActivo = tablasProductos.some(column => column.name === 'activo');
      if (!hasActivo) {
        this.db.prepare("ALTER TABLE productos ADD COLUMN activo INTEGER DEFAULT 1").run();
        console.log('🛠 Columna activo añadida a productos');
      }

      const tablas = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const hasMovimientosStock = tablas.some(table => table.name === 'movimientos_stock');

      if (!hasMovimientosStock) {
        this.db.prepare(`
          CREATE TABLE movimientos_stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            motivo TEXT NOT NULL,
            stock_anterior INTEGER NOT NULL,
            stock_nuevo INTEGER NOT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            usuario TEXT,
            sincronizado INTEGER DEFAULT 0,
            FOREIGN KEY (producto_id) REFERENCES productos (id)
          )
        `).run();
        console.log('🛠 Tabla movimientos_stock creada');
      }
    } catch (err) {
      console.error('❌ Error al actualizar estructura de la base de datos:', err);
    }
  }

  get(table, id) {
    return this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  }

  getAll(table, condition = null, params = []) {
    let query = `SELECT * FROM ${table}`;
    if (condition) query += ` WHERE ${condition}`;
    return this.db.prepare(query).all(...params);
  }

  insert(table, data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(k => `@${k}`).join(',');
    const stmt = this.db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`);
    const result = stmt.run(data);
    return { id: result.lastInsertRowid, ...data };
  }

  update(table, id, data) {
    const sets = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    const stmt = this.db.prepare(`UPDATE ${table} SET ${sets} WHERE id = @id`);
    const result = stmt.run({ ...data, id });
    return { changes: result.changes, id };
  }

  delete(table, id) {
    const stmt = this.db.prepare(`DELETE FROM ${table} WHERE id = ?`);
    const result = stmt.run(id);
    return { changes: result.changes };
  }

  query(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  queryOne(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  run(sql, params = {}) {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(params);
    return { lastID: result.lastInsertRowid, changes: result.changes };
  }

  close() {
    this.db.close();
    this.connected = false;
    console.log('🔌 Conexión a la base de datos cerrada');
    return true;
  }
}

module.exports = DatabaseService;
