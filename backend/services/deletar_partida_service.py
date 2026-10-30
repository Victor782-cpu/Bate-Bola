from models.partida_model import Partida

class DeletarPartidaService:
    def executar(self, partida_id):
        partida = Partida.buscar_por_id(partida_id)
        if partida is None:
            return False

        partida.deletar()
        return True