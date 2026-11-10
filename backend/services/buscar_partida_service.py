from repository.partida_repository import PartidaRepository


class BuscarPartidaPorIdService:
    def __init__(self, repository=None):
        self.repository = repository or PartidaRepository()

    def executar(self, partida_id: int):
        return self.repository.buscar_por_id(partida_id)
