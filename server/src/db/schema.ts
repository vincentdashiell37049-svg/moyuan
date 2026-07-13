import Database from 'better-sqlite3';

/**
 * 初始化数据库表结构
 * 使用 better-sqlite3 的 exec 方法直接执行 SQL 建表
 */
export function initSchema(db: Database.Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- ========================================
    -- 史料表
    -- ========================================
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      original_text TEXT,
      converted_text TEXT,
      punctuated_text TEXT,
      final_text TEXT,
      ocr_confidence REAL DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'processing', 'reviewed', 'published')),
      source_db TEXT,
      source_book TEXT,
      source_author TEXT,
      source_version TEXT,
      source_volume TEXT,
      credibility TEXT DEFAULT 'secondary' CHECK(credibility IN ('primary', 'secondary', 'tertiary', 'reference')),
      file_path TEXT,
      file_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ========================================
    -- 标签表
    -- ========================================
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#78716c',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ========================================
    -- 史料-标签关联表
    -- ========================================
    CREATE TABLE IF NOT EXISTS material_tags (
      material_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (material_id, tag_id),
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    -- ========================================
    -- 实体表（人物/地点/官职/事件/时间/机构）
    -- ========================================
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('person', 'place', 'official_title', 'event', 'time', 'institution')),
      description TEXT,
      aliases TEXT,
      metadata TEXT,
      confidence REAL DEFAULT 0.8,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ========================================
    -- 实体关系表
    -- ========================================
    CREATE TABLE IF NOT EXISTS relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      confidence REAL DEFAULT 0.8,
      source_material_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (source_material_id) REFERENCES materials(id) ON DELETE SET NULL
    );

    -- ========================================
    -- 史料-实体关联表
    -- ========================================
    CREATE TABLE IF NOT EXISTS material_entities (
      material_id INTEGER NOT NULL,
      entity_id INTEGER NOT NULL,
      mention_text TEXT,
      PRIMARY KEY (material_id, entity_id),
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    -- ========================================
    -- 文档表
    -- ========================================
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ========================================
    -- 文档引用表
    -- ========================================
    CREATE TABLE IF NOT EXISTS document_citations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      citation_mark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    );

    -- ========================================
    -- OCR 任务表
    -- ========================================
    CREATE TABLE IF NOT EXISTS ocr_tasks (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      files TEXT,
      current_stage TEXT,
      progress REAL DEFAULT 0,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT
    );

    -- ========================================
    -- FTS5 全文检索虚拟表
    -- ========================================
    CREATE VIRTUAL TABLE IF NOT EXISTS materials_fts USING fts5(
      title,
      original_text,
      converted_text,
      punctuated_text,
      final_text,
      source_book,
      source_author,
      content='materials',
      content_rowid='id',
      tokenize='unicode61'
    );

    -- ========================================
    -- FTS5 同步触发器：插入后同步
    -- ========================================
    CREATE TRIGGER IF NOT EXISTS materials_fts_insert AFTER INSERT ON materials BEGIN
      INSERT INTO materials_fts(rowid, title, original_text, converted_text, punctuated_text, final_text, source_book, source_author)
      VALUES (
        new.id,
        new.title,
        new.original_text,
        new.converted_text,
        new.punctuated_text,
        new.final_text,
        new.source_book,
        new.source_author
      );
    END;

    -- ========================================
    -- FTS5 同步触发器：更新后同步
    -- ========================================
    CREATE TRIGGER IF NOT EXISTS materials_fts_update AFTER UPDATE ON materials BEGIN
      INSERT INTO materials_fts(materials_fts, rowid, title, original_text, converted_text, punctuated_text, final_text, source_book, source_author)
      VALUES (
        'delete',
        new.id,
        new.title,
        new.original_text,
        new.converted_text,
        new.punctuated_text,
        new.final_text,
        new.source_book,
        new.source_author
      );
      INSERT INTO materials_fts(rowid, title, original_text, converted_text, punctuated_text, final_text, source_book, source_author)
      VALUES (
        new.id,
        new.title,
        new.original_text,
        new.converted_text,
        new.punctuated_text,
        new.final_text,
        new.source_book,
        new.source_author
      );
    END;

    -- ========================================
    -- FTS5 同步触发器：删除后同步
    -- ========================================
    CREATE TRIGGER IF NOT EXISTS materials_fts_delete AFTER DELETE ON materials BEGIN
      INSERT INTO materials_fts(materials_fts, rowid, title, original_text, converted_text, punctuated_text, final_text, source_book, source_author)
      VALUES (
        'delete',
        old.id,
        old.title,
        old.original_text,
        old.converted_text,
        old.punctuated_text,
        old.final_text,
        old.source_book,
        old.source_author
      );
    END;

    -- ========================================
    -- 索引
    -- ========================================
    CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
    CREATE INDEX IF NOT EXISTS idx_materials_source ON materials(source_book, source_author);
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
    CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
    CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
    CREATE INDEX IF NOT EXISTS idx_document_citations_doc ON document_citations(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_citations_mat ON document_citations(material_id);
    CREATE INDEX IF NOT EXISTS idx_ocr_tasks_status ON ocr_tasks(status);
  `);
}