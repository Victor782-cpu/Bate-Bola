from models.usuario_model import Usuario
from models.avaliacao_model import Avaliacao


class ObterPerfilService:
    def executar(self, usuario_id):
        usuario = Usuario.buscar_por_id(usuario_id)

        if not usuario:
            return None

        avaliacoes = (
            Avaliacao.query
            .filter_by(avaliado_id=usuario.id)
            .order_by(Avaliacao.criada_em.desc())
            .all()
        )
        nota_media = round(sum(avaliacao.nota for avaliacao in avaliacoes) / len(avaliacoes), 1) if avaliacoes else None

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
            "faltas": getattr(usuario, "faltas", 0),
            "nota_media": nota_media,
            "avaliacoes": [
                {
                    "id": avaliacao.id,
                    "nota": avaliacao.nota,
                    "avaliador": avaliacao.avaliador.nome if avaliacao.avaliador else "Jogador",
                    "partida_id": avaliacao.partida_id,
                    "criada_em": avaliacao.criada_em.isoformat() if avaliacao.criada_em else ""
                }
                for avaliacao in avaliacoes
            ]
        }


class AtualizarPerfilService:
    def executar(self, usuario_id, dados):
        usuario = Usuario.buscar_por_id(usuario_id)

        if not usuario:
            return None

        usuario.atualizar(dados)

        return ObterPerfilService().executar(usuario_id)