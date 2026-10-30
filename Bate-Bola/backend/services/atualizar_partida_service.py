from models.partida_model import Partida

class AtualizarPartidaService:
    def executar(self, partida_id, dados):
        partida = Partida.buscar_por_id(partida_id)
        if partida is None:
            return None

        partida.atualizar(
            titulo=dados.get("titulo"),
            esporte=dados.get("esporte"),
            local=dados.get("local"),
            data_hora=dados.get("data_hora"),
            vagas=dados.get("vagas"),
            ativo=dados.get("ativo")
        )

        return partida.to_dict()