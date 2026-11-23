/* View: renderização de tabelas e preenchimento de campos de relacionamento. */
(function () {
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const definitions = {
        turnos: { columns: ["sigla", "nome", "descricao"], labels: ["Sigla", "Nome", "Descrição"] },
        areas: { columns: ["sigla", "nome", "descricao"], labels: ["Sigla", "Nome", "Descrição"] },
        cursos: { columns: ["codigo", "nome"], labels: ["Código", "Nome"] },
        disciplinas: { columns: ["codigo", "nome", "aulasSemana", "totalAulas", "areaNome"], labels: ["Código", "Nome", "Aulas por semana", "Total de aulas", "Área acadêmica"] },
        professores: { columns: ["nome", "sobrenome", "nomeAbreviado", "email", "areaNome"], labels: ["Nome", "Sobrenome", "Nome abreviado", "E-mail", "Área acadêmica"] },
        curriculos: { columns: ["curriculoLabel", "cursoCodigo", "periodoInicial", "periodicidadeCurricular", "totalPeriodos", "situacao"], labels: ["Currículo", "Código do curso", "Período inicial", "Periodicidade", "Total de períodos", "Situação"] }
    };

    function renderTable(pageKey, records) {
        const definition = definitions[pageKey];
        const tbody = document.querySelector("#table-holder tbody");
        if (!definition || !tbody) return;
        const rows = records.map(record => {
            const cells = definition.columns.map((column, index) => {
                const value = escapeHtml(record[column]);
                if (pageKey === "cursos" && index === 1) {
                    return `<td>${value}<div class="table-actions">${`<a class="icon-btn" href="form-curriculo.html?cursoId=${record.id}" title="Adicionar currículo">＋</a>`}<button class="icon-btn edit" type="button" data-action="edit" data-id="${record.id}" title="Editar">✎</button><button class="icon-btn" type="button" data-action="delete" data-id="${record.id}" title="Excluir">×</button></div></td>`;
                }
                return `<td>${value}</td>`;
            }).join("");
            if (pageKey === "cursos") return `<tr>${cells}</tr>`;
            return `<tr>${cells}<td><div class="table-actions"><button class="icon-btn edit" type="button" data-action="edit" data-id="${record.id}" title="Editar">✎</button><button class="icon-btn" type="button" data-action="delete" data-id="${record.id}" title="Excluir">×</button></div></td></tr>`;
        }).join("");
        const emptyColspan = pageKey === "cursos" ? 2 : definition.columns.length + 1;
        tbody.innerHTML = rows || `<tr><td colspan="${emptyColspan}">Nenhum registro cadastrado.</td></tr>`;
        const count = document.querySelector("#table-holder .muted");
        if (count) count.textContent = `Mostrando ${records.length} registro(s).`;
    }

    function fillSelect(select, records, valueKey, labelKey, firstLabel = "Selecione") {
        if (!select) return;
        const current = select.value;
        select.innerHTML = `<option value="">${firstLabel}</option>` + records.map(item => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey])}</option>`).join("");
        if (current) select.value = current;
    }

    window.SistemaCrudView = { renderTable, fillSelect, definitions };
})();
