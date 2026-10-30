from datetime import datetime
from models.database import db

class PartidaParticipante(db.Model):
    __tablename__ = "partida_participantes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    partida_id = db.Column(db.Integer, db.ForeignKey("partidas.id", ondelete="CASCADE"), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    data_inscricao = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("partida_id", "usuario_id", name="uq_partida_participante"),
    )

    partida = db.relationship("Partida", backref=db.backref("inscricoes", lazy=True, cascade="all, delete-orphan"))
    usuario = db.relationship("Usuario", backref=db.backref("partidas_participadas", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "partida_id": self.partida_id,
            "usuario_id": self.usuario_id,
            "data_inscricao": self.data_inscricao.isoformat() if self.data_inscricao else "",
            "usuario": {
                "id": self.usuario.id,
                "nome": self.usuario.nome,
                "foto_perfil": self.usuario.foto_perfil or "",
                "posicao_preferida": self.usuario.posicao_preferida or ""
            } if self.usuario else None
        }
