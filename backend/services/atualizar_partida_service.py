from repository.partida_repository import PartidaRepository


class AtualizarPartidaService:
    def __init__(self, repository=None):
        self.repository = repository or PartidaRepository()

    def executar(self, partida_id: int, dados: dict):
        partida = self.repository.buscar_por_id(partida_id)
        if partida is None:
            return None

        return self.repository.atualizar(partida_id, dados)
