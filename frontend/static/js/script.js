const API_URL = "http://127.0.0.1:5001";

let todasPartidasCache = [];
let calDataAtual = new Date();
let calDiaSelecionado = null;

function obterDataIsoLocal(date = new Date()) {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

(function () {
    try {
        const temaSalvo = localStorage.getItem("batebola_theme");
        const prefereEscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (temaSalvo === "dark" || (!temaSalvo && prefereEscuro)) {
            document.documentElement.setAttribute("data-theme", "dark");
        }
    } catch (e) {}
})();

document.addEventListener("DOMContentLoaded", () => {
    configurarModoEscuro();
    configurarAvaliacaoSite();

    const usuarioLogado = obterUsuarioLogado();
    const path = window.location.pathname.toLowerCase();

    const paginasRestritas = ["perfil.html", "historico.html"];
    const ehPaginaRestrita = paginasRestritas.some(pagina => path.endsWith(pagina));

    if (!usuarioLogado && ehPaginaRestrita) {
        window.location.href = "login.html";
        return;
    }

    if (usuarioLogado && path.endsWith("login.html")) {
        window.location.href = "perfil.html";
        return;
    }

    const menuButtons = document.querySelectorAll(".menu-toggle");
    const sidebar = document.querySelector(".sidebar");

    if (sidebar && menuButtons.length > 0) {
        menuButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                sidebar.classList.toggle("open");
            });
        });
    }

    const containerPartidas = document.getElementById("container-partidas");
    if (containerPartidas) {
        const urlParams = new URLSearchParams(window.location.search);
        const esporteURL = urlParams.get("esporte") || "Todos";

        marcarPillAtiva(esporteURL);
        carregarPartidas(esporteURL);
        configurarFiltros();
    }

    const containerHistorico = document.getElementById("container-historico");
    if (containerHistorico && usuarioLogado) {
        carregarHistoricoPartidas(usuarioLogado);
    }

    if (usuarioLogado) {
        carregarPerfil(usuarioLogado.id);
    }

    configurarAvatarAnonimo();
    configurarAcoesGlobais();
    configurarAuth();
    configurarLinksAlternanciaAuth();
    configurarModalAvaliacao();

    if (typeof configurarModal === "function") {
        configurarModal();
    }

    if (document.getElementById("modal-editar-perfil")) {
        configurarModalEditarPerfil(usuarioLogado);
    }
});

function configurarAvaliacaoSite() {
    const chaveAvaliacao = "avaliacao_site_batebola";
    let avaliacoes = [];

    try {
        const dadosSalvos = JSON.parse(localStorage.getItem(chaveAvaliacao) || "null");
        if (Array.isArray(dadosSalvos?.avaliacoes)) {
            avaliacoes = dadosSalvos.avaliacoes.filter(avaliacao =>
                Number.isInteger(avaliacao.estrelas) &&
                avaliacao.estrelas >= 1 &&
                avaliacao.estrelas <= 5
            ).slice(0, 3);
        } else if (Number.isInteger(dadosSalvos?.estrelas) &&
                   dadosSalvos.estrelas >= 1 &&
                   dadosSalvos.estrelas <= 5) {
            avaliacoes = [{
                estrelas: dadosSalvos.estrelas,
                enviadaEm: dadosSalvos.enviadaEm
            }];
        }
    } catch (error) {
        console.error("Não foi possível carregar as avaliações salvas:", error);
    }

    const widget = document.createElement("section");
    widget.className = "site-rating-widget";
    widget.setAttribute("aria-label", "Avaliação do site");
    widget.innerHTML = `
        <div class="site-rating-panel" id="site-rating-panel" aria-hidden="true">
            <button class="site-rating-close" type="button" aria-label="Fechar avaliação">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h2>Avalie sua experiência</h2>
            <p>Como foi sua experiência com o BateBola?</p>
            <div class="site-rating-stars" role="group" aria-label="Escolha uma nota de 1 a 5 estrelas">
                ${Array.from({ length: 5 }, (_, index) => `
                    <button type="button" class="site-rating-star" data-rating="${index + 1}"
                            aria-label="${index + 1} ${index === 0 ? "estrela" : "estrelas"}" aria-pressed="false">
                        <i class="fa-regular fa-star" aria-hidden="true"></i>
                    </button>
                `).join("")}
            </div>
            <p class="site-rating-error" role="alert" hidden></p>
            <button class="site-rating-submit" type="button" disabled>Enviar avaliação</button>
        </div>
        <div class="site-rating-status"></div>
    `;
    document.body.appendChild(widget);

    const painel = widget.querySelector(".site-rating-panel");
    const botaoFechar = widget.querySelector(".site-rating-close");
    const botaoEnviar = widget.querySelector(".site-rating-submit");
    const mensagemErro = widget.querySelector(".site-rating-error");
    let notaSelecionada = 0;
    let timerMensagem;
    let timerRemocaoMensagem;

    const mostrarToastAvaliacao = (estrelas) => {
        const estrelinhas = "⭐".repeat(Math.min(estrelas, 5));
        const toast = document.createElement("div");
        toast.className = "site-rating-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.innerHTML = `
            <div class="site-rating-toast-icon">
                <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            </div>
            <div class="site-rating-toast-content">
                <h4>Obrigado pela avaliação! ${estrelinhas}</h4>
                <p>Sua opinião nos ajuda a melhorar o BateBola.</p>
            </div>
        `;
        document.body.appendChild(toast);
        void toast.offsetWidth;
        toast.classList.add("is-visible");
        setTimeout(() => {
            toast.classList.add("is-leaving");
            toast.classList.remove("is-visible");
            setTimeout(() => toast.remove(), 450);
        }, 3500);
    };

    const renderizarStatus = () => {
        window.clearTimeout(timerMensagem);
        window.clearTimeout(timerRemocaoMensagem);
        const status = widget.querySelector(".site-rating-status");
        if (avaliacoes.length === 0) {
            widget.style.display = "";
            status.innerHTML = `
                <button class="btn-primary site-rating-trigger" type="button"
                        aria-expanded="false" aria-controls="site-rating-panel">
                    <i class="fa-solid fa-star" aria-hidden="true"></i> Avalie-nos
                </button>
            `;
        } else {
            widget.style.display = "none";
        }
    };

    const fecharPainel = () => {
        widget.classList.remove("is-open");
        const botaoAbrir = widget.querySelector(".site-rating-trigger, .site-rating-again");
        if (botaoAbrir) botaoAbrir.setAttribute("aria-expanded", "false");
        painel.setAttribute("aria-hidden", "true");
    };

    widget.addEventListener("click", event => {
        const botaoAbrir = event.target.closest(".site-rating-trigger, .site-rating-again");
        if (!botaoAbrir) return;

        widget.classList.add("is-open");
        botaoAbrir.setAttribute("aria-expanded", "true");
        painel.setAttribute("aria-hidden", "false");
        notaSelecionada = 0;
        widget.querySelectorAll(".site-rating-star").forEach(estrela => {
            estrela.classList.remove("is-selected");
            estrela.setAttribute("aria-pressed", "false");
            estrela.querySelector("i").className = "fa-regular fa-star";
        });
        botaoEnviar.disabled = true;
        mensagemErro.hidden = true;
        widget.querySelector(".site-rating-star").focus();
    });

    botaoFechar.addEventListener("click", fecharPainel);

    widget.querySelectorAll(".site-rating-star").forEach(botao => {
        botao.addEventListener("click", () => {
            notaSelecionada = Number(botao.dataset.rating);
            widget.querySelectorAll(".site-rating-star").forEach(estrela => {
                const selecionada = Number(estrela.dataset.rating) <= notaSelecionada;
                estrela.classList.toggle("is-selected", selecionada);
                estrela.setAttribute("aria-pressed", String(Number(estrela.dataset.rating) === notaSelecionada));
                estrela.querySelector("i").className = `${selecionada ? "fa-solid" : "fa-regular"} fa-star`;
            });
            botaoEnviar.disabled = false;
            mensagemErro.hidden = true;
        });
    });

    botaoEnviar.addEventListener("click", () => {
        if (notaSelecionada < 1 || notaSelecionada > 5) return;
        if (avaliacoes.length >= 3) {
            fecharPainel();
            renderizarStatus();
            return;
        }

        const novasAvaliacoes = [...avaliacoes, {
            estrelas: notaSelecionada,
            enviadaEm: new Date().toISOString()
        }];

        try {
            localStorage.setItem(chaveAvaliacao, JSON.stringify({ avaliacoes: novasAvaliacoes }));
        } catch (error) {
            console.error("Não foi possível salvar a avaliação:", error);
            mensagemErro.textContent = "Não foi possível salvar sua avaliação. Tente novamente.";
            mensagemErro.hidden = false;
            return;
        }

        avaliacoes = novasAvaliacoes;
        fecharPainel();
        renderizarStatus();
        mostrarToastAvaliacao(notaSelecionada);
    });

    renderizarStatus();
}

document.addEventListener("click", (e) => {
    const btnLogout = e.target.closest("#btn-logout, .btn-logout, .fa-right-from-bracket, .fa-sign-out-alt");

    if (btnLogout) {
        e.preventDefault();
        fazerLogout();
    }
});

async function fazerLogout() {
    try {
        await fetch(`${API_URL}/logout`, { method: "POST" });
    } catch (e) {
        console.warn("Aviso no logout na API:", e);
    } finally {
        localStorage.removeItem("usuario_batebola");
        sessionStorage.clear();
        window.location.href = "login.html";
    }
}

function configurarAvatarAnonimo() {
    const avatarContainer = document.querySelector(".avatar-container");
    if (avatarContainer && !avatarContainer.querySelector("img") && !avatarContainer.querySelector("i")) {
        avatarContainer.innerHTML = `<i class="fa-solid fa-user-large avatar-placeholder"></i>`;
    }
}

function obterUsuarioLogado() {
    try {
        const item = localStorage.getItem("usuario_batebola");
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error("Erro ao ler localStorage:", e);
        return null;
    }
}

function selecionarEsporte(esporte) {
    window.location.href = `partidas.html?esporte=${encodeURIComponent(esporte)}`;
}

function configurarAcoesGlobais() {

    document.addEventListener("click", (e) => {
        const btnDeletar = e.target.closest("#btn-deletar-perfil, .btn-deletar-perfil");
        if (btnDeletar) {
            e.preventDefault();
            const usuarioLogado = obterUsuarioLogado();
            if (usuarioLogado && usuarioLogado.id) {
                deletarPerfil(usuarioLogado.id);
            } else {
                alert("Sessão inválida. Por favor, faça login novamente.");
            }
        }
    });
}

function configurarLinksAlternanciaAuth() {
    const linkCadastro = document.getElementById("btn-mudar-cadastro") || document.getElementById("link-ir-cadastro");
    const linkLogin = document.getElementById("btn-mudar-login") || document.getElementById("link-ir-login");

    if (linkCadastro) {
        linkCadastro.addEventListener("click", (e) => {
            e.preventDefault();
            alternarAuthForms('cadastro');
        });
    }

    if (linkLogin) {
        linkLogin.addEventListener("click", (e) => {
            e.preventDefault();
            alternarAuthForms('login');
        });
    }
}

function alternarAuthForms(tipo) {
    const formLogin = document.getElementById("loginForm") || document.getElementById("form-login");
    const formCadastro = document.getElementById("cadastroForm") || document.getElementById("form-cadastro");

    if (!formLogin || !formCadastro) return;

    if (tipo === 'cadastro') {
        formLogin.style.display = 'none';
        formCadastro.style.display = 'flex';
    } else {
        formCadastro.style.display = 'none';
        formLogin.style.display = 'flex';
    }
}

async function carregarPerfil(usuarioId) {
    try {
        const response = await fetch(`${API_URL}/perfil/${usuarioId}`);
        if (!response.ok) throw new Error("Erro ao buscar perfil");

        const usuario = await response.json();

        const elNome = document.getElementById("user-display-name") || document.querySelector(".user-name-row h2");
        const elCidadeTexto = document.querySelector(".location span");
        const elSobre = document.getElementById("user-about-text") || document.querySelector(".about-section p");
        const elPartidas = document.getElementById("stat-partidas");
        const elPresencas = document.getElementById("stat-presencas");
        const elFaltas = document.getElementById("stat-faltas");
        const elNotaMedia = document.getElementById("profile-rating-average");
        const containerAvaliacoes = document.getElementById("profile-ratings-list");
        const avatarContainer = document.querySelector(".avatar-container");
        const containerEsportes = document.querySelector(".sports-tags");

        if (elNome) elNome.textContent = usuario.nome || "Usuário";
        if (elCidadeTexto) elCidadeTexto.textContent = usuario.cidade || "Localização não informada";
        if (elSobre) elSobre.textContent = usuario.sobre || "Nenhum detalhe informado sobre o jogador.";
        if (elPartidas) elPartidas.textContent = usuario.partidas_jogadas ?? 0;
        if (elPresencas) elPresencas.textContent = usuario.presencas ?? 0;
        if (elFaltas) elFaltas.textContent = usuario.faltas ?? 0;


        if (avatarContainer) {
            if (usuario.foto_perfil) {
                avatarContainer.innerHTML = `<img src="${usuario.foto_perfil}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                avatarContainer.innerHTML = `<i class="fa-solid fa-user-large avatar-placeholder"></i>`;
            }
        }

        if (containerEsportes && usuario.esportes_favoritos) {
            containerEsportes.innerHTML = "";
            const esportesArray = usuario.esportes_favoritos.split(",").map(e => e.trim());
            esportesArray.forEach(esporte => {
                if (esporte) {
                    containerEsportes.innerHTML += `<span class="sport-tag"><i class="fa-solid fa-medal"></i> ${esporte}</span>`;
                }
            });
        }

        if (elNotaMedia) {
            elNotaMedia.textContent = usuario.nota_media === null || usuario.nota_media === undefined
                ? "Sem avaliações"
                : `${Number(usuario.nota_media).toFixed(1)} / 5`;
        }

        if (containerAvaliacoes) {
            containerAvaliacoes.replaceChildren();
            if (!Array.isArray(usuario.avaliacoes) || usuario.avaliacoes.length === 0) {
                const vazio = document.createElement("p");
                vazio.className = "profile-ratings-empty";
                vazio.textContent = "Este jogador ainda não recebeu avaliações.";
                containerAvaliacoes.appendChild(vazio);
            } else {
                usuario.avaliacoes.forEach(avaliacao => {
                    const item = document.createElement("article");
                    item.className = "profile-rating-item";

                    const autor = document.createElement("strong");
                    autor.className = "profile-rating-author";
                    autor.textContent = avaliacao.avaliador || "Jogador";

                    const nota = document.createElement("span");
                    nota.className = "profile-rating-stars";
                    nota.setAttribute("aria-label", `Nota ${avaliacao.nota} de 5`);
                    nota.textContent = `${"★".repeat(avaliacao.nota)}${"☆".repeat(5 - avaliacao.nota)}`;

                    const data = document.createElement("time");
                    data.className = "profile-rating-date";
                    if (avaliacao.criada_em) {
                        const dataAvaliacao = new Date(avaliacao.criada_em);
                        if (!Number.isNaN(dataAvaliacao.getTime())) {
                            data.dateTime = avaliacao.criada_em;
                            data.textContent = dataAvaliacao.toLocaleDateString("pt-BR");
                        }
                    }

                    item.append(autor, nota, data);
                    containerAvaliacoes.appendChild(item);
                });
            }
        }

    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

function configurarModalEditarPerfil(usuarioLogado) {
    const modal = document.getElementById("modal-editar-perfil");
    const btnAbrir = document.getElementById("btn-abrir-editar-perfil") || document.querySelector(".btn-edit-profile");
    const btnCancelar = document.getElementById("btn-cancelar-editar-perfil");
    const form = document.getElementById("form-editar-perfil");

    if (!modal || !btnAbrir) return;

    btnAbrir.onclick = async () => {
        try {
            const response = await fetch(`${API_URL}/perfil/${usuarioLogado.id}`);
            if (response.ok) {
                const usuario = await response.json();
                if (document.getElementById("input-edit-nome")) document.getElementById("input-edit-nome").value = usuario.nome || "";
                if (document.getElementById("input-edit-cidade")) document.getElementById("input-edit-cidade").value = usuario.cidade || "";
                if (document.getElementById("input-edit-esportes")) document.getElementById("input-edit-esportes").value = usuario.esportes_favoritos || "";
                if (document.getElementById("input-edit-sobre")) document.getElementById("input-edit-sobre").value = usuario.sobre || "";
            }
        } catch (e) {
            console.error("Erro ao carregar dados para edição", e);
        }

        modal.classList.add("active");
    };

    const fecharModal = () => {
        modal.classList.remove("active");
    };

    if (btnCancelar) btnCancelar.onclick = fecharModal;

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const inputFoto = document.getElementById("input-edit-foto");
            let base64Foto = null;

            if (inputFoto && inputFoto.files && inputFoto.files[0]) {
                const reader = new FileReader();
                base64Foto = await new Promise((resolve) => {
                    reader.onload = (uploadEvent) => resolve(uploadEvent.target.result);
                    reader.readAsDataURL(inputFoto.files[0]);
                });
            }

            const dadosAtualizados = {
                nome: document.getElementById("input-edit-nome")?.value || "",
                cidade: document.getElementById("input-edit-cidade")?.value || "",
                esportes_favoritos: document.getElementById("input-edit-esportes")?.value || "",
                sobre: document.getElementById("input-edit-sobre")?.value || ""
            };

            if (base64Foto) {
                dadosAtualizados.foto_perfil = base64Foto;
            }

            if (usuarioLogado) {
                try {
                    const response = await fetch(`${API_URL}/perfil/${usuarioLogado.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(dadosAtualizados)
                    });

                    if (response.ok) {
                        const usuarioAtualizado = await response.json();

                        const sessaoLocal = obterUsuarioLogado();
                        if (sessaoLocal) {
                            sessaoLocal.nome = usuarioAtualizado.nome || dadosAtualizados.nome;
                            localStorage.setItem("usuario_batebola", JSON.stringify(sessaoLocal));
                        }

                        await carregarPerfil(usuarioLogado.id);
                        alert("Perfil atualizado com sucesso!");
                    } else {
                        alert("Erro ao atualizar o perfil no servidor.");
                    }
                } catch (error) {
                    console.error("Erro na API ao atualizar perfil:", error);
                    alert("Erro de conexão ao tentar atualizar.");
                }
            }

            fecharModal();
        };
    }
}

async function deletarPerfil(usuarioId) {
    if (!confirm("Tem certeza que deseja excluir permanentemente sua conta?")) return;

    try {
        const response = await fetch(`${API_URL}/perfil/${usuarioId}`, { method: "DELETE" });
        if (response.ok) {
            alert("Sua conta foi excluída com sucesso.");
            localStorage.removeItem("usuario_batebola");
            sessionStorage.clear();
            window.location.href = "login.html";
        } else {
            const erro = await response.json();
            alert(erro.erro || "Erro ao excluir conta.");
        }
    } catch (error) {
        console.error("Erro na exclusão:", error);
        alert("Erro de conexão ao tentar excluir a conta.");
    }
}

function configurarAuth() {
    const formLogin = document.getElementById("loginForm") || document.getElementById("form-login");
    const formCadastro = document.getElementById("cadastroForm") || document.getElementById("form-cadastro");

    if (formLogin) {
        formLogin.onsubmit = async (e) => {
            e.preventDefault();
            const email = (document.getElementById("email") || document.getElementById("login-email"))?.value;
            const senha = (document.getElementById("senha") || document.getElementById("login-senha"))?.value;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, senha })
                });

                const data = await response.json();

                if (response.ok) {
                    const usuario = data.usuario || data;
                    localStorage.setItem("usuario_batebola", JSON.stringify(usuario));
                    window.location.href = "perfil.html";
                } else {
                    alert(data.erro || "E-mail ou senha inválidos.");
                }
            } catch (err) {
                console.error("Erro no login:", err);
                alert("Erro ao conectar com o servidor.");
            }
        };
    }

    if (formCadastro) {
        formCadastro.onsubmit = async (e) => {
            e.preventDefault();
            const dados = {
                nome: (document.getElementById("cad-nome"))?.value,
                email: (document.getElementById("cad-email"))?.value,
                cidade: (document.getElementById("cad-cidade"))?.value?.trim() || "Belo Horizonte - MG",
                senha: (document.getElementById("cad-senha"))?.value
            };

            try {
                const response = await fetch(`${API_URL}/usuarios`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(dados)
                });

                const resultado = await response.json();

                if (response.ok) {
                    const usuario = resultado.usuario || resultado;
                    localStorage.setItem("usuario_batebola", JSON.stringify(usuario));
                    alert("Conta criada com sucesso!");
                    window.location.href = "perfil.html";
                } else {
                    alert(resultado.erro || "Erro ao criar conta.");
                }
            } catch (err) {
                console.error("Erro no cadastro:", err);
                alert("Erro de conexão ao tentar cadastrar.");
            }
        };
    }
}

function formatarDataExibicao(dataIso) {
    if (!dataIso) return "Data não informada";
    const partes = dataIso.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataIso;
}

function verificarPartidaRealizada(dataIso, horario) {
    if (!dataIso) return false;
    const hora = horario || "23:59";
    const dataHoraPartida = new Date(`${dataIso}T${hora}:00`);
    return !isNaN(dataHoraPartida.getTime()) && dataHoraPartida < new Date();
}

async function carregarPartidas(esporteFiltro = "Todos") {
    const container = document.getElementById("container-partidas");
    if (!container) return;

    container.innerHTML = `<p style="grid-column: 1/-1; color: #64748b;">Carregando partidas...</p>`;

    try {
        const response = await fetch(`${API_URL}/partidas`);
        if (!response.ok) throw new Error("Erro na API");

        todasPartidasCache = await response.json();
        if (!Array.isArray(todasPartidasCache)) {
            todasPartidasCache = [];
        }

        if (esporteFiltro && esporteFiltro !== "Todos") {
            marcarPillAtiva(esporteFiltro);
        }

        aplicarFiltrosPartidas();
    } catch (error) {
        console.error("Erro no GET:", error);
        container.innerHTML = `<p style="grid-column: 1/-1; color: #ef4444;">Erro ao carregar partidas.</p>`;
    }
}

function aplicarFiltrosPartidas() {
    const container = document.getElementById("container-partidas");
    if (!container) return;

    const pillAtiva = document.querySelector(".sport-pills .pill.active");
    const esporteFiltro = pillAtiva ? pillAtiva.getAttribute("data-esporte") : "Todos";

    const selectData = document.getElementById("filter-data");
    const valorData = selectData ? selectData.value : "todos";

    const selectLocal = document.getElementById("filter-local");
    const valorLocal = selectLocal ? selectLocal.value : "todos";

    const hoje = new Date();
    const hojeIso = obterDataIsoLocal(hoje);

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const amanhaIso = obterDataIsoLocal(amanha);

    const fimSemana = new Date();
    fimSemana.setDate(fimSemana.getDate() + 7);
    const fimSemanaIso = obterDataIsoLocal(fimSemana);

    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const primeiroDiaMesIso = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`;
    const ultimoDiaMesNum = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const ultimoDiaMesIso = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(ultimoDiaMesNum).padStart(2, '0')}`;

    let partidasFiltradas = todasPartidasCache.filter(partida => {

        if (verificarPartidaRealizada(partida.data_hora, partida.horario)) {
            return false;
        }

        if (esporteFiltro && esporteFiltro !== "Todos") {
            if (!partida.esporte || partida.esporte.toLowerCase() !== esporteFiltro.toLowerCase()) {
                return false;
            }
        }

        if (calDiaSelecionado) {
            if (partida.data_hora !== calDiaSelecionado) {
                return false;
            }
        } else if (valorData === "hoje") {
            if (partida.data_hora !== hojeIso) return false;
        } else if (valorData === "amanha") {
            if (partida.data_hora !== amanhaIso) return false;
        } else if (valorData === "semana") {
            if (partida.data_hora < hojeIso || partida.data_hora > fimSemanaIso) return false;
        } else if (valorData === "mes") {
            if (partida.data_hora < primeiroDiaMesIso || partida.data_hora > ultimoDiaMesIso) return false;
        }

        if (valorLocal && valorLocal !== "todos") {
            const localTexto = (partida.local || "").toLowerCase();
            if (valorLocal === "SP") {
                const ehSP = localTexto.includes("sp") || localTexto.includes("são paulo") || localTexto.includes("sao paulo");
                if (!ehSP) return false;
            } else if (valorLocal === "RJ") {
                const ehRJ = localTexto.includes("rj") || localTexto.includes("rio de janeiro");
                if (!ehRJ) return false;
            } else if (valorLocal === "MG") {
                const ehMG = localTexto.includes("mg") || localTexto.includes("minas gerais") || localTexto.includes("belo horizonte") || localTexto.includes("cotemig");
                if (!ehMG) return false;
            } else if (valorLocal === "ES") {
                const ehES = localTexto.includes("es") || localTexto.includes("espírito santo") || localTexto.includes("espirito santo") || localTexto.includes("vitória") || localTexto.includes("vitoria");
                if (!ehES) return false;
            }
        }

        return true;
    });

    container.innerHTML = "";

    if (partidasFiltradas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem;">
                <p style="color: #64748b; font-size: 1rem; margin-bottom: 1rem;">Nenhuma partida encontrada para os filtros selecionados.</p>
                <button type="button" class="btn-primary" style="width: auto; padding: 0.6rem 1.2rem; display: inline-flex; margin: 0 auto;" onclick="limparTodosFiltros()">Limpar Filtros</button>
            </div>
        `;
        renderizarCalendario(todasPartidasCache);
        return;
    }

    const partidasFavoritas = obterPartidasFavoritas();
    partidasFiltradas.sort((partidaA, partidaB) =>
        Number(partidasFavoritas.has(String(partidaB.id))) -
        Number(partidasFavoritas.has(String(partidaA.id)))
    );

    partidasFiltradas.forEach(partida => {
        const favorita = partidasFavoritas.has(String(partida.id));
        container.appendChild(criarCardPartida(partida, favorita));
    });

    renderizarCalendario(todasPartidasCache);
}

function limparTodosFiltros() {
    calDiaSelecionado = null;
    const selectData = document.getElementById("filter-data");
    if (selectData) selectData.value = "todos";

    const selectLocal = document.getElementById("filter-local");
    if (selectLocal) selectLocal.value = "todos";

    const pills = document.querySelectorAll(".sport-pills .pill");
    pills.forEach(p => p.classList.remove("active"));
    const pillTodos = document.querySelector('.sport-pills .pill[data-esporte="Todos"]');
    if (pillTodos) pillTodos.classList.add("active");

    const novaUrl = window.location.pathname;
    window.history.pushState({ path: novaUrl }, '', novaUrl);

    aplicarFiltrosPartidas();
}

function renderizarCalendario(partidas = []) {
    const elMesAno = document.getElementById("cal-mes-ano");
    const grid = document.getElementById("cal-grid");
    if (!elMesAno || !grid) return;

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const ano = calDataAtual.getFullYear();
    const mes = calDataAtual.getMonth();

    elMesAno.textContent = `${meses[mes]} ${ano}`;

    const datasComPartidas = new Set(
        partidas.map(p => p.data_hora).filter(Boolean)
    );

    const nomesDias = ["D", "S", "T", "Q", "Q", "S", "S"];
    grid.innerHTML = "";
    nomesDias.forEach(nome => {
        const span = document.createElement("span");
        span.className = "day-name";
        span.textContent = nome;
        grid.appendChild(span);
    });

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();


    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
        const span = document.createElement("span");
        span.className = "day dimmed";
        span.textContent = String(totalDiasMesAnterior - i);
        grid.appendChild(span);
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const span = document.createElement("span");
        span.className = "day";
        span.textContent = String(dia);

        const dataIsoDia = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

        if (datasComPartidas.has(dataIsoDia)) {
            span.classList.add("has-match");
            span.title = "Partida disponível neste dia";
        }

        if (calDiaSelecionado === dataIsoDia) {
            span.classList.add("selected");
        }

        span.addEventListener("click", () => {
            if (calDiaSelecionado === dataIsoDia) {
                calDiaSelecionado = null;
            } else {
                calDiaSelecionado = dataIsoDia;
                const selectData = document.getElementById("filter-data");
                if (selectData) selectData.value = "todos";
            }
            aplicarFiltrosPartidas();
        });

        grid.appendChild(span);
    }

    const totalItens = primeiroDiaSemana + totalDiasMes;
    const diasRestantes = totalItens % 7 === 0 ? 0 : 7 - (totalItens % 7);
    for (let dia = 1; dia <= diasRestantes; dia++) {
        const span = document.createElement("span");
        span.className = "day dimmed";
        span.textContent = String(dia);
        grid.appendChild(span);
    }
}

function obterChavePartidasFavoritas() {
    const usuarioLogado = obterUsuarioLogado();
    return `partidas_favoritas_${usuarioLogado ? usuarioLogado.id : "anonimo"}`;
}

function obterPartidasFavoritas() {
    const favoritas = JSON.parse(localStorage.getItem(obterChavePartidasFavoritas()) || "[]");
    return new Set(Array.isArray(favoritas) ? favoritas.map(String) : []);
}

function alternarFavorita(partidaId) {
    const container = document.getElementById("container-partidas");
    if (!container) return;

    const favoritas = obterPartidasFavoritas();
    const id = String(partidaId);
    if (favoritas.has(id)) {
        favoritas.delete(id);
    } else {
        favoritas.add(id);
    }
    localStorage.setItem(obterChavePartidasFavoritas(), JSON.stringify(Array.from(favoritas)));

    const card = Array.from(container.querySelectorAll(".card-partida"))
        .find(item => item.dataset.partidaId === id);
    if (!card) return;

    const favorita = favoritas.has(id);
    card.dataset.favorita = String(favorita);

    const botao = card.querySelector(".btn-favoritar");
    if (botao) {
        botao.classList.toggle("favorito", favorita);
        botao.setAttribute("aria-pressed", String(favorita));
        botao.setAttribute("aria-label", favorita ? "Remover dos favoritos" : "Adicionar aos favoritos");
        botao.title = favorita ? "Remover dos favoritos" : "Adicionar aos favoritos";
        botao.innerHTML = `<i class="${favorita ? "fa-solid" : "fa-regular"} fa-star"></i>`;
    }

    Array.from(container.querySelectorAll(".card-partida"))
        .sort((cardA, cardB) =>
            Number(cardB.dataset.favorita === "true") -
            Number(cardA.dataset.favorita === "true")
        )
        .forEach(item => container.appendChild(item));
}

async function carregarHistoricoPartidas(usuarioLogado) {
    const container = document.getElementById("container-historico");
    if (!container) return;

    container.innerHTML = `<p style="grid-column: 1/-1; color: #64748b;">Carregando histórico...</p>`;

    try {
        const response = await fetch(`${API_URL}/partidas`);
        if (!response.ok) throw new Error("Erro ao buscar histórico");

        const partidas = await response.json();
        container.innerHTML = "";

        const inscricoesChave = `inscricoes_${usuarioLogado.id}`;
        const inscricoesLocais = JSON.parse(localStorage.getItem(inscricoesChave) || "[]");

        const historico = partidas.filter(partida => {
            const estaInscritoApi = Array.isArray(partida.participantes) && partida.participantes.some(p => {
                const pid = typeof p === 'object' && p !== null ? p.id : null;
                const pnome = typeof p === 'object' && p !== null ? p.nome : p;
                return (pid && Number(pid) === Number(usuarioLogado.id)) || (pnome && pnome.toLowerCase() === usuarioLogado.nome.toLowerCase());
            });
            const estaInscrito = inscricoesLocais.includes(Number(partida.id)) || estaInscritoApi;
            const ehCriador = partida.usuario_id && Number(partida.usuario_id) === Number(usuarioLogado.id);

            return estaInscrito || ehCriador;
        });

        if (!Array.isArray(historico) || historico.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; color: #64748b;">Você ainda não participou de nenhuma partida.</p>`;
            return;
        }

        historico.forEach(partida => container.appendChild(criarCardPartida(partida)));

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        container.innerHTML = `<p style="grid-column: 1/-1; color: #ef4444;">Erro ao carregar histórico de partidas.</p>`;
    }
}

function criarCardPartida(partida, favorita = null) {
    const card = document.createElement("div");
    card.className = "card-partida";
    card.dataset.partidaId = String(partida.id);
    if (favorita !== null) {
        card.dataset.favorita = String(favorita);
    }

    const usuarioLogado = obterUsuarioLogado();
    const inscricoesChave = usuarioLogado ? `inscricoes_${usuarioLogado.id}` : null;
    const inscricoes = usuarioLogado ? JSON.parse(localStorage.getItem(inscricoesChave) || "[]") : [];

    const estaInscritoApi = usuarioLogado && Array.isArray(partida.participantes) && partida.participantes.some(p => {
        const pid = typeof p === 'object' && p !== null ? p.id : null;
        const pnome = typeof p === 'object' && p !== null ? p.nome : p;
        return (pid && Number(pid) === Number(usuarioLogado.id)) || (pnome && pnome.toLowerCase() === usuarioLogado.nome.toLowerCase());
    });
    const estaInscrito = inscricoes.map(id => Number(id)).includes(Number(partida.id)) || estaInscritoApi;
    const jaRealizada = verificarPartidaRealizada(partida.data_hora, partida.horario);
    const ehDono = usuarioLogado && partida.usuario_id && Number(partida.usuario_id) === Number(usuarioLogado.id);

    const iconesEsporte = {
        "Futebol": "fa-futbol",
        "Futsal": "fa-futbol",
        "Basquete": "fa-basketball",
        "Vôlei": "fa-volleyball"
    };

    const iconeClass = iconesEsporte[partida.esporte] || "fa-trophy";

    const totalParticipantes = Array.isArray(partida.participantes) ? partida.participantes.length : 0;
    const vagasDisponiveis = partida.vagas !== undefined && partida.vagas !== null ? Number(partida.vagas) : 0;
    const vagasCheias = vagasDisponiveis <= 0;

    const botaoFavoritarHTML = favorita === null ? "" : `
        <button class="btn-icon btn-favoritar${favorita ? " favorito" : ""}"
                type="button"
                aria-label="${favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
                aria-pressed="${favorita}"
                title="${favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
                onclick="alternarFavorita(${partida.id})">
            <i class="${favorita ? "fa-solid" : "fa-regular"} fa-star"></i>
        </button>
    `;

    const acoesCriadorHTML = ehDono || botaoFavoritarHTML ? `
        <div class="card-header-actions">
            ${botaoFavoritarHTML}
            ${ehDono ? `
            <button class="btn-icon" onclick="prepararEdicao(${JSON.stringify(partida).replace(/"/g, '&quot;')})">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon delete" onclick="deletarPartida(${partida.id})">
                <i class="fa-solid fa-trash"></i>
            </button>
            ` : ""}
        </div>
    ` : `<div></div>`;

    let botaoHTML = "";
    if (jaRealizada) {
        botaoHTML = `
            <div style="display: flex; gap: 0.5rem; flex-direction: column;">
                <span style="text-align: center; color: #64748b; font-size: 0.85rem; font-weight: 600;">
                    <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Partida Realizada
                </span>
                <button class="btn-participar" style="background-color: #f59e0b;" onclick="abrirModalAvaliacao(${partida.id})">
                    <i class="fa-solid fa-star"></i> Avaliar Jogadores
                </button>
            </div>
        `;
    } else if (estaInscrito) {
        botaoHTML = `
            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button class="btn-participar" style="background-color: #2563eb; flex: 1; margin: 0;" onclick="window.location.href='chat.html?id=${partida.id}'">
                    <i class="fa-solid fa-comments"></i> Abrir Chat
                </button>
                <button class="btn-participar" style="background-color: #ef4444; width: 45px; min-width: 45px; padding: 0; display: flex; align-items: center; justify-content: center; margin: 0;" title="Cancelar Participação" onclick="cancelarParticipacao(${partida.id})">
                    <i class="fa-solid fa-user-minus"></i>
                </button>
            </div>
        `;
    } else {
        botaoHTML = `
            <button class="btn-participar" 
                    style="${vagasCheias ? 'background-color: #94a3b8; cursor: not-allowed;' : ''}"
                    onclick="participarPartida(${partida.id}, ${vagasCheias})">
                ${vagasCheias ? 'Vagas Esgotadas' : 'Participar'}
            </button>
        `;
    }

    card.innerHTML = `
        <div class="card-header">
            <div class="card-header-title">
                <i class="fa-solid ${iconeClass}"></i>
                <span>${partida.esporte}</span>
            </div>
            ${acoesCriadorHTML}
        </div>
        <div class="card-body">
            <div class="card-info">
                <i class="fa-regular fa-calendar"></i>
                <span>${formatarDataExibicao(partida.data_hora)}</span>
            </div>
            <div class="card-info">
                <i class="fa-solid fa-location-dot"></i>
                <span>${partida.local || 'Cotemig Barroca'}</span>
            </div>
            <div class="card-info">
                <i class="fa-regular fa-clock"></i>
                <span>${partida.horario || '00:00'}</span>
            </div>
            <div class="card-info">
                <i class="fa-solid fa-users"></i>
                <span>${vagasDisponiveis} ${vagasDisponiveis === 1 ? 'vaga restante' : 'vagas restantes'} (${totalParticipantes} participante${totalParticipantes === 1 ? '' : 's'})</span>
            </div>
        </div>
        <a class="card-map-container" 
           href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partida.local || 'Brasil')}" 
           target="_blank" 
           rel="noopener noreferrer"
           title="Ver ${partida.local} no Google Maps">
            <iframe 
                class="card-map-iframe"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                src="https://maps.google.com/maps?q=${encodeURIComponent(partida.local || 'Brasil')}&output=embed&z=15"
                title="Mapa: ${partida.local}">
            </iframe>
            <div class="card-map-overlay">
                <span class="card-map-btn">
                    <i class="fa-solid fa-map-location-dot"></i> Ver no Maps
                </span>
            </div>
        </a>
        ${botaoHTML}
    `;

    return card;
}

async function participarPartida(id, vagasCheias) {
    if (vagasCheias) {
        alert("Não é possível entrar: as vagas desta partida já estão esgotadas!");
        return;
    }

    const usuarioLogado = obterUsuarioLogado();
    
    if (!usuarioLogado) {
        alert("Você precisa estar logado para entrar na partida.");
        window.location.href = "login.html";
        return;
    }

    const inscricoesChave = `inscricoes_${usuarioLogado.id}`;
    let inscricoes = JSON.parse(localStorage.getItem(inscricoesChave) || "[]").map(n => Number(n));

    try {
        const response = await fetch(`${API_URL}/partidas/${id}/participar`, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ usuario_id: usuarioLogado.id, nome: usuarioLogado.nome })
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.erro || "Não foi possível entrar na partida.");
            return;
        }

        if (!inscricoes.includes(Number(id))) {
            inscricoes.push(Number(id));
            localStorage.setItem(inscricoesChave, JSON.stringify(inscricoes));
        }

        window.location.href = `chat.html?id=${id}`;
    } catch (error) {
        console.error("Erro ao registrar na API:", error);
        alert("Erro de conexão ao entrar na partida.");
    }
}

async function cancelarParticipacao(id) {
    if (!confirm("Tem certeza que deseja cancelar sua participação nesta partida?")) return;

    const usuarioLogado = obterUsuarioLogado();
    if (!usuarioLogado) return;

    const inscricoesChave = `inscricoes_${usuarioLogado.id}`;
    let inscricoes = JSON.parse(localStorage.getItem(inscricoesChave) || "[]").map(n => Number(n));

    try {
        const response = await fetch(`${API_URL}/partidas/${id}/cancelar-participacao`, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ usuario_id: usuarioLogado.id })
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.erro || "Não foi possível cancelar a participação.");
            return;
        }

        inscricoes = inscricoes.filter(partidaId => partidaId !== Number(id));
        localStorage.setItem(inscricoesChave, JSON.stringify(inscricoes));

        const urlParams = new URLSearchParams(window.location.search);
        const esporteAtual = urlParams.get("esporte") || "Todos";
        
        if (document.getElementById("container-partidas")) {
            carregarPartidas(esporteAtual);
        } else if (document.getElementById("container-historico")) {
            carregarHistoricoPartidas(usuarioLogado);
        }
    } catch (error) {
        console.error("Erro ao cancelar na API:", error);
        alert("Erro de conexão ao cancelar participação.");
    }
}

async function abrirModalAvaliacao(partidaId) {
    const usuarioLogado = obterUsuarioLogado();
    const modal = document.getElementById("modal-avaliar");
    const containerLista = document.getElementById("lista-jogadores-avaliar");

    if (!modal || !containerLista) return;

    containerLista.innerHTML = `<p style="color: #64748b;">Carregando participantes...</p>`;
    document.getElementById("partida-avaliar-id").value = partidaId;
    modal.classList.add("active");

    try {
        const response = await fetch(`${API_URL}/partidas/${partidaId}`);
        if (!response.ok) throw new Error("Erro ao carregar partida.");

        const partida = await response.json();
        let participantes = partida.participantes || [];

        if (usuarioLogado && usuarioLogado.nome) {
            participantes = participantes.filter(p => {
                const pId = typeof p === 'object' && p !== null ? p.id : null;
                const pNome = typeof p === 'object' && p !== null ? p.nome : p;
                if (pId && usuarioLogado.id) return Number(pId) !== Number(usuarioLogado.id);
                return pNome.toLowerCase() !== usuarioLogado.nome.toLowerCase();
            });
        }

        containerLista.innerHTML = "";

        if (participantes.length === 0) {
            containerLista.innerHTML = `<p style="color: #64748b;">Não há outros jogadores para avaliar nesta partida.</p>`;
            return;
        }

        participantes.forEach((p, index) => {
            const nome = typeof p === 'object' && p !== null ? p.nome : p;
            const jogadorId = typeof p === 'object' && p !== null ? p.id : "";
            const item = document.createElement("div");
            item.className = "player-eval-item";
            item.dataset.userId = jogadorId || "";
            item.innerHTML = `
                <span class="player-eval-name"><i class="fa-solid fa-user-check" style="color: var(--primary);"></i> ${nome}</span>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <select name="nota_${index}" class="player-eval-select" required>
                        <option value="5">5 ★★★★★</option>
                        <option value="4">4 ★★★★</option>
                        <option value="3">3 ★★★</option>
                        <option value="2">2 ★★</option>
                        <option value="1">1 ★</option>
                    </select>
                </div>
            `;
            containerLista.appendChild(item);
        });

    } catch (err) {
        console.error("Erro ao carregar participantes:", err);
        containerLista.innerHTML = `<p style="color: #ef4444;">Erro ao carregar lista de jogadores.</p>`;
    }
}

function configurarModalAvaliacao() {
    const modal = document.getElementById("modal-avaliar");
    const btnFechar = document.getElementById("btn-fechar-avaliar");
    const form = document.getElementById("form-avaliacao");

    if (!modal) return;

    if (btnFechar) {
        btnFechar.onclick = () => modal.classList.remove("active");
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const usuarioLogado = obterUsuarioLogado();
            const partidaId = document.getElementById("partida-avaliar-id")?.value;
            const itens = Array.from(document.querySelectorAll("#lista-jogadores-avaliar .player-eval-item"));
            const botaoEnviar = form.querySelector('button[type="submit"]');

            if (!usuarioLogado || !partidaId || itens.length === 0) {
                alert("Não há avaliações para enviar.");
                return;
            }

            if (botaoEnviar) botaoEnviar.disabled = true;
            try {
                for (const item of itens) {
                    const response = await fetch(`${API_URL}/usuarios/${item.dataset.userId}/avaliar`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            avaliador_id: usuarioLogado.id,
                            partida_id: Number(partidaId),
                            nota: Number(item.querySelector("select").value)
                        })
                    });
                    const resultado = await response.json();
                    if (!response.ok) throw new Error(resultado.erro || "Não foi possível registrar as avaliações.");
                }

                alert("Avaliações enviadas com sucesso! Obrigado pelo feedback.");
                modal.classList.remove("active");
            } catch (error) {
                alert(error.message || "Erro de conexão ao enviar as avaliações.");
            } finally {
                if (botaoEnviar) botaoEnviar.disabled = false;
            }
        };
    }
}

function configurarModal() {
    const modal = document.getElementById("modal-partida");
    const btnAbrir = document.getElementById("btn-abrir-modal");
    const btnFechar = document.getElementById("btn-fechar-modal");
    const btnCancelar = document.getElementById("btn-cancelar");
    const form = document.getElementById("form-partida");
    const inputData = document.getElementById("input-data");

    if (!modal || !btnAbrir) return;

    const abrirModal = () => {
        form.reset();
        document.getElementById("partida-id").value = "";
        document.getElementById("modal-titulo").textContent = "Criar Nova Partida";

        if (inputData) {
            const hoje = new Date().toISOString().split('T')[0];
            inputData.min = hoje;
        }

        modal.classList.add("active");
    };

    const fecharModal = () => {
        modal.classList.remove("active");
        form.reset();
    };

    btnAbrir.onclick = abrirModal;
    if (btnFechar) btnFechar.onclick = fecharModal;
    if (btnCancelar) btnCancelar.onclick = fecharModal;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("partida-id").value;
        const usuarioLogado = obterUsuarioLogado();

        const dataSelecionada = document.getElementById("input-data").value;
        
        const hojeIso = new Date().toISOString().split('T')[0];
        if (dataSelecionada < hojeIso) {
            alert("Não é possível criar partidas para datas que já passaram!");
            return;
        }

        const localInput = document.getElementById("input-local").value.trim();
        const estadoInput = document.getElementById("input-estado")?.value || "MG";
        const localFinal = !localInput.toUpperCase().includes(estadoInput)
            ? `${localInput} - ${estadoInput}`
            : localInput;

        const dados = {
            esporte: document.getElementById("input-esporte").value,
            local: localFinal,
            data_hora: dataSelecionada,
            horario: document.getElementById("input-horario").value,
            vagas: parseInt(document.getElementById("input-vagas").value),
            usuario_id: usuarioLogado ? usuarioLogado.id : null
        };

        try {
            const url = id ? `${API_URL}/partidas/${id}` : `${API_URL}/partidas`;
            const method = id ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });

            if (response.ok) {
                fecharModal();
                const urlParams = new URLSearchParams(window.location.search);
                const esporteAtual = urlParams.get("esporte") || "Todos";
                carregarPartidas(esporteAtual);
            } else {
                const erro = await response.json();
                alert(erro.erro || "Erro ao salvar a partida.");
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
        }
    };
}

function prepararEdicao(partida) {
    document.getElementById("partida-id").value = partida.id;
    document.getElementById("input-esporte").value = partida.esporte;

    let localVal = partida.local || "";
    const estadoSelect = document.getElementById("input-estado");
    if (estadoSelect) {
        if (localVal.includes(" - SP") || localVal.toUpperCase().endsWith("SP")) {
            estadoSelect.value = "SP";
            localVal = localVal.replace(/ - SP$/i, "").trim();
        } else if (localVal.includes(" - RJ") || localVal.toUpperCase().endsWith("RJ")) {
            estadoSelect.value = "RJ";
            localVal = localVal.replace(/ - RJ$/i, "").trim();
        } else if (localVal.includes(" - ES") || localVal.toUpperCase().endsWith("ES")) {
            estadoSelect.value = "ES";
            localVal = localVal.replace(/ - ES$/i, "").trim();
        } else if (localVal.includes(" - MG") || localVal.toUpperCase().endsWith("MG")) {
            estadoSelect.value = "MG";
            localVal = localVal.replace(/ - MG$/i, "").trim();
        }
    }
    document.getElementById("input-local").value = localVal;
    document.getElementById("input-data").value = partida.data_hora || "";
    document.getElementById("input-horario").value = partida.horario || "";
    document.getElementById("input-vagas").value = partida.vagas || "";

    const inputData = document.getElementById("input-data");
    if (inputData) {
        const hoje = new Date().toISOString().split('T')[0];
        inputData.min = hoje;
    }

    document.getElementById("modal-titulo").textContent = "Editar Partida";
    document.getElementById("modal-partida").classList.add("active");
}

async function deletarPartida(id) {
    if (!confirm("Tem certeza que deseja excluir esta partida?")) return;

    const usuarioLogado = obterUsuarioLogado();
    const urlParam = usuarioLogado ? `?usuario_id=${usuarioLogado.id}` : "";

    try {
        const response = await fetch(`${API_URL}/partidas/${id}${urlParam}`, { method: "DELETE" });
        if (response.ok) {
            const urlParams = new URLSearchParams(window.location.search);
            const esporteAtual = urlParams.get("esporte") || "Todos";
            carregarPartidas(esporteAtual);
        } else {
            const erro = await response.json();
            alert(erro.erro || "Erro ao excluir partida.");
        }
    } catch (error) {
        console.error("Erro no DELETE:", error);
    }
}

function configurarFiltros() {
    const pills = document.querySelectorAll(".sport-pills .pill");
    pills.forEach(pill => {
        pill.addEventListener("click", (e) => {
            const esporteSelecionado = e.target.getAttribute("data-esporte");
            pills.forEach(p => p.classList.remove("active"));
            e.target.classList.add("active");

            const novaUrl = `${window.location.pathname}?esporte=${encodeURIComponent(esporteSelecionado)}`;
            window.history.pushState({ path: novaUrl }, '', novaUrl);

            aplicarFiltrosPartidas();
        });
    });

    const selectData = document.getElementById("filter-data");
    if (selectData) {
        selectData.addEventListener("change", () => {
            calDiaSelecionado = null; 
            aplicarFiltrosPartidas();
        });
    }

    const selectLocal = document.getElementById("filter-local");
    if (selectLocal) {
        selectLocal.addEventListener("change", () => {
            aplicarFiltrosPartidas();
        });
    }

    const btnCalPrev = document.getElementById("btn-cal-prev");
    if (btnCalPrev) {
        btnCalPrev.addEventListener("click", () => {
            calDataAtual.setMonth(calDataAtual.getMonth() - 1);
            renderizarCalendario(todasPartidasCache);
        });
    }

    const btnCalNext = document.getElementById("btn-cal-next");
    if (btnCalNext) {
        btnCalNext.addEventListener("click", () => {
            calDataAtual.setMonth(calDataAtual.getMonth() + 1);
            renderizarCalendario(todasPartidasCache);
        });
    }

    const btnLimparCal = document.getElementById("btn-limpar-calendario");
    if (btnLimparCal) {
        btnLimparCal.addEventListener("click", (e) => {
            e.preventDefault();
            limparTodosFiltros();
        });
    }
}

function marcarPillAtiva(esporte) {
    const pills = document.querySelectorAll(".sport-pills .pill");
    pills.forEach(pill => {
        const valorPill = pill.getAttribute("data-esporte");
        if (valorPill && valorPill.toLowerCase() === esporte.toLowerCase()) {
            pill.classList.add("active");
        } else {
            pill.classList.remove("active");
        }
    });
}

let chatPollingInterval = null;
let idsMensagensExibidas = new Set();
let ultimaPartidaCarregada = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.toLowerCase().includes("chat.html")) return;

    const urlParams = new URLSearchParams(window.location.search);
    const partidaId = urlParams.get('id');
    const usuarioLogado = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;

    if (!partidaId) {
        alert("Nenhuma partida selecionada.");
        window.location.href = "partidas.html";
        return;
    }

    await carregarDetalhesPartida(partidaId, usuarioLogado);

    await carregarMensagensServidor(partidaId, usuarioLogado);

    iniciarPollingChat(partidaId, usuarioLogado);

    const btnSairChat = document.getElementById("btn-sair-partida-chat");
    if (btnSairChat) {
        btnSairChat.onclick = () => sairPartidaPeloChat(partidaId);
    }

    const formChat = document.getElementById("form-chat");
    const inputMensagem = document.getElementById("input-mensagem");

    if (formChat) {
        formChat.addEventListener("submit", async (e) => {
            e.preventDefault();
            const texto = inputMensagem.value.trim();
            if (!texto) return;

            if (!usuarioLogado) {
                alert("Você precisa estar logado para enviar mensagens no chat.");
                return;
            }

            inputMensagem.value = "";
            inputMensagem.focus();

            try {
                const response = await fetch(`${API_URL}/partidas/${partidaId}/mensagens`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: JSON.stringify({
                        usuario_id: usuarioLogado.id,
                        nome_usuario: usuarioLogado.nome,
                        texto: texto
                    })
                });

                if (!response.ok) {
                    const erro = await response.json();
                    alert(erro.erro || "Não foi possível enviar a mensagem.");
                    return;
                }

                const novaMsg = await response.json();
                adicionarMensagemAoContainer(novaMsg, usuarioLogado, true);
            } catch (err) {
                console.error("Erro ao enviar mensagem:", err);
                alert("Erro ao enviar mensagem. Tente novamente.");
            }
        });
    }

    window.addEventListener("beforeunload", () => {
        if (chatPollingInterval) clearInterval(chatPollingInterval);
    });
});

async function carregarDetalhesPartida(id, usuarioLogado) {
    try {
        const response = await fetch(`${API_URL}/partidas/${id}`);
        if (!response.ok) throw new Error("Erro ao carregar dados da partida");

        const partida = await response.json();
        ultimaPartidaCarregada = partida;

        const elEsporte = document.getElementById("nome-esporte");
        if (elEsporte) {
            elEsporte.textContent = (partida.esporte || "PARTIDA").toUpperCase();
        }

        const elPinned = document.getElementById("pinned-text");
        if (elPinned) {
            const dataFormatada = formatarDataExibicao(partida.data_hora);
            const horarioPartida = partida.horario || "00:00";
            const vagasTexto = partida.vagas !== undefined ? ` • ${partida.vagas} vaga(s) restante(s)` : "";
            elPinned.textContent = `${partida.esporte || 'Partida'} para ${dataFormatada} às ${horarioPartida} - Local: ${partida.local || 'Cotemig'}${vagasTexto}`;
        }

        const participantes = Array.isArray(partida.participantes) ? partida.participantes : [];
        renderizarParticipantes(participantes, partida.usuario_id, usuarioLogado);

    } catch (err) {
        console.error("Erro ao carregar dados da partida:", err);
    }
}

function renderizarParticipantes(lista, organizadorId, usuarioLogado) {
    const container = document.getElementById("lista-participantes");
    const contador = document.getElementById("contagem-participantes");
    if (!container) return;

    const total = Array.isArray(lista) ? lista.length : 0;
    if (contador) {
        contador.textContent = String(total);
    }

    container.innerHTML = "";

    if (!lista || lista.length === 0) {
        container.innerHTML = `<p class="empty-participants">Nenhum participante ainda.</p>`;
        return;
    }

    lista.forEach(item => {

        const id = (typeof item === "object" && item !== null) ? item.id : null;
        const nome = (typeof item === "object" && item !== null) ? (item.nome || "Jogador") : String(item);
        const foto = (typeof item === "object" && item !== null) ? item.foto_perfil : null;
        const posicao = (typeof item === "object" && item !== null) ? item.posicao_preferida : "";

        const ehCriador = organizadorId && id && Number(id) === Number(organizadorId);
        const ehEu = usuarioLogado && id && Number(id) === Number(usuarioLogado.id);

        const card = document.createElement("div");
        card.className = "participant-card";

        let fotoHtml = "";
        if (foto && typeof foto === "string" && foto.trim().length > 0) {
            fotoHtml = `<img src="${foto}" alt="${nome}" class="participant-avatar" onerror="this.onerror=null; this.outerHTML='<div class=\'participant-avatar-fallback\'><i class=\'fa-solid fa-user\'></i></div>';">`;
        } else {
            fotoHtml = `<div class="participant-avatar-fallback"><i class="fa-solid fa-user"></i></div>`;
        }

        card.innerHTML = `
            ${fotoHtml}
            <div class="participant-info">
                <span class="participant-name" title="${nome}">
                    ${nome}
                    ${ehEu ? '<small class="tag-voce">(Você)</small>' : ''}
                </span>
                ${ehCriador ? '<span class="tag-organizador">Organizador</span>' : (posicao ? `<span class="participant-role">${posicao}</span>` : '')}
            </div>
        `;

        container.appendChild(card);
    });
}

async function carregarMensagensServidor(partidaId, usuarioLogado) {
    try {
        const response = await fetch(`${API_URL}/partidas/${partidaId}/mensagens`);
        if (!response.ok) return;

        const mensagens = await response.json();
        const messagesContainer = document.getElementById("messages-container");
        if (!messagesContainer) return;

        messagesContainer.innerHTML = "";
        idsMensagensExibidas.clear();

        if (Array.isArray(mensagens)) {
            mensagens.forEach(msg => {
                adicionarMensagemAoContainer(msg, usuarioLogado, false);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (err) {
        console.error("Erro ao carregar mensagens do servidor:", err);
    }
}

function adicionarMensagemAoContainer(msg, usuarioLogado, rolarParaFinal = true) {
    const messagesContainer = document.getElementById("messages-container");
    if (!messagesContainer) return;

    if (msg.id && idsMensagensExibidas.has(msg.id)) {
        return;
    }
    if (msg.id) {
        idsMensagensExibidas.add(msg.id);
    }

    const ehMinha = usuarioLogado && msg.usuario_id && Number(msg.usuario_id) === Number(usuarioLogado.id);

    const msgWrapper = document.createElement("div");
    msgWrapper.className = `chat-msg-wrapper ${ehMinha ? 'own-msg' : ''}`;

    let avatarHtml = "";
    if (msg.foto_perfil && typeof msg.foto_perfil === "string" && msg.foto_perfil.trim().length > 0) {
        avatarHtml = `<img src="${msg.foto_perfil}" class="chat-msg-avatar" alt="${msg.usuario}" onerror="this.onerror=null; this.outerHTML='<div class=\'chat-msg-avatar-fallback\'><i class=\'fa-solid fa-user\'></i></div>';">`;
    } else {
        avatarHtml = `<div class="chat-msg-avatar-fallback"><i class="fa-solid fa-user"></i></div>`;
    }

    msgWrapper.innerHTML = `
        ${avatarHtml}
        <div class="chat-msg-bubble ${ehMinha ? 'chat-msg-bubble-own' : ''}">
            <div class="chat-msg-header">
                <span class="chat-msg-user">${msg.usuario || 'Jogador'} ${ehMinha ? '<small class="tag-voce">(Você)</small>' : ''}</span>
                <span class="chat-msg-time">${msg.hora || 'Hoje'}</span>
            </div>
            <span class="chat-msg-text">${msg.texto || ''}</span>
        </div>
    `;

    messagesContainer.appendChild(msgWrapper);

    if (rolarParaFinal) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function iniciarPollingChat(partidaId, usuarioLogado) {
    if (chatPollingInterval) clearInterval(chatPollingInterval);

    chatPollingInterval = setInterval(async () => {
        try {

            const resMsgs = await fetch(`${API_URL}/partidas/${partidaId}/mensagens`);
            if (resMsgs.ok) {
                const mensagens = await resMsgs.json();
                if (Array.isArray(mensagens)) {
                    mensagens.forEach(msg => {
                        if (msg.id && !idsMensagensExibidas.has(msg.id)) {
                            adicionarMensagemAoContainer(msg, usuarioLogado, true);
                        }
                    });
                }
            }

            const resPartida = await fetch(`${API_URL}/partidas/${partidaId}`);
            if (resPartida.ok) {
                const partida = await resPartida.json();
                const participantes = Array.isArray(partida.participantes) ? partida.participantes : [];
                renderizarParticipantes(participantes, partida.usuario_id, usuarioLogado);

                const elPinned = document.getElementById("pinned-text");
                if (elPinned) {
                    const dataFormatada = formatarDataExibicao(partida.data_hora);
                    const horarioPartida = partida.horario || "00:00";
                    const vagasTexto = partida.vagas !== undefined ? ` • ${partida.vagas} vaga(s) restante(s)` : "";
                    elPinned.textContent = `${partida.esporte || 'Partida'} para ${dataFormatada} às ${horarioPartida} - Local: ${partida.local || 'Cotemig'}${vagasTexto}`;
                }
            }
        } catch (e) {
          
        }
    }, 2000);
}

async function sairPartidaPeloChat(partidaId) {
    if (!confirm("Tem certeza que deseja sair desta partida? Sua vaga será liberada para outros jogadores.")) return;

    const usuarioLogado = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;
    if (!usuarioLogado) {
        window.location.href = "partidas.html";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/partidas/${partidaId}/cancelar-participacao`, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ usuario_id: usuarioLogado.id })
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.erro || "Não foi possível sair da partida.");
            return;
        }

        const inscricoesChave = `inscricoes_${usuarioLogado.id}`;
        let inscricoes = JSON.parse(localStorage.getItem(inscricoesChave) || "[]").map(n => Number(n));
        inscricoes = inscricoes.filter(id => id !== Number(partidaId));
        localStorage.setItem(inscricoesChave, JSON.stringify(inscricoes));

        alert("Você saiu da partida com sucesso.");
        window.location.href = "partidas.html";
    } catch (err) {
        console.error("Erro ao sair da partida:", err);
        alert("Erro ao tentar sair da partida.");
    }
}

/* ==========================================================================
   Modo Escuro / Dark Mode Management
   ========================================================================== */

const CHAVE_TEMA = "batebola_theme";

function aplicarTema(tema, salvar = true) {
    const root = document.documentElement;
    const ehEscuro = tema === "dark";
    
    if (ehEscuro) {
        root.setAttribute("data-theme", "dark");
    } else {
        root.removeAttribute("data-theme");
    }

    const caminhoLogo = ehEscuro
        ? "/static/img/Logotipo%20Esportivo%20em%20Movimento.png"
        : "/static/img/image%208.png";
    document.querySelectorAll(".logo img").forEach(logo => {
        logo.src = caminhoLogo;
    });

    if (salvar) {
        try {
            localStorage.setItem(CHAVE_TEMA, tema);
        } catch (e) {
            console.warn("Não foi possível salvar o tema no localStorage:", e);
        }
    }

    const botoes = document.querySelectorAll(".theme-toggle-btn");
    botoes.forEach(btn => {
        btn.setAttribute("aria-pressed", String(ehEscuro));
        btn.setAttribute("aria-label", ehEscuro ? "Mudar para modo claro" : "Mudar para modo escuro");
        btn.setAttribute("title", ehEscuro ? "Mudar para modo claro" : "Mudar para modo escuro");
    });

    let metaThemeColor = document.getElementById("meta-theme-color") || document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.name = "theme-color";
        metaThemeColor.id = "meta-theme-color";
        document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute("content", ehEscuro ? "#0b0f19" : "#f8f9fa");

    window.dispatchEvent(new CustomEvent("temaalterado", { detail: { tema, ehEscuro } }));
}

function alternarTema() {
    const temaAtual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const novoTema = temaAtual === "dark" ? "light" : "dark";
    aplicarTema(novoTema, true);
}

function obterTemaInicial() {
    try {
        const temaSalvo = localStorage.getItem(CHAVE_TEMA);
        if (temaSalvo === "dark" || temaSalvo === "light") {
            return temaSalvo;
        }
    } catch (e) {}

    const prefereEscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefereEscuro ? "dark" : "light";
}

function configurarModoEscuro() {
    const temaInicial = obterTemaInicial();
    aplicarTema(temaInicial, false);

    const topHeader = document.querySelector(".top-header");
    if (topHeader && !document.getElementById("theme-toggle-header")) {
        let containerRight = topHeader.querySelector(".header-right");
        if (!containerRight) {
            containerRight = document.createElement("div");
            containerRight.className = "header-right";
            topHeader.appendChild(containerRight);
        }
        if (!containerRight.querySelector("#theme-toggle-header")) {
            const btnHeader = document.createElement("button");
            btnHeader.id = "theme-toggle-header";
            btnHeader.className = "theme-toggle-btn";
            btnHeader.type = "button";
            btnHeader.setAttribute("aria-label", "Alternar modo escuro");
            btnHeader.setAttribute("title", "Alternar modo escuro");
            btnHeader.innerHTML = `
                <i class="fa-solid fa-moon icon-moon"></i>
                <i class="fa-solid fa-sun icon-sun"></i>
            `;
            containerRight.appendChild(btnHeader);
        }
    }

    const sidebarBottom = document.querySelector(".sidebar-bottom");
    if (sidebarBottom && !document.getElementById("theme-toggle-sidebar")) {
        const btnSidebar = document.createElement("button");
        btnSidebar.id = "theme-toggle-sidebar";
        btnSidebar.className = "nav-icon theme-toggle-btn";
        btnSidebar.type = "button";
        btnSidebar.setAttribute("aria-label", "Alternar modo escuro");
        btnSidebar.setAttribute("title", "Alternar modo escuro");
        btnSidebar.innerHTML = `
            <i class="fa-solid fa-moon icon-moon"></i>
            <i class="fa-solid fa-sun icon-sun"></i>
        `;
        const btnLogout = sidebarBottom.querySelector("#btn-logout, a:last-child");
        if (btnLogout) {
            sidebarBottom.insertBefore(btnSidebar, btnLogout);
        } else {
            sidebarBottom.appendChild(btnSidebar);
        }
    }

    document.removeEventListener("click", tratarCliqueTema);
    document.addEventListener("click", tratarCliqueTema);

    if (window.matchMedia) {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", (e) => {
            const temaSalvo = localStorage.getItem(CHAVE_TEMA);
            if (!temaSalvo) {
                aplicarTema(e.matches ? "dark" : "light", false);
            }
        });
    }

    aplicarTema(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light", false);
}

function tratarCliqueTema(e) {
    const botao = e.target.closest(".theme-toggle-btn, #theme-toggle-header, #theme-toggle-sidebar");
    if (botao) {
        e.preventDefault();
        alternarTema();
    }
}
