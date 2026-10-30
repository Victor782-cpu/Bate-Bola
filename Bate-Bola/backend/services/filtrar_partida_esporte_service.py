from repository.partida_repository import PartidaRepository

class FiltrarPartidaPorEsporteService:
    def executar(self, esporte: str):
        return PartidaRepository.buscar_por_esporte(esporte)