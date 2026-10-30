from flask import Blueprint, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from services.criar_partida_service import CriarPartidaService
from services.listar_partida_service import ListarPartidasService
from services.buscar_partida_service import BuscarPartidaPorIdService
from services.atualizar_partida_service import AtualizarPartidaService
from services.deletar_partida_service import DeletarPartidaService
from services.filtrar_partida_esporte_service import FiltrarPartidaPorEsporteService
from models.usuario_model import Usuario
from models.partida_model import Partida
from models.participante_model import PartidaParticipante
from models.avaliacao_model import Avaliacao
from models.database import db

partida_controller = Blueprint("partida_controller", __name__)

@partida_controller.post("/partidas")
def criar_partida():
    try:
        dados = request.get_json() or {}
        service = CriarPartidaService()
        partida = service.executar(dados)
        
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
        
        if not usuario_id:
            return jsonify({"erro": "ID do usuário é obrigatório para participar."}), 400

        partida = Partida.buscar_por_id(partida_id)
        if not partida:
            return jsonify({"erro": "Partida não encontrada."}), 404

        usuario = Usuario.buscar_por_id(usuario_id)
        if not usuario:
            return jsonify({"erro": "Usuário não encontrado."}), 404

        inscricao_existente = PartidaParticipante.query.filter_by(
            partida_id=partida_id, usuario_id=usuario_id
        ).first()

        if inscricao_existente:
            return jsonify({
                "mensagem": "Você já está inscrito nesta partida!",
                "vagas": partida.vagas,
                "partida": partida.to_dict()
            }), 200


        if partida.vagas is not None and partida.vagas <= 0:
            return jsonify({"erro": "Não há mais vagas disponíveis nesta partida."}), 400


        nova_inscricao = PartidaParticipante(partida_id=partida_id, usuario_id=usuario_id)
        db.session.add(nova_inscricao)


        if partida.vagas is not None:
            partida.vagas = max(0, partida.vagas - 1)


        usuario.presencas = (usuario.presencas or 0) + 1

        db.session.commit()

        return jsonify({
            "mensagem": "Inscrição realizada com sucesso!",
            "vagas": partida.vagas,
            "partida": partida.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"erro": f"Erro ao participar: {str(e)}"}), 500

@partida_controller.post("/partidas/<int:partida_id>/cancelar-participacao")
def cancelar_participacao(partida_id):
    try:
        dados = request.get_json() or {}
        usuario_id = dados.get("usuario_id")
        
        if not usuario_id:
            return jsonify({"erro": "ID do usuário é obrigatório."}), 400

        partida = Partida.buscar_por_id(partida_id)
        if not partida:
            return jsonify({"erro": "Partida não encontrada."}), 404

        usuario = Usuario.buscar_por_id(usuario_id)
        inscricao = PartidaParticipante.query.filter_by(
            partida_id=partida_id, usuario_id=usuario_id
        ).first()

        if inscricao:
            db.session.delete(inscricao)


            if partida.vagas is not None:
                partida.vagas = partida.vagas + 1

            if usuario:
                usuario.faltas = (usuario.faltas or 0) + 1
                if usuario.presencas and usuario.presencas > 0:
                    usuario.presencas -= 1

            db.session.commit()

            return jsonify({
                "mensagem": "Inscrição cancelada com sucesso!",
                "vagas": partida.vagas,
                "partida": partida.to_dict()
            }), 200
        else:
            return jsonify({
                "mensagem": "Você não estava inscrito nesta partida.",
                "vagas": partida.vagas,
                "partida": partida.to_dict()
            }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"erro": f"Erro ao cancelar participação: {str(e)}"}), 500

@partida_controller.post("/usuarios/<int:usuario_id>/avaliar")
def avaliar_usuario(usuario_id):
    try:
        dados = request.get_json() or {}
        try:
            nota = int(dados.get("nota", 0))
            avaliador_id = int(dados.get("avaliador_id", 0))
            partida_id = int(dados.get("partida_id", 0))
        except (TypeError, ValueError):
            return jsonify({"erro": "Nota, avaliador e partida são obrigatórios."}), 400

        if nota < 1 or nota > 5:
            return jsonify({"erro": "A nota deve ser entre 1 e 5."}), 400

        if avaliador_id == usuario_id:
            return jsonify({"erro": "Não é possível avaliar a si mesmo."}), 400

        avaliador = Usuario.buscar_por_id(avaliador_id)
        avaliado = Usuario.buscar_por_id(usuario_id)
        partida = Partida.buscar_por_id(partida_id)
        if not avaliador or not avaliado or not partida:
            return jsonify({"erro": "Jogador ou partida não encontrado."}), 404

        avaliador_inscrito = PartidaParticipante.query.filter_by(
            partida_id=partida_id, usuario_id=avaliador_id
        ).first()
        avaliado_inscrito = PartidaParticipante.query.filter_by(
            partida_id=partida_id, usuario_id=usuario_id
        ).first()
        if (avaliador_id != partida.usuario_id and not avaliador_inscrito) or not avaliado_inscrito:
            return jsonify({"erro": "A avaliação deve ser feita entre jogadores da partida."}), 403

        existente = Avaliacao.query.filter_by(
            partida_id=partida_id,
            avaliador_id=avaliador_id,
            avaliado_id=usuario_id
        ).first()
        if existente:
            return jsonify({"erro": "Você já avaliou este jogador nesta partida."}), 409

        db.session.add(Avaliacao(
            partida_id=partida_id,
            avaliador_id=avaliador_id,
            avaliado_id=usuario_id,
            nota=nota
        ))
        db.session.commit()
        return jsonify({"mensagem": "Avaliação registrada com sucesso!"}), 201
    except Exception as e:
        db.session.rollback()
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
