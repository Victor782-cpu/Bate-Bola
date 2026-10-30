from flask import Blueprint, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from services.criar_partida_service import CriarPartidaService
from services.listar_partida_service import ListarPartidasService
from services.buscar_partida_service import BuscarPartidaPorIdService
from services.atualizar_partida_service import AtualizarPartidaService
from services.deletar_partida_service import DeletarPartidaService
from services.filtrar_partida_esporte_service import FiltrarPartidaPorEsporteService
from models.usuario_model import Usuario
from models.database import db

partida_controller = Blueprint("partida_controller", __name__)

@partida_controller.post("/partidas")
def criar_partida():
    try:
        dados = request.get_json() or {}
        service = CriarPartidaService()
        partida = service.executar(dados)
        
        # Incrementar o contador "Partidas Criadas" do utilizador
        usuario_id = dados.get("usuario_id")
        if usuario_id:
            usuario = Usuario.buscar_por_id(usuario_id)
            if usuario:
                usuario.partidas_jogadas = (usuario.partidas_jogadas or 0) + 1
                db.session.commit()

        return jsonify(partida), 201
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"erro": f"Erro no banco de dados: {str(e)}"}), 500

@partida_controller.post("/partidas/<int:partida_id>/participar")
def participar_partida(partida_id):
    try:
        dados = request.get_json() or {}
        usuario_id = dados.get("usuario_id")
        
        # Incrementar o contador "Presenças Confirmadas" do utilizador
        if usuario_id:
            usuario = Usuario.buscar_por_id(usuario_id)
            if usuario:
                usuario.presencas = (usuario.presencas or 0) + 1
                db.session.commit()

        return jsonify({"mensagem": "Inscrição realizada com sucesso!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"erro": str(e)}), 500

@partida_controller.post("/partidas/<int:partida_id>/cancelar-participacao")
def cancelar_participacao(partida_id):
    try:
        dados = request.get_json() or {}
        usuario_id = dados.get("usuario_id")
        
        # Incrementar "Faltas Registadas" e ajustar presenças
        if usuario_id:
            usuario = Usuario.buscar_por_id(usuario_id)
            if usuario:
                usuario.faltas = (usuario.faltas or 0) + 1
                if usuario.presencas and usuario.presencas > 0:
                    usuario.presencas -= 1
                db.session.commit()

        return jsonify({"mensagem": "Inscrição cancelada com sucesso!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"erro": str(e)}), 500

@partida_controller.post("/usuarios/<int:usuario_id>/avaliar")
def avaliar_usuario(usuario_id):
    try:
        dados = request.get_json() or {}
        nota = float(dados.get("nota", 0))
        
        if nota < 1 or nota > 5:
            return jsonify({"erro": "A nota deve ser entre 1 e 5."}), 400

        return jsonify({"mensagem": "Avaliação registrada com sucesso!"}), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@partida_controller.get("/partidas")
def listar_partidas():
    service = ListarPartidasService()
    partidas = service.executar()
    return jsonify(partidas), 200

@partida_controller.get("/partidas/por-esporte")
def buscar_por_esporte():
    try:
        esporte = request.args.get("esporte", "Todos")
        service = FiltrarPartidaPorEsporteService()
        partidas = service.executar(esporte)

        resultado = [
            p.to_dict() if hasattr(p, "to_dict") else p 
            for p in partidas
        ]
        
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao executar busca por esporte: {str(e)}"}), 500

@partida_controller.get("/partidas/<int:partida_id>")
def buscar_partida_por_id(partida_id):
    service = BuscarPartidaPorIdService()
    partida = service.executar(partida_id)
    if partida is None:
        return jsonify({"erro": "Partida não encontrada."}), 404
    return jsonify(partida), 200

@partida_controller.put("/partidas/<int:partida_id>")
def atualizar_partida(partida_id):
    try:
        dados = request.get_json() or {}
        usuario_logado_id = dados.get("usuario_id")

        service_buscar = BuscarPartidaPorIdService()
        partida_existente = service_buscar.executar(partida_id)

        if partida_existente is None:
            return jsonify({"erro": "Partida não encontrada."}), 404

        dono_id = partida_existente.get("usuario_id") if isinstance(partida_existente, dict) else getattr(partida_existente, "usuario_id", None)
        if dono_id and usuario_logado_id and int(dono_id) != int(usuario_logado_id):
            return jsonify({"erro": "Você não tem permissão para editar esta partida."}), 403

        service = AtualizarPartidaService()
        partida_atualizada = service.executar(partida_id, dados)
        return jsonify(partida_atualizada), 200
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"erro": "Erro ao atualizar partida."}), 500

@partida_controller.delete("/partidas/<int:partida_id>")
def deletar_partida(partida_id):
    try:
        usuario_logado_id = request.args.get("usuario_id", type=int)

        service_buscar = BuscarPartidaPorIdService()
        partida_existente = service_buscar.executar(partida_id)

        if partida_existente is None:
            return jsonify({"erro": "Partida não encontrada."}), 404

        dono_id = partida_existente.get("usuario_id") if isinstance(partida_existente, dict) else getattr(partida_existente, "usuario_id", None)
        if dono_id and usuario_logado_id and int(dono_id) != int(usuario_logado_id):
            return jsonify({"erro": "Você não tem permissão para excluir esta partida."}), 403

        service = DeletarPartidaService()
        deletado = service.executar(partida_id)
        if not deletado:
            return jsonify({"erro": "Partida não encontrada."}), 404
        return "", 204
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"erro": "Erro ao deletar partida."}), 500