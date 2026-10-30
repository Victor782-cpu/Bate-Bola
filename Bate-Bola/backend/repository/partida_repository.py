from sqlalchemy import text
from models.database import db
from models.partida_model import Partida

class PartidaRepository:
    @staticmethod
    def buscar_por_esporte(esporte):
        banco = db.session.get_bind().dialect.name
        if banco == "mysql":
            sql = text("CALL partidas_por_esporte(:esporte)")
            resultado = db.session.execute(sql, {"esporte": esporte or "Todos"})
            linhas = resultado.mappings().all()
            resultado.close()

            return [
                {
                    "id": linha["id"],
                    "organizador_id": linha.get("organizador_id", 1),
                    "organizador_nome": linha.get("organizador_nome", "Organizador"),
                    "titulo": linha["titulo"],
                    "esporte": linha["esporte"],
                    "local": linha["local"],
                    "data_hora": linha["data_hora"],
                    "horario": linha.get("horario", ""),
                    "vagas": linha["vagas"],
                    "status": linha.get("status", "ABERTA")
                }
                for linha in linhas
            ]

        query = Partida.query.filter(Partida.ativo == True)

        if esporte and esporte != "Todos":
            query = query.filter(Partida.esporte.ilike(esporte))

        partidas = query.order_by(Partida.id.asc()).all()
        return [p.to_dict() for p in partidas]