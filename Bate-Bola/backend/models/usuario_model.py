from models.database import db


class Usuario(db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False, unique=True)
    senha_hash = db.Column(db.String(255), nullable=False, default="123456")
    telefone = db.Column(db.String(20), nullable=True)
    cidade = db.Column(db.String(100), nullable=True, default="Belo Horizonte - MG")
    foto_perfil = db.Column(db.Text, nullable=True)  # Suporta Base64 ou URL
    esportes_favoritos = db.Column(db.String(255), nullable=True, default="Futebol, Basquete")
    sobre = db.Column(db.Text, nullable=True, default="Entusiasta de esportes coletivos.")
    posicao_preferida = db.Column(db.String(50), nullable=True)
    ativo = db.Column(db.Boolean, nullable=False, default=True)


    partidas_jogadas = db.Column(db.Integer, nullable=False, default=0)
    presencas = db.Column(db.Integer, nullable=False, default=0)
    faltas = db.Column(db.Integer, nullable=False, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email,
            "telefone": self.telefone or "",
            "cidade": self.cidade or "Belo Horizonte - MG",
            "foto_perfil": self.foto_perfil or "",
            "esportes_favoritos": self.esportes_favoritos or "Futebol, Basquete",
            "sobre": self.sobre or "",
            "posicao_preferida": self.posicao_preferida or "",
            "ativo": self.ativo,
            "partidas_jogadas": self.partidas_jogadas or 0,
            "presencas": self.presencas or 0,
            "faltas": self.faltas or 0
        }

    def salvar(self):
        db.session.add(self)
        db.session.commit()

    @staticmethod
    def buscar_por_email(email):
        return db.session.query(Usuario).filter_by(email=email).first()

    @staticmethod
    def buscar_por_id(usuario_id):
        return db.session.get(Usuario, usuario_id)

    def atualizar(self, dados):
        if "nome" in dados:
            self.nome = dados["nome"]

        if "telefone" in dados:
            self.telefone = dados["telefone"]

        if "cidade" in dados:
            self.cidade = dados["cidade"]

        if "foto_perfil" in dados:
            self.foto_perfil = dados["foto_perfil"]

        if "esportes_favoritos" in dados:
            self.esportes_favoritos = dados["esportes_favoritos"]

        if "sobre" in dados:
            self.sobre = dados["sobre"]

        if "posicao_preferida" in dados:
            self.posicao_preferida = dados["posicao_preferida"]

        db.session.commit()

    def deletar(self):
        try:
            db.session.delete(self)
            db.session.commit()
            return True
        except Exception:
            db.session.rollback()
            return False