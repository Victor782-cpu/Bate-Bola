from repository.partida_repository import PartidaRepository


class FiltrarPartidaPorEsporteService:
    def __init__(self, repository=None):
        self.repository = repository or PartidaRepository()

    def executar(self, esporte: str) -> list:
        return self.repository.buscar_por_esporte(esporte)
