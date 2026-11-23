/* Inicialização da aplicação: conecta os presenters às páginas. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const pageLinks = {
    inicio: "index.html", turnos: "turnos.html", areas: "areas-academicas.html", professores: "professores.html",
    cursos: "cursos.html", curriculos: "curriculos.html", disciplinas: "disciplinas.html",
    "vincular-disciplina": "alocar-disciplina-curriculo.html", ingressantes: "turmas-ingressantes.html",
    "gerar-ingressantes": "gerar-turmas-ingressantes.html", "turmas-periodo": "turmas-periodo-letivo.html",
    "gerar-turmas": "gerar-turmas-periodo-letivo.html", ofertas: "ofertas-disciplinas.html",
    "alocar-professor": "alocar-professor.html", cargas: "cargas-horarias.html", "importar-exportar": "importar-exportar.html"
};
const pageLabels = {
    inicio: "Início", turnos: "Gerenciar Turnos", areas: "Gerenciar Áreas Acadêmicas", professores: "Gerenciar Professores",
    cursos: "Gerenciar Cursos", curriculos: "Currículos", disciplinas: "Gerenciar Disciplinas",
    "vincular-disciplina": "Alocar Disciplina ao Currículo", ingressantes: "Turmas Ingressantes",
    "gerar-ingressantes": "Gerar Turmas Ingressantes", "turmas-periodo": "Turmas em Período Letivo",
    "gerar-turmas": "Gerar Turmas em Período Letivo", ofertas: "Ofertar Disciplinas",
    "alocar-professor": "Alocar Professor à Disciplina-Turma", cargas: "Cargas Horárias", "importar-exportar": "Importação / Exportação"
};

function showToast(message) {
    let toast = $("#toast");
    if (!toast) { toast = document.createElement("div"); toast.id = "toast"; toast.className = "toast"; toast.setAttribute("role", "status"); document.body.appendChild(toast); }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

$("#mobile-menu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
// Menus expansíveis: listeners adicionados em todas as páginas (não apenas na inicial).
$$('.group-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const group = button.dataset.group;
        const children = document.querySelector(`[data-children="${group}"]`);
        if (!children) return;
        children.classList.toggle('hidden');
        const arrow = button.querySelector('b');
        if (arrow) arrow.textContent = children.classList.contains('hidden') ? '⌄' : '⌃';
    });
});
$("#search-btn")?.addEventListener("click", () => {
    const query = ($("#global-search")?.value || "").toLocaleLowerCase("pt-BR").trim();
    if (!query) return;
    const match = Object.entries(pageLabels).find(([, label]) => label.toLocaleLowerCase("pt-BR").includes(query));
    if (!match) { showToast("Nenhuma tela encontrada com esse termo."); return; }
    const currentPage = document.body.dataset.pageKey || "inicio";
    const destination = match[0] === "inicio" ? (currentPage === "inicio" ? "index.html" : "../index.html") : (currentPage === "inicio" ? `html/${pageLinks[match[0]]}` : pageLinks[match[0]]);
    const nativeLink = document.createElement("a");
    nativeLink.href = destination;
    nativeLink.hidden = true;
    document.body.appendChild(nativeLink);
    nativeLink.click();
    nativeLink.remove();
});

(async function initializeApplication() {
    try {
        await window.SistemaDatabase.open();
        const pageKey = document.body.dataset.pageKey || "inicio";
        if (window.SistemaCrudPresenter.config[pageKey]) await window.SistemaCrudPresenter.startForm(pageKey);
        else await window.SistemaCrudPresenter.startList(pageKey);
        if (pageKey === "importar-exportar") {
            $("#export-button")?.addEventListener("click", async () => {
                const data = await window.SistemaDatabase.repository.exportAll();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a"); link.href = url; link.download = "backup-sistema-ifrs.json"; link.click(); URL.revokeObjectURL(url);
                showToast("Backup JSON exportado.");
            });
        }
    } catch (error) {
        console.error(error);
        showToast("Erro ao iniciar o banco local. Feche outras abas e tente novamente.");
    }
})();
