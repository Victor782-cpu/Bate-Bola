CREATE DATABASE IF NOT EXISTS batebola_db;
USE batebola_db;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    posicao_preferida VARCHAR(50),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organizador_id INT NOT NULL DEFAULT 1,
    titulo VARCHAR(100) NOT NULL,
    esporte VARCHAR(50) NOT NULL,
    local VARCHAR(150) NOT NULL,
    data_hora VARCHAR(50) NOT NULL,
    horario VARCHAR(20),
    vagas INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_partida_organizador FOREIGN KEY (organizador_id) 
        REFERENCES usuarios(id) ON DELETE CASCADE
);


INSERT IGNORE INTO usuarios (id, nome, email, senha_hash) 
VALUES (1, 'Organizador Teste', 'organizador@email.com', '123456');

DELIMITER //
DROP PROCEDURE IF EXISTS partidas_por_esporte //
CREATE PROCEDURE partidas_por_esporte(IN p_esporte VARCHAR(50))
BEGIN
    IF p_esporte IS NULL OR p_esporte = '' OR p_esporte = 'Todos' THEN
        SELECT 
            p.id, p.titulo, p.esporte, p.local, p.data_hora, p.horario, p.vagas, p.status, p.organizador_id,
            u.nome AS organizador_nome
        FROM partidas p
        INNER JOIN usuarios u ON p.organizador_id = u.id
        WHERE p.ativo = TRUE
        ORDER BY p.id ASC;
    ELSE
        SELECT 
            p.id, p.titulo, p.esporte, p.local, p.data_hora, p.horario, p.vagas, p.status, p.organizador_id,
            u.nome AS organizador_nome
        FROM partidas p
        INNER JOIN usuarios u ON p.organizador_id = u.id
        WHERE LOWER(p.esporte) = LOWER(p_esporte) AND p.ativo = TRUE
        ORDER BY p.id ASC;
    END IF;
END //
DELIMITER ;