from flask import Blueprint, jsonify

chat_controller = Blueprint("chat_controller", __name__)

@chat_controller.get("/partidas/<int:partida_id>/chat")
def carregar_chat_partida(partida_id):
    return jsonify({
        "mensagem": f"Bem-vindo ao chat da partida {partida_id}",
        "partida_id": partida_id
    }), 200