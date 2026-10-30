from models.partida_model import Partida

class CriarPartidaService:
    def executar(self, dados):
        if not dados.get("esporte") or not dados.get("local"):
            raise ValueError("Os campos esporte e local são obrigatórios.")

        titulo = dados.get("titulo") or f"Partida de {dados.get('esporte')}"

        try:
            vagas = int(dados.get("vagas", 10))
        except (ValueError, TypeError):
            vagas = 10

        nova_partida = Partida(
            titulo=titulo,
            esporte=dados.get("esporte"),
            local=dados.get("local"),
            data_hora=dados.get("data_hora"),
            horario=dados.get("horario", ""),
            vagas=vagas,
            usuario_id=dados.get("usuario_id"),
            ativo=True
        )

        nova_partida.salvar()
        return nova_partida.to_dict()