from .database import db

class Partida(db.Model):
    __tablename__ = "partidas"

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(100), nullable=False, default="Partida")
    esporte = db.Column(db.String(50), nullable=False)
    local = db.Column(db.String(150), nullable=False)
    data_hora = db.Column(db.String(50), nullable=False)
    horario = db.Column(db.String(20), nullable=True)
    vagas = db.Column(db.Integer, nullable=False)
    usuario_id = db.Column(db.Integer, nullable=True)  # Adicionado para salvar o ID do criador
    ativo = db.Column(db.Boolean, nullable=False, default=True)

    def __init__(self, titulo, esporte, local, data_hora, horario, vagas, usuario_id=None, ativo=True):
        self.titulo = titulo
        self.esporte = esporte
        self.local = local
        self.data_hora = data_hora
        self.horario = horario
        self.vagas = vagas
        self.usuario_id = usuario_id
        self.ativo = ativo

    def salvar(self):
        db.session.add(self)
        db.session.commit()

    def atualizar(self, titulo=None, esporte=None, local=None, data_hora=None, horario=None, vagas=None, usuario_id=None, ativo=None):
        if titulo is not None:
            self.titulo = titulo
        if esporte is not None:
            self.esporte = esporte
        if local is not None:
            self.local = local
        if data_hora is not None:
            self.data_hora = data_hora
        if horario is not None:
            self.horario = horario
        if vagas is not None:
            self.vagas = vagas
        if usuario_id is not None:
            self.usuario_id = usuario_id
        if ativo is not None:
            self.ativo = ativo

        db.session.commit()

    def deletar(self):
        db.session.delete(self)
        db.session.commit()

    @staticmethod
    def listar_todas():
        return Partida.query.filter_by(ativo=True).order_by(Partida.id.asc()).all()

    @staticmethod
    def buscar_por_esporte(esporte):
        if not esporte or esporte == "Todos":
            return Partida.listar_todas()
        return Partida.query.filter_by(esporte=esporte, ativo=True).order_by(Partida.id.asc()).all()

    @staticmethod
    def buscar_por_id(id):
        return Partida.query.get(id)

    def obter_participantes(self):
        try:
            from models.participante_model import PartidaParticipante
            inscricoes = PartidaParticipante.query.filter_by(partida_id=self.id).all()
            participantes_lista = []
            for inscricao in inscricoes:
                if inscricao.usuario:
                    participantes_lista.append({
                        "id": inscricao.usuario.id,
                        "nome": inscricao.usuario.nome,
                        "foto_perfil": inscricao.usuario.foto_perfil or "",
                        "posicao_preferida": inscricao.usuario.posicao_preferida or ""
                    })
            return participantes_lista
        except Exception:
            return []

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "esporte": self.esporte,
            "local": self.local,
            "data_hora": self.data_hora,
            "horario": self.horario,
            "vagas": self.vagas,
            "usuario_id": self.usuario_id,  
            "ativo": self.ativo,
            "participantes": self.obter_participantes()
        }
