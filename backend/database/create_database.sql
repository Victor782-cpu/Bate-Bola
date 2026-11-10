-- ==========================================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS BATEBOLA (MYSQL)
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS batebola_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE batebola_db;

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    cidade VARCHAR(100) DEFAULT 'Belo Horizonte - MG',
    foto_perfil LONGTEXT,
    esportes_favoritos VARCHAR(255) DEFAULT 'Futebol, Basquete',
    sobre TEXT,
    posicao_preferida VARCHAR(50) DEFAULT 'Jogador',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    partidas_jogadas INT NOT NULL DEFAULT 0,
    presencas INT NOT NULL DEFAULT 0,
    faltas INT NOT NULL DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Partidas
CREATE TABLE IF NOT EXISTS partidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL DEFAULT 'Partida',
    esporte VARCHAR(50) NOT NULL,
    local VARCHAR(150) NOT NULL,
    data_hora VARCHAR(50) NOT NULL,
    horario VARCHAR(20),
    vagas INT NOT NULL DEFAULT 10,
    usuario_id INT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_partida_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 3. Tabela de Participantes das Partidas
CREATE TABLE IF NOT EXISTS partida_participantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partida_id INT NOT NULL,
    usuario_id INT NOT NULL,
    data_inscricao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_partida_participante UNIQUE (partida_id, usuario_id),
    CONSTRAINT fk_part_partida FOREIGN KEY (partida_id) 
        REFERENCES partidas(id) ON DELETE CASCADE,
    CONSTRAINT fk_part_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 4. Tabela de Mensagens do Chat
CREATE TABLE IF NOT EXISTS mensagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partida_id INT NOT NULL,
    usuario_id INT,
    nome_usuario VARCHAR(100) NOT NULL,
    texto TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_partida FOREIGN KEY (partida_id) 
        REFERENCES partidas(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 5. Tabela de Avaliações entre Jogadores
CREATE TABLE IF NOT EXISTS avaliacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partida_id INT NOT NULL,
    avaliador_id INT NOT NULL,
    avaliado_id INT NOT NULL,
    nota INT NOT NULL,
    criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_avaliacao_partida_jogadores UNIQUE (partida_id, avaliador_id, avaliado_id),
    CONSTRAINT fk_aval_partida FOREIGN KEY (partida_id) 
        REFERENCES partidas(id) ON DELETE CASCADE,
    CONSTRAINT fk_aval_avaliador FOREIGN KEY (avaliador_id) 
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_aval_avaliado FOREIGN KEY (avaliado_id) 
        REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Inserção de usuário padrão para testes
INSERT INTO usuarios (id, nome, email, senha_hash, telefone, cidade, posicao_preferida, ativo) 
VALUES (1, 'Jogador Teste', 'teste@email.com', '123456', '(31) 99999-8888', 'Belo Horizonte - MG', 'Atacante', TRUE)
ON DUPLICATE KEY UPDATE nome = VALUES(nome);
