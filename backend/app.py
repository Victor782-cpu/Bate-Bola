import os
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

from models.database import db
from database.connection import DatabaseConnection
from repository.usuario_repository import UsuarioRepository
from controllers.partida_controller import partida_controller
from controllers.usuario_controller import usuario_controller
from controllers.chat_controller import chat_controller


def create_app():
    load_dotenv()

    app = Flask(__name__)

    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    
    caminho_db = DatabaseConnection.get_db_path().replace(os.sep, "/")

    database_url = os.getenv("DATABASE_URL", "")
    if not database_url or database_url.startswith("sqlite"):
        database_url = f"sqlite:///{caminho_db}"

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        db.create_all()

        usuario_repo = UsuarioRepository()
        if not usuario_repo.buscar_por_id(1):
            usuario_repo.criar({
                "nome": "Jogador Teste",
                "email": "teste@email.com",
                "senha": "123456",
                "telefone": "(31) 99999-8888",
                "cidade": "Belo Horizonte - MG",
                "posicao_preferida": "Atacante",
                "ativo": True
            })

   
    app.register_blueprint(partida_controller)
    app.register_blueprint(usuario_controller)
    app.register_blueprint(chat_controller)

    @app.get("/")
    def home():
        return jsonify({
            "mensagem": "API BateBola Esportes funcionando com Arquitetura em Camadas (Controllers em Classes e Repositories em SQL Puro).",
            "rotas": {
                "login": "POST /login",
                "criar_usuario": "POST /usuarios",
                "listar_partidas": "GET /partidas",
                "buscar_partida": "GET /partidas/<id>",
                "buscar_por_esporte": "GET /partidas/por-esporte?esporte=Futebol",
                "criar_partida": "POST /partidas",
                "atualizar_partida": "PUT /partidas/<id>",
                "deletar_partida": "DELETE /partidas/<id>",
                "participar_partida": "POST /partidas/<id>/participar",
                "cancelar_participacao": "POST /partidas/<id>/cancelar-participacao",
                "avaliar_jogador": "POST /partidas/<id>/avaliar",
                "chat_mensagens": "GET /partidas/<id>/mensagens",
                "enviar_mensagem": "POST /partidas/<id>/mensagens",
                "obter_perfil": "GET /perfil/<id>",
                "atualizar_perfil": "PUT /perfil/<id>"
            }
        })

    return app


app = create_app()

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "True") == "True"
    app.run(debug=debug, host="0.0.0.0", port=5001)
