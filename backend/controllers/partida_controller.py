from flask import Blueprint, jsonify, request
from repository.partida_repository import PartidaRepository
from repository.usuario_repository import UsuarioRepository
from services.atualizar_partida_service import AtualizarPartidaService
from services.buscar_partida_service import BuscarPartidaPorIdService
from services.criar_partida_service import CriarPartidaService
from services.deletar_partida_service import DeletarPartidaService
from services.filtrar_partida_esporte_service import FiltrarPartidaPorEsporteService
from services.listar_partida_service import ListarPartidasService


class PartidaController:

    def __init__(
        self,
        service_criar=None,
        service_listar=None,
        service_buscar=None,
        service_atualizar=None,
        service_deletar=None,
        service_filtrar=None,
        partida_repository=None,
        usuario_repository=None,
    ):
        self.partida_repo = partida_repository or PartidaRepository()
        self.usuario_repo = usuario_repository or UsuarioRepository()
        self.service_criar = service_criar or CriarPartidaService(self.partida_repo)
        self.service_listar = service_listar or ListarPartidasService(self.partida_repo)
        self.service_buscar = service_buscar or BuscarPartidaPorIdService(self.partida_repo)
        self.service_atualizar = service_atualizar or AtualizarPartidaService(self.partida_repo)
        self.service_deletar = service_deletar or DeletarPartidaService(self.partida_repo)
        self.service_filtrar = service_filtrar or FiltrarPartidaPorEsporteService(self.partida_repo)

    def criar_partida(self):
        try:
            dados = request.get_json() or {}
            partida = self.service_criar.executar(dados)

            usuario_id = dados.get("usuario_id")
            if usuario_id:
                self.usuario_repo.incrementar_partidas(usuario_id, 1)

            return jsonify(partida), 201
        except ValueError as erro:
            return jsonify({"erro": str(erro)}), 400
        except Exception as e:
            return jsonify({"erro": f"Erro interno: {str(e)}"}), 500

    def listar_partidas(self):
        try:
            partidas = self.service_listar.executar()
            return jsonify(partidas), 200
        except Exception as e:
            return jsonify({"erro": f"Erro ao listar partidas: {str(e)}"}), 500

    def buscar_por_esporte(self):
        try:
            esporte = request.args.get("esporte", "Todos")
            partidas = self.service_filtrar.executar(esporte)
            return jsonify(partidas), 200
        except Exception as e:
            return jsonify({"erro": f"Erro ao filtrar por esporte: {str(e)}"}), 500

    def buscar_partida_por_id(self, partida_id: int):
        partida = self.service_buscar.executar(partida_id)
        if partida is None:
            return jsonify({"erro": "Partida não encontrada."}), 404
        return jsonify(partida), 200

    def atualizar_partida(self, partida_id: int):
        try:
            dados = request.get_json() or {}
            usuario_logado_id = dados.get("usuario_id")

            partida_existente = self.service_buscar.executar(partida_id)
            if partida_existente is None:
                return jsonify({"erro": "Partida não encontrada."}), 404

            dono_id = partida_existente.get("usuario_id")
            if dono_id and usuario_logado_id and int(dono_id) != int(usuario_logado_id):
                return jsonify({"erro": "Você não tem permissão para editar esta partida."}), 403

            partida_atualizada = self.service_atualizar.executar(partida_id, dados)
            return jsonify(partida_atualizada), 200
        except ValueError as erro:
            return jsonify({"erro": str(erro)}), 400
        except Exception as e:
            return jsonify({"erro": f"Erro ao atualizar partida: {str(e)}"}), 500

    def deletar_partida(self, partida_id: int):
        try:
            usuario_logado_id = request.args.get("usuario_id", type=int)

            partida_existente = self.service_buscar.executar(partida_id)
            if partida_existente is None:
                return jsonify({"erro": "Partida não encontrada."}), 404

            dono_id = partida_existente.get("usuario_id")
            if dono_id and usuario_logado_id and int(dono_id) != int(usuario_logado_id):
                return jsonify({"erro": "Você não tem permissão para excluir esta partida."}), 403

            deletado = self.service_deletar.executar(partida_id)
            if not deletado:
                return jsonify({"erro": "Partida não encontrada."}), 404
            return "", 204
        except Exception as e:
            return jsonify({"erro": f"Erro ao deletar partida: {str(e)}"}), 500

    def participar_partida(self, partida_id: int):
        try:
            dados = request.get_json() or {}
            usuario_id = dados.get("usuario_id")

            if not usuario_id:
                return jsonify({"erro": "ID do usuário é obrigatório para participar."}), 400

            partida = self.service_buscar.executar(partida_id)
            if not partida:
                return jsonify({"erro": "Partida não encontrada."}), 404

            usuario = self.usuario_repo.buscar_por_id(usuario_id)
            if not usuario:
                return jsonify({"erro": "Usuário não encontrado."}), 404

            if self.partida_repo.verificar_participacao(partida_id, usuario_id):
                return jsonify({"erro": "Você já está participando desta partida."}), 400

            vagas_ocupadas = len(partida.get("participantes", []))
            if vagas_ocupadas >= partida.get("vagas", 0):
                return jsonify({"erro": "Esta partida já atingiu o limite de vagas."}), 400

            self.partida_repo.adicionar_participante(partida_id, usuario_id)
            self.usuario_repo.incrementar_partidas(usuario_id, 1)

            return jsonify({"mensagem": "Participação confirmada com sucesso!"}), 200
        except Exception as e:
            return jsonify({"erro": f"Erro ao participar da partida: {str(e)}"}), 500

    def cancelar_participacao(self, partida_id: int):
        try:
            dados = request.get_json() or {}
            usuario_id = dados.get("usuario_id")

            if not usuario_id:
                return jsonify({"erro": "ID do usuário é obrigatório para cancelar participação."}), 400

            partida = self.service_buscar.executar(partida_id)
            if not partida:
                return jsonify({"erro": "Partida não encontrada."}), 404

            if not self.partida_repo.verificar_participacao(partida_id, usuario_id):
                return jsonify({"erro": "Você não está inscrito nesta partida."}), 400

            self.partida_repo.remover_participante(partida_id, usuario_id)
            self.usuario_repo.incrementar_partidas(usuario_id, -1)

            return jsonify({"mensagem": "Participação cancelada com sucesso."}), 200
        except Exception as e:
            return jsonify({"erro": f"Erro ao cancelar participação: {str(e)}"}), 500

    def avaliar_jogador(self, partida_id: int):
        try:
            dados = request.get_json() or {}
            avaliador_id = dados.get("avaliador_id")
            avaliado_id = dados.get("avaliado_id")
            nota = dados.get("nota")

            if not avaliador_id or not avaliado_id or nota is None:
                return jsonify({"erro": "avaliador_id, avaliado_id e nota são obrigatórios."}), 400

            try:
                nota = int(nota)
                if nota < 1 or nota > 5:
                    raise ValueError()
            except ValueError:
                return jsonify({"erro": "A nota deve ser um número inteiro entre 1 e 5."}), 400

            if int(avaliador_id) == int(avaliado_id):
                return jsonify({"erro": "Você não pode avaliar a si mesmo."}), 400

            partida = self.service_buscar.executar(partida_id)
            if not partida:
                return jsonify({"erro": "Partida não encontrada."}), 404

            avaliador = self.usuario_repo.buscar_por_id(avaliador_id)
            avaliado = self.usuario_repo.buscar_por_id(avaliado_id)
            if not avaliador or not avaliado:
                return jsonify({"erro": "Avaliador ou jogador avaliado não encontrado."}), 404

            ids_participantes = {p["id"] for p in partida.get("participantes", [])}
            if partida.get("usuario_id"):
                ids_participantes.add(partida["usuario_id"])

            if int(avaliador_id) not in ids_participantes or int(avaliado_id) not in ids_participantes:
                return jsonify({"erro": "Ambos os jogadores precisam fazer parte desta partida."}), 400

            if self.partida_repo.verificar_avaliacao(partida_id, avaliador_id, avaliado_id):
                return jsonify({"erro": "Você já avaliou este jogador nesta partida."}), 400

            self.partida_repo.salvar_avaliacao(partida_id, avaliador_id, avaliado_id, nota)

            if nota >= 3:
                presencas_atuais = avaliado.get("presencas") or 0
                self.usuario_repo.atualizar(avaliado_id, {"presencas": presencas_atuais + 1})
            else:
                faltas_atuais = avaliado.get("faltas") or 0
                self.usuario_repo.atualizar(avaliado_id, {"faltas": faltas_atuais + 1})

            return jsonify({"mensagem": "Avaliação registrada com sucesso!"}), 200
        except Exception as e:
            return jsonify({"erro": f"Erro ao registrar avaliação: {str(e)}"}), 500



partida_controller = Blueprint("partida_controller", __name__)
_controller = PartidaController()

partida_controller.add_url_rule("/partidas", view_func=_controller.criar_partida, methods=["POST"])
partida_controller.add_url_rule("/partidas", view_func=_controller.listar_partidas, methods=["GET"])
partida_controller.add_url_rule("/partidas/por-esporte", view_func=_controller.buscar_por_esporte, methods=["GET"])
partida_controller.add_url_rule("/partidas/<int:partida_id>", view_func=_controller.buscar_partida_por_id, methods=["GET"])
partida_controller.add_url_rule("/partidas/<int:partida_id>", view_func=_controller.atualizar_partida, methods=["PUT"])
partida_controller.add_url_rule("/partidas/<int:partida_id>", view_func=_controller.deletar_partida, methods=["DELETE"])
partida_controller.add_url_rule("/partidas/<int:partida_id>/participar", view_func=_controller.participar_partida, methods=["POST"])
partida_controller.add_url_rule("/partidas/<int:partida_id>/cancelar-participacao", view_func=_controller.cancelar_participacao, methods=["POST"])
partida_controller.add_url_rule("/partidas/<int:partida_id>/avaliar", view_func=_controller.avaliar_jogador, methods=["POST"])
