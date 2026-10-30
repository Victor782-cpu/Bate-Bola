import os
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from models.database import db
from models.partida_model import Partida
from models.usuario_model import Usuario
from models.participante_model import PartidaParticipante
from models.mensagem_model import MensagemChat
from models.avaliacao_model import Avaliacao
from controllers.partida_controller import partida_controller
from controllers.usuario_controller import usuario_controller
from controllers.chat_controller import chat_controller

def create_app():
    load_dotenv()

    app = Flask(__name__)

    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    basedir = os.path.abspath(os.path.dirname(__file__))

    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{os.path.join(basedir, 'batebola.db')}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        db.create_all()

        if not db.session.get(Usuario, 1):
            usuario_padrao = Usuario(
                id=1,
                nome="Jogador Teste",
                email="teste@email.com",
                senha_hash="123456",
                telefone="(31) 99999-8888",
                cidade="Belo Horizonte - MG",
                posicao_preferida="Atacante",
                ativo=True
            )
            db.session.add(usuario_padrao)
            db.session.commit()

    app.register_blueprint(partida_controller)
    app.register_blueprint(usuario_controller)
    app.register_blueprint(chat_controller)

    @app.route("/usuarios", methods=["POST", "OPTIONS"])
    def criar_usuario():
        if request.method == "OPTIONS":
            return jsonify({"status": "ok"}), 200

        dados = request.get_json() or {}
        email = dados.get("email")
        senha = dados.get("senha")
        cidade = dados.get("cidade", "").strip() or "Belo Horizonte - MG"

        if not email or not senha:
            return jsonify({"erro": "E-mail e senha são obrigatórios"}), 400

        usuario_existente = db.session.query(Usuario).filter_by(email=email).first()
        if usuario_existente:
            return jsonify({"erro": "E-mail já cadastrado"}), 400

        novo_usuario = Usuario(
            nome=dados.get("nome", "Novo Jogador"),
            email=email,
            senha_hash=senha,
            cidade=cidade,
            ativo=True
        )

        db.session.add(novo_usuario)
        db.session.commit()

        return jsonify(novo_usuario.to_dict()), 201

    @app.route("/login", methods=["POST", "OPTIONS"])
    def login():
        if request.method == "OPTIONS":
            return jsonify({"status": "ok"}), 200

        dados = request.get_json() or {}
        email = dados.get("email")
        senha = dados.get("senha")

        usuario = db.session.query(Usuario).filter_by(email=email, senha_hash=senha).first()
        if not usuario:
            return jsonify({"erro": "E-mail ou senha inválidos"}), 401

        return jsonify(usuario.to_dict()), 200

    @app.get("/")
    def home():
        return jsonify({
            "mensagem": "API BateBola Esportes funcionando com SQLite.",
            "rotas": {
                "login": "POST /login",
                "criar_usuario": "POST /usuarios",
                "listar_partidas": "GET /partidas",
                "buscar_partida": "GET /partidas/<id>",
                "buscar_por_esporte": "GET /partidas/por-esporte?esporte=Futebol",
                "criar_partida": "POST /partidas",
                "atualizar_partida": "PUT /partidas/<id>",
                "deletar_partida": "DELETE /partidas/<id>",
                "obter_perfil": "GET /perfil/<id>",
                "atualizar_perfil": "PUT /perfil/<id>"
            }
        })

    return app

app = create_app()

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "True") == "True"
    app.run(debug=debug, host="0.0.0.0", port=5001)
