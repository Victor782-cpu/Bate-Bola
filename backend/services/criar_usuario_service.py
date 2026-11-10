from repository.usuario_repository import UsuarioRepository


class CriarUsuarioService:
    def __init__(self, repository=None):
        self.repository = repository or UsuarioRepository()

    def executar(self, dados: dict):
        email = dados.get("email")
        senha = dados.get("senha")
        cidade = dados.get("cidade", "").strip() or "Belo Horizonte - MG"

        if not email or not senha:
            return {"erro": "E-mail e senha são obrigatórios"}, 400

        usuario_existente = self.repository.buscar_por_email(email)
        if usuario_existente:
            return {"erro": "E-mail já cadastrado"}, 400

        novo_usuario = self.repository.criar({
            "nome": dados.get("nome", "Novo Jogador"),
            "email": email,
            "senha": senha,
            "cidade": cidade,
            "ativo": True
        })

        return novo_usuario, 201
