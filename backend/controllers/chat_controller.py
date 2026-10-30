from flask import Blueprint, jsonify, request
from models.database import db
from models.partida_model import Partida
from models.usuario_model import Usuario
from models.mensagem_model import MensagemChat
from models.participante_model import PartidaParticipante

chat_controller = Blueprint("chat_controller", __name__)

@chat_controller.get("/partidas/<int:partida_id>/chat")
def carregar_chat_partida(partida_id):
    partida = Partida.buscar_por_id(partida_id)
    if not partida:
        return jsonify({"erro": "Partida não encontrada."}), 404
    return jsonify({
        "mensagem": f"Bem-vindo ao chat da partida {partida_id}",
        "partida": partida.to_dict()
    }), 200

@chat_controller.get("/partidas/<int:partida_id>/participantes")
def listar_participantes(partida_id):
    partida = Partida.buscar_por_id(partida_id)
    if not partida:
        return jsonify({"erro": "Partida não encontrada."}), 404
    return jsonify(partida.obter_participantes()), 200

@chat_controller.get("/partidas/<int:partida_id>/mensagens")
def listar_mensagens(partida_id):
    partida = Partida.buscar_por_id(partida_id)
    if not partida:
        return jsonify({"erro": "Partida não encontrada."}), 404

    mensagens = MensagemChat.query.filter_by(partida_id=partida_id).order_by(MensagemChat.id.asc()).all()
    return jsonify([m.to_dict() for m in mensagens]), 200

@chat_controller.post("/partidas/<int:partida_id>/mensagens")
def enviar_mensagem(partida_id):
    try:
        partida = Partida.buscar_por_id(partida_id)
        if not partida:
            return jsonify({"erro": "Partida não encontrada."}), 404

        dados = request.get_json() or {}
        texto = dados.get("texto", "").strip()
        if not texto:
            return jsonify({"erro": "O texto da mensagem não pode ser vazio."}), 400

        usuario_id = dados.get("usuario_id")
        nome_usuario = dados.get("nome_usuario")

        if usuario_id:
            usuario = Usuario.buscar_por_id(usuario_id)
            if usuario:
                nome_usuario = usuario.nome
            elif not nome_usuario:
                nome_usuario = "Jogador"
        elif not nome_usuario:
            nome_usuario = "Jogador"

        nova_mensagem = MensagemChat(
            partida_id=partida_id,
            usuario_id=usuario_id,
            nome_usuario=nome_usuario,
            texto=texto
        )

        db.session.add(nova_mensagem)
        db.session.commit()

        return jsonify(nova_mensagem.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"erro": f"Erro ao enviar mensagem: {str(e)}"}), 500
