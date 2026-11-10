from repository.usuario_repository import UsuarioRepository


class DeletarUsuarioService:
    def __init__(self, repository=None):
        self.repository = repository or UsuarioRepository()

    def executar(self, usuario_id: int):
        usuario = self.repository.buscar_por_id(usuario_id)
        if not usuario:
            return {"erro": "Usuário não encontrado."}, 404

        sucesso = self.repository.deletar(usuario_id)
        if sucesso:
            return {"mensagem": "Perfil deletado com sucesso."}, 200

        return {"erro": "Erro ao deletar o perfil."}, 500


class LogoutUsuarioService:
    @staticmethod
    def executar(usuario_id=None):
        return {"mensagem": "Logout realizado com sucesso."}, 200
