from datetime import datetime
from database.connection import DatabaseConnection


class ChatRepository:

    def __init__(self):
        self.db = DatabaseConnection

    def _formatar_mensagem(self, row: dict | None) -> dict | None:
        if not row:
            return None
        msg = dict(row)
        criado_em = msg.get("criado_em")
        hora = ""
        criado_iso = ""

        if criado_em:
            if isinstance(criado_em, str):
                try:
                    dt = datetime.fromisoformat(criado_em)
                    hora = dt.strftime("%H:%M")
                    criado_iso = dt.isoformat()
                except Exception:
                    hora = criado_em[:5] if len(criado_em) >= 5 else ""
                    criado_iso = criado_em
            elif isinstance(criado_em, datetime):
                hora = criado_em.strftime("%H:%M")
                criado_iso = criado_em.isoformat()

        return {
            "id": msg["id"],
            "partida_id": msg["partida_id"],
            "usuario_id": msg["usuario_id"],
            "usuario": msg["nome_usuario"],
            "foto_perfil": msg.get("foto_perfil") or "",
            "texto": msg["texto"],
            "hora": hora,
            "criado_em": criado_iso
        }

    def listar_mensagens(self, partida_id: int) -> list:
        sql = """
            SELECT m.id, m.partida_id, m.usuario_id, m.nome_usuario, m.texto, m.criado_em,
                   COALESCE(u.foto_perfil, '') AS foto_perfil
            FROM mensagens m
            LEFT JOIN usuarios u ON m.usuario_id = u.id
            WHERE m.partida_id = ?
            ORDER BY m.id ASC
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id,))
            rows = cursor.fetchall()
            return [self._formatar_mensagem(dict(r)) for r in rows]
        finally:
            conn.close()

    def salvar_mensagem(self, partida_id: int, usuario_id: int | None, nome_usuario: str, texto: str) -> dict:
        sql = """
            INSERT INTO mensagens (partida_id, usuario_id, nome_usuario, texto, criado_em)
            VALUES (?, ?, ?, ?, datetime('now'))
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (partida_id, usuario_id, nome_usuario, texto))
            conn.commit()
            novo_id = cursor.lastrowid
            return self.buscar_mensagem_por_id(novo_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def buscar_mensagem_por_id(self, mensagem_id: int) -> dict | None:
        sql = """
            SELECT m.id, m.partida_id, m.usuario_id, m.nome_usuario, m.texto, m.criado_em,
                   COALESCE(u.foto_perfil, '') AS foto_perfil
            FROM mensagens m
            LEFT JOIN usuarios u ON m.usuario_id = u.id
            WHERE m.id = ?
        """
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(self.db.preparar_sql(conn, sql), (mensagem_id,))
            row = cursor.fetchone()
            return self._formatar_mensagem(dict(row)) if row else None
        finally:
            conn.close()
