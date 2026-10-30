from datetime import datetime

from models.database import db


class Avaliacao(db.Model):
    __tablename__ = "avaliacoes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    partida_id = db.Column(db.Integer, db.ForeignKey("partidas.id", ondelete="CASCADE"), nullable=False)
    avaliador_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    avaliado_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nota = db.Column(db.Integer, nullable=False)
    criada_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("partida_id", "avaliador_id", "avaliado_id", name="uq_avaliacao_partida_jogadores"),
    )

    avaliador = db.relationship("Usuario", foreign_keys=[avaliador_id])