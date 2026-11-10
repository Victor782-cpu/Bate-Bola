from repository.usuario_repository import UsuarioRepository


class ObterPerfilService:
    def __init__(self, repository=None):
        self.usuario_repository = repository or UsuarioRepository()

    def executar(self, usuario_id: int):
        usuario = self.usuario_repository.buscar_por_id(usuario_id)
        if not usuario:
            return None

        avaliacoes = self.usuario_repository.obter_avaliacoes(usuario_id)
        nota_media = (
            round(sum(a["nota"] for a in avaliacoes) / len(avaliacoes), 1)
            if avaliacoes else None
        )

        return {
            "id": usuario["id"],
            "nome": usuario.get("nome", "Usuário"),
            "email": usuario.get("email", ""),
            "telefone": usuario.get("telefone", ""),
            "cidade": usuario.get("cidade", "Belo Horizonte - MG"),
            "foto_perfil": usuario.get("foto_perfil", ""),
            "esportes_favoritos": usuario.get("esportes_favoritos", "Futebol, Basquete"),
            "posicao_preferida": usuario.get("posicao_preferida", "Jogador"),
            "sobre": usuario.get("sobre", "Nenhum detalhe informado sobre o jogador."),
            "partidas_jogadas": usuario.get("partidas_jogadas", 0),
            "presencas": usuario.get("presencas", 0),
            "faltas": usuario.get("faltas", 0),
            "nota_media": nota_media,
            "avaliacoes": [
                {
                    "id": a["id"],
                    "nota": a["nota"],
                    "avaliador": a.get("avaliador_nome", "Jogador"),
                    "partida_id": a["partida_id"],
                    "criada_em": str(a.get("criada_em", ""))
                }
                for a in avaliacoes
            ]
        }


class AtualizarPerfilService:
    def __init__(self, repository=None):
        self.usuario_repository = repository or UsuarioRepository()

    def executar(self, usuario_id: int, dados: dict):
        usuario = self.usuario_repository.buscar_por_id(usuario_id)
        if not usuario:
            return None

        self.usuario_repository.atualizar(usuario_id, dados)
        return ObterPerfilService(self.usuario_repository).executar(usuario_id)
