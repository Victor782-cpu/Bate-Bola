from models.partida_model import Partida

class ListarPartidasService:
    def executar(self):
        partidas = Partida.listar_todas()
        return [partida.to_dict() for partida in partidas]