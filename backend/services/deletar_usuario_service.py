from models.usuario_model import Usuario


class DeletarUsuarioService:
    @staticmethod
    def executar(usuario_id):
        usuario = Usuario.buscar_por_id(usuario_id)

        if not usuario:
            return {"erro": "Usuário não encontrado."}, 404

        sucesso = usuario.deletar()

        if sucesso:
            return {"mensagem": "Perfil deletado com sucesso."}, 200

        return {"erro": "Erro ao deletar o perfil."}, 500


class LogoutUsuarioService:
    @staticmethod
    def executar(usuario_id=None):
        return {"mensagem": "Logout realizado com sucesso."}, 200