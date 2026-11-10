from flask import Blueprint, jsonify, request
from repository.chat_repository import ChatRepository
from repository.partida_repository import PartidaRepository
from repository.usuario_repository import UsuarioRepository


class ChatController:
    def __init__(self, chat_repository=None, partida_repository=None, usuario_repository=None):
        self.chat_repo = chat_repository or ChatRepository()
        self.partida_repo = partida_repository or PartidaRepository()
        self.usuario_repo = usuario_repository or UsuarioRepository()

    def carregar_chat_partida(self, partida_id: int):
        partida = self.partida_repo.buscar_por_id(partida_id)
        if not partida:
            return jsonify({"erro": "Partida não encontrada."}), 404
        return jsonify({
            "mensagem": f"Bem-vindo ao chat da partida {partida_id}",
            "partida": partida
        }), 200

    def listar_participantes(self, partida_id: int):
        partida = self.partida_repo.buscar_por_id(partida_id)
        if not partida:
            return jsonify({"erro": "Partida não encontrada."}), 404
        return jsonify(self.partida_repo.obter_participantes(partida_id)), 200

    def listar_mensagens(self, partida_id: int):
        partida = self.partida_repo.buscar_por_id(partida_id)
        if not partida:
            return jsonify({"erro": "Partida não encontrada."}), 404

        mensagens = self.chat_repo.listar_mensagens(partida_id)
        return jsonify(mensagens), 200

    def enviar_mensagem(self, partida_id: int):
        try:
            partida = self.partida_repo.buscar_por_id(partida_id)
            if not partida:
                return jsonify({"erro": "Partida não encontrada."}), 404

            dados = request.get_json() or {}
            texto = dados.get("texto", "").strip()
            if not texto:
                return jsonify({"erro": "O texto da mensagem não pode ser vazio."}), 400

            usuario_id = dados.get("usuario_id")
            nome_usuario = dados.get("nome_usuario")

            if usuario_id:
                usuario = self.usuario_repo.buscar_por_id(usuario_id)
                if usuario:
                    nome_usuario = usuario.get("nome", "Jogador")
                elif not nome_usuario:
                    nome_usuario = "Jogador"
            elif not nome_usuario:
                nome_usuario = "Jogador"

            nova_mensagem = self.chat_repo.salvar_mensagem(
                partida_id=partida_id,
                usuario_id=usuario_id,
                nome_usuario=nome_usuario,
                texto=texto
            )

            return jsonify(nova_mensagem), 201
        except Exception as e:
            return jsonify({"erro": f"Erro ao enviar mensagem: {str(e)}"}), 500


chat_controller = Blueprint("chat_controller", __name__)
_controller = ChatController()

chat_controller.add_url_rule("/partidas/<int:partida_id>/chat", view_func=_controller.carregar_chat_partida, methods=["GET"])
chat_controller.add_url_rule("/partidas/<int:partida_id>/participantes", view_func=_controller.listar_participantes, methods=["GET"])
chat_controller.add_url_rule("/partidas/<int:partida_id>/mensagens", view_func=_controller.listar_mensagens, methods=["GET"])
chat_controller.add_url_rule("/partidas/<int:partida_id>/mensagens", view_func=_controller.enviar_mensagem, methods=["POST"])
