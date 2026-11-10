from flask import Blueprint, jsonify, request
from repository.usuario_repository import UsuarioRepository
from services.criar_usuario_service import CriarUsuarioService
from services.deletar_usuario_service import DeletarUsuarioService, LogoutUsuarioService
from services.perfil_service import AtualizarPerfilService, ObterPerfilService


class UsuarioController:

    def __init__(
        self,
        service_obter_perfil=None,
        service_atualizar_perfil=None,
        service_criar=None,
        service_deletar=None,
        service_logout=None,
        usuario_repository=None,
    ):
        self.usuario_repo = usuario_repository or UsuarioRepository()
        self.service_obter_perfil = service_obter_perfil or ObterPerfilService(self.usuario_repo)
        self.service_atualizar_perfil = service_atualizar_perfil or AtualizarPerfilService(self.usuario_repo)
        self.service_criar = service_criar or CriarUsuarioService(self.usuario_repo)
        self.service_deletar = service_deletar or DeletarUsuarioService(self.usuario_repo)
        self.service_logout = service_logout or LogoutUsuarioService()

    def criar_usuario(self):
        if request.method == "OPTIONS":
            return jsonify({"status": "ok"}), 200

        dados = request.get_json() or {}
        resposta, status = self.service_criar.executar(dados)
        return jsonify(resposta), status

    def login(self):
        if request.method == "OPTIONS":
            return jsonify({"status": "ok"}), 200

        dados = request.get_json() or {}
        email = dados.get("email")
        senha = dados.get("senha")

        if not email or not senha:
            return jsonify({"erro": "E-mail e senha são obrigatórios"}), 400

        usuario = self.usuario_repo.autenticar(email, senha)
        if not usuario:
            return jsonify({"erro": "E-mail ou senha inválidos"}), 401

        return jsonify(usuario), 200

    def obter_perfil(self, usuario_id: int):
        perfil = self.service_obter_perfil.executar(usuario_id)
        if not perfil:
            return jsonify({"erro": "Usuário não encontrado."}), 404
        return jsonify(perfil), 200

    def atualizar_perfil(self, usuario_id: int):
        try:
            dados = request.get_json() or {}
            perfil = self.service_atualizar_perfil.executar(usuario_id, dados)
            if not perfil:
                return jsonify({"erro": "Usuário não encontrado."}), 404
            return jsonify(perfil), 200
        except ValueError as e:
            return jsonify({"erro": str(e)}), 400
        except Exception as e:
            return jsonify({"erro": f"Erro interno: {str(e)}"}), 500

    def deletar_perfil(self, usuario_id: int):
        resposta, status = self.service_deletar.executar(usuario_id)
        return jsonify(resposta), status

    def logout(self):
        resposta, status = self.service_logout.executar()
        return jsonify(resposta), status



usuario_controller = Blueprint("usuario_controller", __name__)
_controller = UsuarioController()

usuario_controller.add_url_rule("/usuarios", view_func=_controller.criar_usuario, methods=["POST", "OPTIONS"])
usuario_controller.add_url_rule("/login", view_func=_controller.login, methods=["POST", "OPTIONS"])
usuario_controller.add_url_rule("/perfil/<int:usuario_id>", view_func=_controller.obter_perfil, methods=["GET"])
usuario_controller.add_url_rule("/perfil/<int:usuario_id>", view_func=_controller.atualizar_perfil, methods=["PUT"])
usuario_controller.add_url_rule("/perfil/<int:usuario_id>", view_func=_controller.deletar_perfil, methods=["DELETE"])
usuario_controller.add_url_rule("/logout", view_func=_controller.logout, methods=["POST"])
