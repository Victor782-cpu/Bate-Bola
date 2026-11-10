from repository.partida_repository import PartidaRepository


class ListarPartidasService:
    def __init__(self, repository=None):
        self.repository = repository or PartidaRepository()

    def executar(self):
        return self.repository.listar_todas()
