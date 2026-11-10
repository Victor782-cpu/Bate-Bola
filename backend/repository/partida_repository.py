from database.connection import DatabaseConnection


class PartidaRepository:

    def __init__(self):
        self.db = DatabaseConnection

    def _formatar_partida(self, row: dict | None) -> dict | None:
        if not row:
            return None
        partida = dict(row)
        partida["ativo"] = bool(partida.get("ativo", 1))
        partida["participantes"] = self.obter_participantes(partida["id"])
        return partida

    def listar_todas(self) -> list:
        sql = """
            SELECT id, titulo, esporte, local, data_hora, horario, vagas, usuario_id, ativo
            FROM partidas
            WHERE ativo = 1
            ORDER BY id ASC
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql))
            rows = cursor.fetchall()
            return [self._formatar_partida(dict(r)) for r in rows]
        finally:
            conn.close()

    def buscar_por_id(self, partida_id: int) -> dict | None:
        sql = """
            SELECT id, titulo, esporte, local, data_hora, horario, vagas, usuario_id, ativo
            FROM partidas
            WHERE id = ?
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id,))
            row = cursor.fetchone()
            return self._formatar_partida(dict(row)) if row else None
        finally:
            conn.close()

    def buscar_por_esporte(self, esporte: str) -> list:
        if not esporte or esporte.lower() == "todos":
            return self.listar_todas()

        sql = """
            SELECT id, titulo, esporte, local, data_hora, horario, vagas, usuario_id, ativo
            FROM partidas
            WHERE ativo = 1 AND LOWER(esporte) = LOWER(?)
            ORDER BY id ASC
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (esporte.strip(),))
            rows = cursor.fetchall()
            return [self._formatar_partida(dict(r)) for r in rows]
        finally:
            conn.close()

    def criar(self, dados: dict) -> dict:
        sql = """
            INSERT INTO partidas (
                titulo, esporte, local, data_hora, horario, vagas, usuario_id, ativo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            dados.get("titulo") or f"Partida de {dados.get('esporte', 'Futebol')}",
            dados.get("esporte"),
            dados.get("local"),
            dados.get("data_hora"),
            dados.get("horario", ""),
            int(dados.get("vagas", 10)),
            dados.get("usuario_id"),
            1 if dados.get("ativo", True) else 0
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

    def atualizar(self, partida_id: int, dados: dict) -> dict | None:
        campos_permitidos = ["titulo", "esporte", "local", "data_hora", "horario", "vagas", "ativo", "usuario_id"]
        set_clauses = []
        params = []

        for campo in campos_permitidos:
            if campo in dados:
                set_clauses.append(f"{campo} = ?")
                valor = dados[campo]
                if campo == "ativo" and isinstance(valor, bool):
                    valor = 1 if valor else 0
                params.append(valor)

        if not set_clauses:
            return self.buscar_por_id(partida_id)

        params.append(partida_id)
        sql = f"UPDATE partidas SET {', '.join(set_clauses)} WHERE id = ?"

        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), tuple(params))
            conn.commit()
            return self.buscar_por_id(partida_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def deletar(self, partida_id: int) -> bool:
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, "DELETE FROM avaliacoes WHERE partida_id = ?"), (partida_id,))
            cursor.execute(self.db.preparar_sql(conn, "DELETE FROM mensagens WHERE partida_id = ?"), (partida_id,))
            cursor.execute(self.db.preparar_sql(conn, "DELETE FROM partida_participantes WHERE partida_id = ?"), (partida_id,))
            cursor.execute(self.db.preparar_sql(conn, "DELETE FROM partidas WHERE id = ?"), (partida_id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def obter_participantes(self, partida_id: int) -> list:
        sql = """
            SELECT u.id, u.nome, COALESCE(u.foto_perfil, '') AS foto_perfil,
                   COALESCE(u.posicao_preferida, '') AS posicao_preferida
            FROM partida_participantes pp
            INNER JOIN usuarios u ON pp.usuario_id = u.id
            WHERE pp.partida_id = ?
            ORDER BY pp.id ASC
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def verificar_participacao(self, partida_id: int, usuario_id: int) -> bool:
        sql = "SELECT id FROM partida_participantes WHERE partida_id = ? AND usuario_id = ?"
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id, usuario_id))
            return cursor.fetchone() is not None
        finally:
            conn.close()

    def adicionar_participante(self, partida_id: int, usuario_id: int) -> bool:
        sql = """
            INSERT INTO partida_participantes (partida_id, usuario_id, data_inscricao)
            VALUES (?, ?, datetime('now'))
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id, usuario_id))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def remover_participante(self, partida_id: int, usuario_id: int) -> bool:
        sql = "DELETE FROM partida_participantes WHERE partida_id = ? AND usuario_id = ?"
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id, usuario_id))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def verificar_avaliacao(self, partida_id: int, avaliador_id: int, avaliado_id: int) -> bool:
        sql = """
            SELECT id FROM avaliacoes
            WHERE partida_id = ? AND avaliador_id = ? AND avaliado_id = ?
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id, avaliador_id, avaliado_id))
            return cursor.fetchone() is not None
        finally:
            conn.close()

    def salvar_avaliacao(self, partida_id: int, avaliador_id: int, avaliado_id: int, nota: int) -> bool:
        sql = """
            INSERT INTO avaliacoes (partida_id, avaliador_id, avaliado_id, nota, criada_em)
            VALUES (?, ?, ?, ?, datetime('now'))
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id, avaliador_id, avaliado_id, nota))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
