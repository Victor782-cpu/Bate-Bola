from models.partida_model import Partida

class BuscarPartidaPorIdService:
    def executar(self, partida_id):
        partida = Partida.buscar_por_id(partida_id)
        return partida.to_dict() if partida else None