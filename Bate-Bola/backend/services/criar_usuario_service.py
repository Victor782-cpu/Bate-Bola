from models.usuario_model import Usuario


class CriarUsuarioService:
    @staticmethod
    def executar(dados):
        email = dados.get("email")
        senha = dados.get("senha")

        if not email or not senha:
            return {"erro": "E-mail e senha são obrigatórios"}, 400

        usuario_existente = Usuario.buscar_por_email(email)

        if usuario_existente:
            return {"erro": "E-mail já cadastrado"}, 400

        novo_usuario = Usuario(
            nome=dados.get("nome"),
            email=email,
            senha_hash=senha,
            ativo=True
        )

        novo_usuario.salvar()

        return {
            "id": novo_usuario.id,
            "nome": novo_usuario.nome,
            "email": novo_usuario.email
        }, 201