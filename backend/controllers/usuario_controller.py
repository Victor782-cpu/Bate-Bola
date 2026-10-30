from flask import Blueprint, jsonify, request
from services.perfil_service import ObterPerfilService, AtualizarPerfilService
from services.criar_usuario_service import CriarUsuarioService
from services.deletar_usuario_service import DeletarUsuarioService, LogoutUsuarioService

usuario_controller = Blueprint("usuario_controller", __name__)

@usuario_controller.route("/usuarios", methods=["POST", "OPTIONS"])
def criar_usuario():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    dados = request.get_json() or {}
    resposta, status = CriarUsuarioService.executar(dados)
    return jsonify(resposta), status

@usuario_controller.get("/perfil/<int:usuario_id>")
def obter_perfil(usuario_id):
    service = ObterPerfilService()
    perfil = service.executar(usuario_id)
    if not perfil:
        return jsonify({"erro": "Usuário não encontrado."}), 404
    return jsonify(perfil), 200

@usuario_controller.put("/perfil/<int:usuario_id>")
def atualizar_perfil(usuario_id):
    try:
        dados = request.get_json() or {}
        service = AtualizarPerfilService()
        perfil = service.executar(usuario_id, dados)
        if not perfil:
            return jsonify({"erro": "Usuário não encontrado."}), 404
        return jsonify(perfil), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500

@usuario_controller.delete("/perfil/<int:usuario_id>")
def deletar_perfil(usuario_id):
    resposta, status = DeletarUsuarioService.executar(usuario_id)
    return jsonify(resposta), status

@usuario_controller.post("/logout")
def logout():
    resposta, status = LogoutUsuarioService.executar()
    return jsonify(resposta), status