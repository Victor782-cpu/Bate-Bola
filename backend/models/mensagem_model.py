from datetime import datetime
from models.database import db

class MensagemChat(db.Model):
    __tablename__ = "mensagens"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    partida_id = db.Column(db.Integer, db.ForeignKey("partidas.id", ondelete="CASCADE"), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    nome_usuario = db.Column(db.String(100), nullable=False)
    texto = db.Column(db.Text, nullable=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    partida = db.relationship("Partida", backref=db.backref("mensagens", lazy=True, cascade="all, delete-orphan"))
    usuario = db.relationship("Usuario", backref=db.backref("mensagens_enviadas", lazy=True))

    def to_dict(self):
        foto = ""
        if self.usuario and self.usuario.foto_perfil:
            foto = self.usuario.foto_perfil

        return {
            "id": self.id,
            "partida_id": self.partida_id,
            "usuario_id": self.usuario_id,
            "usuario": self.nome_usuario,
            "foto_perfil": foto,
            "texto": self.texto,
            "hora": self.criado_em.strftime("%H:%M") if self.criado_em else "",
            "criado_em": self.criado_em.isoformat() if self.criado_em else ""
        }
