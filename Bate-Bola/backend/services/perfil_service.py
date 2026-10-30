from models.usuario_model import Usuario


class ObterPerfilService:
    def executar(self, usuario_id):
        usuario = Usuario.buscar_por_id(usuario_id)

        if not usuario:
            return None

        return {
            "id": usuario.id,
            "nome": getattr(usuario, "nome", "Usuário"),
            "email": getattr(usuario, "email", ""),
            "telefone": getattr(usuario, "telefone", ""),
            "cidade": getattr(usuario, "cidade", "Belo Horizonte - MG"),
            "foto_perfil": getattr(usuario, "foto_perfil", ""),
            "esportes_favoritos": getattr(usuario, "esportes_favoritos", "Futebol, Basquete"),
            "posicao_preferida": getattr(usuario, "posicao_preferida", "Jogador"),
            "sobre": getattr(usuario, "sobre", "Nenhum detalhe informado sobre o jogador."),
            "partidas_jogadas": getattr(usuario, "partidas_jogadas", 0),
            "presencas": getattr(usuario, "presencas", 0),
            "faltas": getattr(usuario, "faltas", 0)
        }


class AtualizarPerfilService:
    def executar(self, usuario_id, dados):
        usuario = Usuario.buscar_por_id(usuario_id)

        if not usuario:
            return None

        usuario.atualizar(dados)

        return ObterPerfilService().executar(usuario_id)