from repository.partida_repository import PartidaRepository


class DeletarPartidaService:
    def __init__(self, repository=None):
        self.repository = repository or PartidaRepository()

    def executar(self, partida_id: int) -> bool:
        partida = self.repository.buscar_por_id(partida_id)
        if partida is None:
            return False

        return self.repository.deletar(partida_id)
