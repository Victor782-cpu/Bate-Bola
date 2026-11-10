import os
import sqlite3


class DatabaseConnection:

    @staticmethod
    def get_db_path() -> str:
        basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        return os.getenv("DATABASE_PATH", os.path.join(basedir, "batebola.db"))

    @classmethod
    def inicializar_schema(cls, conn):
        schema_sql = """
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            nome VARCHAR(100) NOT NULL, 
            email VARCHAR(120) NOT NULL UNIQUE, 
            senha_hash VARCHAR(255) NOT NULL DEFAULT '123456', 
            telefone VARCHAR(20), 
            cidade VARCHAR(100) DEFAULT 'Belo Horizonte - MG', 
            foto_perfil TEXT, 
            esportes_favoritos VARCHAR(255) DEFAULT 'Futebol, Basquete', 
            sobre TEXT DEFAULT 'Entusiasta de esportes coletivos.', 
            posicao_preferida VARCHAR(50) DEFAULT 'Jogador', 
            ativo BOOLEAN NOT NULL DEFAULT 1, 
            partidas_jogadas INTEGER NOT NULL DEFAULT 0, 
            presencas INTEGER NOT NULL DEFAULT 0, 
            faltas INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS partidas (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            titulo VARCHAR(100) NOT NULL DEFAULT 'Partida', 
            esporte VARCHAR(50) NOT NULL, 
            local VARCHAR(150) NOT NULL, 
            data_hora VARCHAR(50) NOT NULL, 
            horario VARCHAR(20), 
            vagas INTEGER NOT NULL DEFAULT 10, 
            usuario_id INTEGER, 
            ativo BOOLEAN NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS partida_participantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            partida_id INTEGER NOT NULL, 
            usuario_id INTEGER NOT NULL, 
            data_inscricao DATETIME DEFAULT CURRENT_TIMESTAMP, 
            CONSTRAINT uq_partida_participante UNIQUE (partida_id, usuario_id), 
            FOREIGN KEY(partida_id) REFERENCES partidas (id) ON DELETE CASCADE, 
            FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS mensagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            partida_id INTEGER NOT NULL, 
            usuario_id INTEGER, 
            nome_usuario VARCHAR(100) NOT NULL, 
            texto TEXT NOT NULL, 
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP, 
            FOREIGN KEY(partida_id) REFERENCES partidas (id) ON DELETE CASCADE, 
            FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS avaliacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            partida_id INTEGER NOT NULL, 
            avaliador_id INTEGER NOT NULL, 
            avaliado_id INTEGER NOT NULL, 
            nota INTEGER NOT NULL, 
            criada_em DATETIME DEFAULT CURRENT_TIMESTAMP, 
            CONSTRAINT uq_avaliacao_partida_jogadores UNIQUE (partida_id, avaliador_id, avaliado_id), 
            FOREIGN KEY(partida_id) REFERENCES partidas (id) ON DELETE CASCADE, 
            FOREIGN KEY(avaliador_id) REFERENCES usuarios (id) ON DELETE CASCADE, 
            FOREIGN KEY(avaliado_id) REFERENCES usuarios (id) ON DELETE CASCADE
        );
        """
        cursor = conn.cursor()
        cursor.executescript(schema_sql)
        conn.commit()

    @classmethod
    def get_connection(cls):
        use_mysql = os.getenv("USE_MYSQL", "False").lower() in ("true", "1")
        database_url = os.getenv("DATABASE_URL", "")

        if use_mysql or (database_url and database_url.startswith("mysql")):
            try:
                import pymysql
                import pymysql.cursors

                return pymysql.connect(
                    host=os.getenv("DB_HOST", "localhost"),
                    user=os.getenv("DB_USER", "root"),
                    password=os.getenv("DB_PASSWORD", ""),
                    database=os.getenv("DB_DATABASE", "batebola_db"),
                    port=int(os.getenv("DB_PORT", 3306)),
                    cursorclass=pymysql.cursors.DictCursor,
                    autocommit=False,
                )
            except Exception as e:
                print(f"[DatabaseConnection] Falha ao conectar ao MySQL ({e}). Usando SQLite como fallback.")


        db_path = cls.get_db_path()
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
        if not cursor.fetchone():
            cls.inicializar_schema(conn)

        return conn

    @classmethod
    def preparar_sql(cls, conn, sql: str) -> str:
        is_mysql = not isinstance(conn, sqlite3.Connection)
        if is_mysql:
            sql = sql.replace("datetime('now')", "CURRENT_TIMESTAMP")
            sql = sql.replace("?", "%s")
        return sql

    @classmethod
    def execute_query(cls, sql: str, params: tuple = ()) -> list:
        conn = cls.get_connection()
        try:
            cursor = conn.cursor()
            sql_tratado = cls.preparar_sql(conn, sql)
            cursor.execute(sql_tratado, params)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    @classmethod
    def execute_one(cls, sql: str, params: tuple = ()) -> dict | None:
        conn = cls.get_connection()
        try:
            cursor = conn.cursor()
            sql_tratado = cls.preparar_sql(conn, sql)
            cursor.execute(sql_tratado, params)
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @classmethod
    def execute_non_query(cls, sql: str, params: tuple = ()) -> int:
        conn = cls.get_connection()
        try:
            cursor = conn.cursor()
            sql_tratado = cls.preparar_sql(conn, sql)
            cursor.execute(sql_tratado, params)
            conn.commit()
            return cursor.lastrowid if cursor.lastrowid else cursor.rowcount
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
