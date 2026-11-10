# BateBola Esportes

## Descrição

O BateBola é uma aplicação desenvolvida para facilitar a criação, organização e participação em partidas esportivas informais.

## Tecnologias utilizadas

- Python 3
- Flask
- SQL puro (SQLite / MySQL)
- Arquitetura em Camadas (Controllers em Classes, Services, Repositories)
- HTML5 / CSS3 / JavaScript

## Funcionalidades (20 funcionalidades implementadas)

1. *Cadastro de usuário*
2. *Login e autenticação*
3. *Logout seguro*
4. *Perfil do jogador*
5. *Edição de perfil*
6. *Exclusão de conta*
7. *Criação de partidas*
8. *Listagem de partidas*
9. *Filtro por esporte*
10. *Filtro por data e local*
11. *Calendário interativo*
12. *Participação em partidas*
13. *Cancelamento de participação*
14. *Chat por partida*
15. *Avaliação de jogadores*
16. *Edição e exclusão de partidas*
17. *Partidas favoritas*
18. *Histórico de partidas*
19. *Integração com Google Maps*
20. *Avaliação do site*


## Diagrama de Classes (Arquitetura)

classDiagram
    class PartidaController {
        +criar_partida()
        +listar_partidas()
        +buscar_por_esporte()
        +buscar_partida_por_id(id)
        +atualizar_partida(id)
        +deletar_partida(id)
        +participar_partida(id)
        +cancelar_participacao(id)
        +avaliar_jogador(id)
    }

    class UsuarioController {
        +criar_usuario()
        +login()
        +obter_perfil(id)
        +atualizar_perfil(id)
        +deletar_perfil(id)
        +logout()
    }

    class ChatController {
        +carregar_chat_partida(id)
        +listar_participantes(id)
        +listar_mensagens(id)
        +enviar_mensagem(id)
    }

    class PartidaRepository {
        +listar_todas()
        +buscar_por_id(id)
        +buscar_por_esporte(esporte)
        +criar(dados)
        +atualizar(id, dados)
        +deletar(id)
        +obter_participantes(partida_id)
        +adicionar_participante(partida_id, usuario_id)
        +remover_participante(partida_id, usuario_id)
        +salvar_avaliacao(partida_id, avaliador_id, avaliado_id, nota)
    }

    class UsuarioRepository {
        +buscar_por_id(id)
        +buscar_por_email(email)
        +autenticar(email, senha)
        +criar(dados)
        +atualizar(id, dados)
        +deletar(id)
        +incrementar_partidas(id, delta)
        +obter_avaliacoes(id)
    }

    class ChatRepository {
        +listar_mensagens(partida_id)
        +salvar_mensagem(partida_id, usuario_id, nome, texto)
        +buscar_mensagem_por_id(id)
    }

    PartidaController ..> PartidaRepository : usa
    UsuarioController ..> UsuarioRepository : usa
    ChatController ..> ChatRepository : usa


## Diagrama de Entidades do Banco de Dados

    USUARIO {
        int id PK
        varchar nome
        varchar email UK
        varchar senha_hash
        varchar telefone
        varchar cidade
        varchar foto_perfil
        varchar esportes_favoritos
        text sobre
        varchar posicao_preferida
        tinyint ativo
        int partidas_jogadas
        int presencas
        int faltas
    }

    PARTIDA {
        int id PK
        varchar titulo
        varchar esporte
        varchar local
        varchar data_hora
        varchar horario
        int vagas
        int usuario_id FK
        tinyint ativo
    }

    PARTIDA_PARTICIPANTE {
        int id PK
        int partida_id FK
        int usuario_id FK
        datetime data_inscricao
    }

    MENSAGEM_CHAT {
        int id PK
        int partida_id FK
        int usuario_id FK
        text texto
        datetime criado_em
    }

    AVALIACAO {
        int id PK
        int partida_id FK
        int avaliador_id FK
        int avaliado_id FK
        int nota
        datetime criada_em
    }

    USUARIO ──< PARTIDA : "1-N (cria)"
    PARTIDA ──< PARTIDA_PARTICIPANTE : "1-N (possui inscrições)"
    USUARIO ──<PARTIDA_PARTICIPANTE : "1-N (realiza inscrição)"
    PARTIDA ──< MENSAGEM_CHAT : "1-N (armazena mensagens)"
    USUARIO ──< MENSAGEM_CHAT : "1-N (envia mensagens)"
    PARTIDA ──< AVALIACAO : "1-N (origina avaliações)"
    USUARIO ──< AVALIACAO : "1-N (faz como avaliador)"
    USUARIO ──< AVALIACAO : "1-N (recebe como avaliado)"

## Integrantes

- Caio Nunes Pereira
- Caio de Noronha Castro Arruda
- João Lucas Antunes Carvalho
- Victor Josias Parreiras Peluzo 
- João Vitor Santos Carvalho
- Davi Martins Dias Rabelo 