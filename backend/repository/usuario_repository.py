from database.connection import DatabaseConnection


class UsuarioRepository:

    def __init__(self):
        self.db = DatabaseConnection

    def buscar_por_id(self, usuario_id: int) -> dict | None:
        sql = """
            SELECT id, nome, email, senha_hash, telefone, cidade,
                   foto_perfil, esportes_favoritos, sobre, posicao_preferida,
                   ativo, partidas_jogadas, presencas, faltas
            FROM usuarios
            WHERE id = ?
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (usuario_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def buscar_por_email(self, email: str) -> dict | None:
        sql = """
            SELECT id, nome, email, senha_hash, telefone, cidade,
                   foto_perfil, esportes_favoritos, sobre, posicao_preferida,
                   ativo, partidas_jogadas, presencas, faltas
            FROM usuarios
            WHERE LOWER(email) = LOWER(?)
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (email.strip(),))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def autenticar(self, email: str, senha: str) -> dict | None:
        sql = """
            SELECT id, nome, email, senha_hash, telefone, cidade,
                   foto_perfil, esportes_favoritos, sobre, posicao_preferida,
                   ativo, partidas_jogadas, presencas, faltas
            FROM usuarios
            WHERE LOWER(email) = LOWER(?) AND senha_hash = ?
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (email.strip(), senha))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def criar(self, dados: dict) -> dict:
        sql = """
            INSERT INTO usuarios (
                nome, email, senha_hash, telefone, cidade,
                foto_perfil, esportes_favoritos, sobre, posicao_preferida,
                ativo, partidas_jogadas, presencas, faltas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            dados.get("nome", "Novo Jogador"),
            dados.get("email").strip(),
            dados.get("senha_hash") or dados.get("senha", "123456"),
            dados.get("telefone", ""),
            dados.get("cidade", "Belo Horizonte - MG"),
            dados.get("foto_perfil", ""),
            dados.get("esportes_favoritos", "Futebol, Basquete"),
            dados.get("sobre", "Entusiasta de esportes coletivos."),
            dados.get("posicao_preferida", "Jogador"),
            1 if dados.get("ativo", True) else 0,
            int(dados.get("partidas_jogadas", 0)),
            int(dados.get("presencas", 0)),
            int(dados.get("faltas", 0))
        )
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), params)
            conn.commit()
            novo_id = cursor.lastrowid
            return self.buscar_por_id(novo_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def atualizar(self, usuario_id: int, dados: dict) -> dict | None:
        campos_permitidos = [
            "nome", "telefone", "cidade", "foto_perfil",
            "esportes_favoritos", "sobre", "posicao_preferida",
            "ativo", "partidas_jogadas", "presencas", "faltas"
        ]
        set_clauses = []
        params = []

        for campo in campos_permitidos:
            if campo in dados:
                set_clauses.append(f"{campo} = ?")
                params.append(dados[campo])

        if not set_clauses:
            return self.buscar_por_id(usuario_id)

        params.append(usuario_id)
        sql = f"UPDATE usuarios SET {', '.join(set_clauses)} WHERE id = ?"

        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), tuple(params))
            conn.commit()
            return self.buscar_por_id(usuario_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def deletar(self, usuario_id: int) -> bool:
        sql = "DELETE FROM usuarios WHERE id = ?"
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (usuario_id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def incrementar_partidas(self, usuario_id: int, delta: int = 1) -> None:
        sql = "UPDATE usuarios SET partidas_jogadas = MAX(0, COALESCE(partidas_jogadas, 0) + ?) WHERE id = ?"
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (delta, usuario_id))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def obter_avaliacoes(self, usuario_id: int) -> list:
        sql = """
            SELECT a.id, a.partida_id, a.avaliador_id, a.avaliado_id, a.nota, a.criada_em,
                   COALESCE(u.nome, 'Jogador') AS avaliador_nome
            FROM avaliacoes a
            LEFT JOIN usuarios u ON a.avaliador_id = u.id
            WHERE a.avaliado_id = ?
            ORDER BY a.criada_em DESC
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (usuario_id,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()
