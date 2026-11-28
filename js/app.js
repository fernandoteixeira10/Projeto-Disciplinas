const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

/* Sistema de Disciplinas — aplicação consolidada.
 * Arquivos de origem da v2.1: views/crud-view.js, presenters/crud-presenter.js,
 * workflows.js e app.js. Consolidação estrutural inicial; migração para diálogos
 * nativos e eventos delegados será feita nas próximas etapas.
 */
/* View: renderização segura de tabelas e campos de relacionamento. */
(function () {
    const definitions = {
        turnos: { columns: ["sigla", "nome", "descricao"], labels: ["Sigla", "Nome", "Descrição"] },
        areas: { columns: ["sigla", "nome", "descricao"], labels: ["Sigla", "Nome", "Descrição"] },
        cursos: { columns: ["codigo", "nome", "nivel"], labels: ["Código", "Nome", "Nível"] },
        disciplinas: { columns: ["codigo", "nome", "aulas_semana", "total_aulas", "area_nome"], labels: ["Código", "Nome", "Aulas por semana", "Total de aulas", "Área acadêmica"] },
        professores: { columns: ["nome", "sobrenome", "nome_abreviado", "email", "area_nome", "horas_min", "horas_max", "horas_med"], labels: ["Nome", "Sobrenome", "Nome abreviado", "E-mail", "Área acadêmica", "Horas mín.", "Horas máx.", "Horas médias"] },
        curriculos: { columns: ["curriculo_label", "curso_codigo", "periodo_inicial", "periodicidade_curricular", "total_periodos", "situacao"], labels: ["Currículo", "Código do curso", "Período inicial", "Periodicidade", "Total de períodos", "Situação"] }
    };
    function renderTable(pageKey, records, root = document) {
        const definition = definitions[pageKey];
        const tbody = root.querySelector("[id^='table-holder-'] tbody");
        if (!definition || !tbody) return;
        const rows = records.map(record => {
            const cells = definition.columns.map((column, index) => {
                const value = escapeHtml(column === "periodo_inicial" && record.semestre_inicial === 0 ? `${record.ano_inicial} / Ano inteiro` : record[column] ?? (column.startsWith("horas_") ? "—" : ""));
                if (pageKey === "cursos" && column === "nivel") return `<td>${value ? value.toUpperCase() : "Não informado"}</td>`;
                if (pageKey === "cursos" && index === 1) return `<td><a class="curso-link" href="#curriculos?curso_id=${record.id}" title="Consultar currículos deste curso">${value}</a></td>`;
                return `<td>${value}</td>`;
            }).join("");
            if (pageKey === "cursos") return `<tr>${cells}<td><a class="curriculo-add" href="#form-curriculo?curso_id=${record.id}">＋ Adicionar currículo</a></td><td><div class="table-actions"><button class="icon-btn edit" type="button" data-action="edit" data-id="${record.id}" title="Editar curso" aria-label="Editar curso">✎</button><button class="icon-btn curso-delete" type="button" data-action="delete" data-id="${record.id}" title="Excluir curso" aria-label="Excluir curso">×</button></div></td></tr>`;
            return `<tr>${cells}<td><div class="table-actions"><button class="icon-btn edit" type="button" data-action="edit" data-id="${record.id}" title="Editar" aria-label="Editar">✎</button><button class="icon-btn" type="button" data-action="delete" data-id="${record.id}" title="Excluir" aria-label="Excluir">×</button></div></td></tr>`;
        }).join("");
        tbody.innerHTML = rows || `<tr><td colspan="${definition.columns.length + (pageKey === "cursos" ? 2 : 1)}">Nenhum registro cadastrado.</td></tr>`;
        const count = root.querySelector("[id^='table-holder-'] .muted");
        if (count) count.textContent = `Mostrando ${records.length} registro(s).`;
    }
    function fillSelect(select, records, valueKey, labelKey, firstLabel = "Selecione") {
        if (!select) return;
        const current = select.value;
        select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` + records.map(item => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey])}</option>`).join("");
        if (current) select.value = current;
    }
    window.SistemaCrudView = { renderTable, fillSelect, definitions };
})();


/* ===== CRUD Presenter ===== */
/* Presenter: coordena formulários, listagens, regras acadêmicas e o Model. */
(function () {
    const db = window.SistemaDatabase.repository;
    const config = {
        "form-turno": { store: "turno", fields: { sigla: "turno-sigla", nome: "turno-nome", descricao: "turno-descricao" }, list: "turnos" },
        "form-area": { store: "area_academica", fields: { sigla: "area-sigla", nome: "area-nome", descricao: "area-descricao" }, list: "areas" },
        "form-curso": { store: "curso", fields: { codigo: "curso-codigo", nome: "curso-nome", nivel: "curso-nivel" }, list: "cursos" },
        "form-disciplina": { store: "disciplina", fields: { codigo: "disc-codigo", nome: "disc-nome", aulas_semana: "disc-aulas-semanais", total_aulas: "disc-total-aulas", area_id: "disc-area" }, list: "disciplinas" },
        "form-professor": { store: "professor", fields: { nome: "prof-nome", sobrenome: "prof-sobrenome", nome_abreviado: "prof-abreviado", email: "prof-email", area_id: "prof-area", horas_min: "prof-min", horas_max: "prof-max", horas_med: "prof-med", observacoes: "prof-obs" }, list: "professores" },
        "form-curriculo": { store: "curriculo", fields: { ano_inicial: "cur-ano-inicial", semestre_inicial: "cur-sem-inicial", ano_final: "cur-ano-final", semestre_final: "cur-sem-final", periodicidade_ingresso: "cur-ingresso", periodicidade_curricular: "cur-periodicidade", total_periodos: "cur-total-periodos", duracao_aula: "cur-duracao", area_id: "cur-area", situacao: "cur-situacao" }, list: "curriculos" }
    };
    const pageToList = { turnos: "turno", areas: "area_academica", cursos: "curso", disciplinas: "disciplina", professores: "professor", curriculos: "curriculo" };
    const listToForm = { turnos: "form-turno", areas: "form-area", cursos: "form-curso", disciplinas: "form-disciplina", professores: "form-professor", curriculos: "form-curriculo" };
    const numberFields = new Set(["aulas_semana", "total_aulas", "horas_min", "horas_max", "horas_med", "area_id", "curso_id", "ano_inicial", "ano_final", "semestre_inicial", "semestre_final", "total_periodos", "duracao_aula"]);
    const rootFor = key => document.querySelector(`.app-page[data-pagina="${CSS.escape(key)}"]`);
    const getValue = (root, id) => root.querySelector(`#${CSS.escape(id)}`)?.value.trim() ?? "";
    const setValue = (root, id, value) => { const el = root.querySelector(`#${CSS.escape(id)}`); if (el) el.value = value ?? ""; };

    async function hydrateRelations(root) {
        const areas = await db.all("area_academica");
        const options = areas.map(area => ({ ...area, label: `${area.sigla} — ${area.nome}` }));
        ["disc-area", "prof-area"].forEach(id => window.SistemaCrudView.fillSelect(root.querySelector(`#${id}`), options, "id", "label", "Sem área"));
    }

    function routeParams() {
        const raw = location.hash.replace(/^#/, "");
        const queryIndex = raw.indexOf("?");
        return new URLSearchParams(queryIndex >= 0 ? raw.slice(queryIndex + 1) : "");
    }

    // Guarda os valores carregados para que restaurar uma edição não limpe o registro.
    const valoresOriginais = new WeakMap();
    function configurarReset(form, emEdicao) {
        const botao = form.querySelector('[type="reset"]');
        if (botao) botao.textContent = emEdicao ? "Restaurar valores" : "Limpar";
        if (emEdicao) {
            valoresOriginais.set(form, [...form.elements]
                .filter(campo => campo.matches('input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]), select, textarea'))
                .map(campo => ({ campo, valor: campo.value, marcado: campo.checked,
                    selecionadas: campo.multiple ? [...campo.options].map(o => o.selected) : null })));
        }
        if (form.dataset.resetBound === "true") return;
        form.dataset.resetBound = "true";
        form.addEventListener("reset", event => {
            const valores = valoresOriginais.get(form);
            if (!valores) return; // Cadastro novo: reset nativo.
            event.preventDefault();
            for (const { campo, valor, marcado, selecionadas } of valores) {
                if (selecionadas) [...campo.options].forEach((o, i) => { o.selected = selecionadas[i]; });
                else campo.value = valor;
                if (campo.type === "checkbox" || campo.type === "radio") campo.checked = marcado;
            }
        });
    }

    async function startForm(pageKey) {
        const definition = config[pageKey];
        const root = rootFor(pageKey);
        if (!definition || !root) return;
        const formInicial = root.querySelector(".data-form");
        if (formInicial) {
            valoresOriginais.delete(formInicial);
            formInicial.reset();
            configurarReset(formInicial, false);
        }
        await hydrateRelations(root);
        if (pageKey === "form-curriculo") {
            const areas = await db.all("area_academica");
            const turnos = await db.all("turno");
            const grupo = root.querySelector("[data-turnos]");
            grupo.replaceChildren(...turnos.map(t => { const label=document.createElement("label"); const input=document.createElement("input"); input.type="checkbox"; input.name="turnos"; input.value=t.sigla; label.append(input, " "+t.nome); return label; }));
            if (!turnos.length) grupo.textContent="Cadastre turnos antes de criar um currículo.";
            window.SistemaCrudView.fillSelect(root.querySelector("#cur-area"), areas, "id", "nome", "Selecione a área");
        }
        const params = routeParams();
        const id = params.get("id");
        const form = root.querySelector(".data-form");
        if (!form) return;
        form.dataset.recordId = "";
        const heading = root.querySelector("h1");
        if (heading && !form.dataset.originalHeading) form.dataset.originalHeading = heading.textContent;
        if (heading) heading.textContent = id ? form.dataset.originalHeading.replace(/^Cadastrar/, "Editar") : form.dataset.originalHeading;
        const submit = form.querySelector('[type="submit"]');
        if (submit && !submit.dataset.originalText) submit.dataset.originalText = submit.textContent;
        if (submit) submit.textContent = id ? "Salvar alterações" : submit.dataset.originalText;
        if (id) {
            const record = await db.get(definition.store, Number(id));
            if (!record) { showToast("Registro não encontrado."); return; }
            Object.entries(definition.fields).forEach(([field, inputId]) => setValue(root, inputId, record[field]));
            if (pageKey === "form-curriculo" && record.ano_inicial == null && record.semestre_inicial == null && record.periodo_inicial) { const [ano, periodo] = String(record.periodo_inicial).split(" / "); setValue(root, "cur-ano-inicial", ano); setValue(root, "cur-sem-inicial", periodo); }
            if (pageKey === "form-curriculo" && record.ano_final == null && record.semestre_final == null && record.periodo_final) { const [ano, periodo] = String(record.periodo_final).split(" / "); setValue(root, "cur-ano-final", ano); setValue(root, "cur-sem-final", periodo); }
            if (pageKey === "form-curriculo") root.querySelectorAll('input[name="turnos"]').forEach(input => input.checked = (record.turnos || []).includes(input.value));
            form.dataset.recordId = id;
            configurarReset(form, true);
        } else if (pageKey === "form-curriculo") {
            const curso_id = params.get("curso_id");
            const hint = root.querySelector("[data-curso-context]");
            if (hint) hint.textContent = curso_id ? `Currículo vinculado ao curso ${curso_id}` : "Abra o cadastro de currículo a partir do curso correspondente.";
        }
        if (form.dataset.bound === "true") return;
        form.dataset.bound = "true";
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const record = {};
            Object.entries(definition.fields).forEach(([field, inputId]) => { const raw = getValue(root, inputId); record[field] = numberFields.has(field) ? (raw === "" ? null : Number(raw)) : raw; });
            if (definition.store === "curriculo") {
                const currentParams = routeParams();
                const existing = form.dataset.recordId ? await db.get("curriculo", Number(form.dataset.recordId)) : null;
                record.curso_id = existing?.curso_id ?? (currentParams.get("curso_id") ? Number(currentParams.get("curso_id")) : null);
                if (!record.curso_id || !await db.get("curso", record.curso_id)) { showToast("Abra o cadastro de currículo a partir do curso correspondente."); return; }
                const hasInitialYear = getValue(root, "cur-ano-inicial") !== "", hasInitialPeriod = getValue(root, "cur-sem-inicial") !== "";
                const hasFinalYear = getValue(root, "cur-ano-final") !== "", hasFinalPeriod = getValue(root, "cur-sem-final") !== "";
                record.ano_inicial = hasInitialYear ? Number(getValue(root, "cur-ano-inicial")) : null;
                record.semestre_inicial = hasInitialPeriod ? Number(getValue(root, "cur-sem-inicial")) : null;
                record.ano_final = hasFinalYear ? Number(getValue(root, "cur-ano-final")) : null;
                record.semestre_final = hasFinalPeriod ? Number(getValue(root, "cur-sem-final")) : null;
                record.turnos = [...root.querySelectorAll('input[name="turnos"]:checked')].map(input => input.value);
                const area = record.area_id ? await db.get("area_academica", record.area_id) : null;
                const curso = await db.get("curso", record.curso_id);
                record.area_nome = area?.nome || ""; record.curso_nome = curso?.nome || ""; record.curso_codigo = curso?.codigo || "";
                record.curriculo_label = `${record.curso_nome} — ${record.ano_inicial ?? "sem previsão"}`;
                record.periodo_inicial = record.ano_inicial === null ? null : `${record.ano_inicial} / ${record.semestre_inicial}`;
                record.periodo_final = record.ano_final === null ? null : `${record.ano_final} / ${record.semestre_final}`;
            }
            if (definition.store === "disciplina" && !record.area_id) delete record.area_id;
            if (definition.store === "professor" || definition.store === "disciplina") {
                const area = record.area_id ? await db.get("area_academica", record.area_id) : null;
                record.area_nome = area ? area.nome : "Não informada";
            }
            record.updated_at = new Date().toISOString();
            try {
                if (form.dataset.recordId) {
                    record.id = Number(form.dataset.recordId); record.created_at = (await db.get(definition.store, record.id))?.created_at || record.updated_at;
                    await db.update(definition.store, record); showToast("Registro atualizado com sucesso.");
                } else { record.created_at = record.updated_at; await db.add(definition.store, record); showToast("Registro cadastrado com sucesso."); }
                location.hash = `#${definition.list}`;
            } catch (error) { showToast(error.message || "Não foi possível salvar. Verifique os dados."); console.error(error); }
        });
    }

    async function startList(pageKey) {
        const storeName = pageToList[pageKey], root = rootFor(pageKey);
        if (!storeName || !root) return;
        const render = async () => {
            let records = await db.all(storeName);
            const cursoId = pageKey === "curriculos" ? routeParams().get("curso_id") : null;
            if (cursoId) records = records.filter(record => String(record.curso_id) === cursoId);
            const context = root.querySelector("#curriculos-contexto");
            if (context) {
                context.hidden = !cursoId;
                if (cursoId) {
                    const curso = await db.get("curso", Number(cursoId));
                    context.querySelector("span").textContent = `Currículos de: ${curso?.nome ?? "Curso não encontrado"}`;
                }
            }
            window.SistemaCrudView.renderTable(pageKey, records, root);
            const filter = root.querySelector("[id^='table-filter-']");
            if (filter) filter.dispatchEvent(new Event("input"));
        };
        await render();
        const filter = root.querySelector("[id^='table-filter-']");
        if (filter && filter.dataset.bound !== "true") {
            filter.dataset.bound = "true";
            filter.addEventListener("input", () => { const term = filter.value.toLocaleLowerCase("pt-BR"); root.querySelectorAll("[id^='table-holder-'] tbody tr").forEach(row => row.hidden = !row.textContent.toLocaleLowerCase("pt-BR").includes(term)); });
        }
        const holder = root.querySelector("[id^='table-holder-']");
        if (holder && holder.dataset.bound !== "true") {
            holder.dataset.bound = "true";
            holder.addEventListener("click", async event => {
                const button = event.target.closest("button[data-action]"); if (!button) return;
                const id = Number(button.dataset.id);
                if (button.dataset.action === "edit") { location.hash = `#${listToForm[pageKey]}?id=${id}`; return; }
                if (button.dataset.action === "delete") {
                    if (!confirm("Deseja realmente excluir este registro?")) return;
                    try { await db.remove(storeName, id); showToast("Registro excluído."); await render(); }
                    catch (error) { showToast(error.message || "Não foi possível excluir o registro."); console.error(error); }
                }
            });
        }
    }
    window.SistemaCrudPresenter = { startForm, startList, config };
})();


/* ===== Workflows operacionais ===== */
/* Fluxos acadêmicos: associações, geração de turmas, ofertas, alocações e relatórios. */
(function () {
  const repo = () => window.SistemaDatabase.repository;
  const toast = m => window.showToast ? window.showToast(m) : alert(m);
  // A gravação já foi concluída; uma falha de renderização não deve sugerir que ela falhou.
  async function atualizarAposSalvar(renderizar, mensagem) {
    try {
      await renderizar();
      toast(mensagem);
    } catch (erro) {
      console.error(erro);
      toast(`${mensagem} Não foi possível atualizar a tela. Reabra esta página.`);
    }
  }

  // Uma operacao por tela de workflow, inclusive quando ha mais de um formulario.
  const enviosEmAndamento = new WeakSet();
  function registrarEnvio(form, executar) {
    const escopo = form.closest('.workflow-root') || form;
    const botoes = () => [...escopo.querySelectorAll('button')]
      .filter(botao => botao.type === 'submit' && botao.form && escopo.contains(botao.form));
    if (enviosEmAndamento.has(escopo)) botoes().forEach(botao => { botao.disabled = true; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (enviosEmAndamento.has(escopo)) return;
      enviosEmAndamento.add(escopo);
      const estados = botoes().map(botao => [botao, botao.disabled]);
      estados.forEach(([botao]) => { botao.disabled = true; });
      escopo.setAttribute('aria-busy', 'true');
      try {
        await executar();
      } catch (erro) {
        toast(erro.message || 'Não foi possível concluir a operação.');
      } finally {
        enviosEmAndamento.delete(escopo);
        escopo.removeAttribute('aria-busy');
        // Novos botoes podem ter sido criados durante a renderizacao.
        botoes().forEach(botao => {
          const anterior = estados.find(([original]) => original === botao);
          botao.disabled = anterior ? anterior[1] : false;
        });
        // A nova tela de ingressantes tem uma regra adicional de selecao.
        const novaSelecao = escopo.querySelector('#wf-gi-options');
        if (novaSelecao) novaSelecao.dispatchEvent(new Event('change', { bubbles: false }));
      }
    });
  }

  const root = key => document.querySelector(`.app-page[data-pagina="${key}"]`);
  const labelPeriodo = p => !p ? '—' : `${p.ano} / ${p.tipo === 'ano' ? 'Ano' : `${p.numero}º ${p.tipo}`}`;
  const get = async (store,id) => repo().get(store, Number(id));
  const all = async store => repo().all(store);
  const save = async (store,record) => record.id ? repo().update(store,record) : repo().add(store,record);
  const opts = (items, value, label, empty='Selecione') => `<option value="">${empty}</option>${items.map(x=>`<option value="${escapeHtml(x[value])}">${escapeHtml(label(x))}</option>`).join('')}`;
  const shell = (key,title,desc,body) => { const el=root(key)?.querySelector(".workflow-root"); if(el) el.innerHTML=`<div class="page-wrap"><div class="page-heading"><div class="heading-icon">▦</div><div><h1 id="heading-${key}">${title}</h1><p>${desc}</p></div></div>${body}</div>`; };
  const panel = (title,body) => `<section class="panel"><h2 class="panel-title">${title}</h2>${body}</section>`;
  const table = (headers,rows) => `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">Nenhum registro encontrado.</td></tr>`}</tbody></table></div>`;
  const action = (store,id) => `<td><div class="table-actions"><button class="icon-btn" data-wf-edit="${store}" data-id="${id}" title="Editar">✎</button><button class="icon-btn" data-wf-delete="${store}" data-id="${id}" title="Excluir">×</button></div></td>`;
  async function periodGetOrCreate(ano,tipo,numero){
    const periods=await all('periodo_letivo'); let p=periods.find(x=>x.ano===ano && x.tipo===tipo && (x.numero??null)===(numero??null));
    if(!p){const id=await repo().add('periodo_letivo',{ano,tipo,numero});p=await get('periodo_letivo',id);} return p;
  }
  async function renderAssociation(){
    const anterior = { curso: $('#wf-ac-course')?.value, curriculo: $('#wf-ac-curr')?.value, disciplina: $('#wf-ac-disc')?.value, periodo: $('#wf-ac-period')?.value };
    const [courses,currs,discs,links]=await Promise.all(['curso','curriculo','disciplina','disciplina_curriculo'].map(all));
    const body=`<form id="wf-assoc" class="data-form"><div class="form-grid"><div class="field"><label>Curso</label><select id="wf-ac-course" required>${opts(courses,'id',x=>`${x.codigo} — ${x.nome}`)}</select></div><div class="field"><label>Currículo</label><select id="wf-ac-curr" required></select></div><div class="field"><label>Disciplina</label><select id="wf-ac-disc" required>${opts(discs,'id',x=>`${x.codigo} — ${x.nome}`)}</select></div><div class="field"><label>Período curricular</label><select id="wf-ac-period" required></select></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Vincular disciplina</button></div></form><div id="wf-assoc-list"></div>`;
    shell('vincular-disciplina','Disciplinas do currículo','Vincule disciplinas cadastradas aos currículos e defina seu período curricular.',panel('Nova associação',body));
    const course=$('#wf-ac-course'), curr=$('#wf-ac-curr'), disc=$('#wf-ac-disc'), per=$('#wf-ac-period');
    const renderList = () => {
      const selected = links.filter(x=>currs.some(c=>c.id===x.curriculo_id&&String(c.curso_id)===course.value)&&(!curr.value||String(x.curriculo_id)===curr.value));
    $('#wf-assoc-list').innerHTML=panel('Disciplinas vinculadas',table(['Disciplina','Curso / currículo','Período','Ações'],selected.map(x=>{const d=discs.find(y=>y.id===x.disciplina_id),c=currs.find(y=>y.id===x.curriculo_id),cu=courses.find(y=>y.id===c?.curso_id);return `<tr><td>${escapeHtml(d?.codigo)} — ${escapeHtml(d?.nome)}</td><td>${escapeHtml(cu?.nome)} / ${escapeHtml(c?.curriculo_label||'Currículo')}</td><td>${x.periodo===0?'Sem período fixo':x.periodo}</td>${action('disciplina_curriculo',x.id)}</tr>`}).join('')));
    };
    const fillPeriods = () => {
      const c=currs.find(x=>String(x.id)===curr.value);
      const n=Number(c?.total_periodos||0);
      per.innerHTML=c?Array.from({length:n+1},(_,i)=>`<option value="${i}">${i===0?'0 — Sem período fixo':i}</option>`).join(''):'<option value="">Selecione o currículo</option>';
      per.disabled=!c;
      renderList();
    };
    const fillCurr = () => {
      const arr=currs.filter(c=>String(c.curso_id)===course.value);
      curr.innerHTML=opts(arr,'id',c=>`${c.curriculo_label||'Currículo'} — ${c.total_periodos||'?'} períodos`);
      curr.disabled=!course.value;
      fillPeriods();
    };
    course.addEventListener('change',fillCurr);
    curr.addEventListener('change',fillPeriods);
    if (anterior.curso && courses.some(x=>String(x.id)===anterior.curso)) course.value=anterior.curso;
    fillCurr();
    if (anterior.curriculo && [...curr.options].some(o=>o.value===anterior.curriculo)) curr.value=anterior.curriculo;
    fillPeriods();
    if (anterior.disciplina && [...disc.options].some(o=>o.value===anterior.disciplina)) disc.value=anterior.disciplina;
    if (anterior.periodo != null && [...per.options].some(o=>o.value===anterior.periodo)) per.value=anterior.periodo;
    registrarEnvio($('#wf-assoc'), async () => {
      if (!curr.value || !disc.value || per.value==='') throw Error('Selecione curso, currículo, disciplina e período.');
      await repo().add('disciplina_curriculo',{disciplina_id:Number(disc.value),curriculo_id:Number(curr.value),periodo:Number(per.value)});
      await atualizarAposSalvar(renderAssociation, 'Disciplina vinculada.');
    });
  }
  async function renderIngressantes(){
    const [items,currs,periods,turnos,courses]=await Promise.all(['turma_ingressante','curriculo','periodo_letivo','turno','curso'].map(all));
    const body=`<form id="wf-ing" class="data-form"><div class="form-grid"><div class="field"><label>Currículo</label><select id="wf-ing-cur" required>${opts(currs,'id',c=>`${courses.find(x=>x.id===c.curso_id)?.nome||'Curso'} — ${c.curriculo_label||'Currículo'}`)}</select></div><div class="field"><label>Período de ingresso</label><select id="wf-ing-period" required>${opts(periods,'id',labelPeriodo)}</select></div><div class="field"><label>Turno</label><select id="wf-ing-turn" required>${opts(turnos,'id',t=>t.nome)}</select></div><div class="field"><label>Número</label><input id="wf-ing-num" type="number" min="1" required></div><div class="field"><label>Situação</label><select id="wf-ing-status"><option value="ativo">Ativa</option><option value="inativo">Inativa</option></select></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Cadastrar turma ingressante</button></div></form>`;
    shell('ingressantes','Turmas ingressantes','Gerencie as turmas de ingresso por currículo, período e turno.',panel('Cadastrar turma ingressante',body)+panel('Registros cadastrados',table(['Curso / currículo','Período','Turno','Número','Situação','Ações'],items.map(x=>{const c=currs.find(y=>y.id===x.curriculo_id),cu=courses.find(y=>y.id===c?.curso_id),p=periods.find(y=>y.id===x.periodo_id),t=turnos.find(y=>y.id===x.turno_id);return `<tr><td>${escapeHtml(cu?.nome)} — ${escapeHtml(c?.curriculo_label||'Currículo')}</td><td>${escapeHtml(labelPeriodo(p))}</td><td>${escapeHtml(t?.nome)}</td><td>${x.numero}</td><td>${escapeHtml(x.situacao)}</td>${action('turma_ingressante',x.id)}</tr>`}).join(''))));
    registrarEnvio($('#wf-ing'), async () => {
      await repo().add('turma_ingressante',{curriculo_id:+$('#wf-ing-cur').value,periodo_id:+$('#wf-ing-period').value,turno_id:+$('#wf-ing-turn').value,numero:+$('#wf-ing-num').value,situacao:$('#wf-ing-status').value});await atualizarAposSalvar(renderIngressantes, 'Turma ingressante cadastrada.');
    });
  }
  async function renderGenerateIngressantes(){
    const [currs,turnos,courses,periods,existing]=await Promise.all(['curriculo','turno','curso','periodo_letivo','turma_ingressante'].map(all));
    const body=`<form id="wf-gen-ing" class="data-form"><div class="form-grid"><div class="field"><label>Ano</label><input id="wf-gi-year" type="number" min="1900" value="${new Date().getFullYear()}" required></div><div class="field"><label>Periodicidade</label><select id="wf-gi-type"><option value="ano">Ano</option><option value="semestre">Semestre</option><option value="trimestre">Trimestre</option><option value="bimestre">Bimestre</option></select></div><div class="field"><label>Número do período</label><input id="wf-gi-num" type="number" min="1" value="1" required></div></div><div id="wf-gi-options"></div><div class="form-actions"><button type="submit" class="btn btn-primary">Gerar turmas ingressantes</button></div></form>`;
    shell('gerar-ingressantes','Gerar turmas ingressantes','Crie turmas de ingresso para currículos ativos e turnos selecionados.',panel('Período de ingresso e seleção',body));
    const ativos = currs.filter(c => c.situacao !== 'inativo');
    const linhas = ativos.map(c => {
      const curso = courses.find(x => x.id === c.curso_id);
      const disponiveis = turnos.filter(t => (c.turnos || []).includes(t.sigla) || !(c.turnos || []).length);
      const opcoes = disponiveis.map(t => `<label class="turno-opcao"><input type="checkbox" name="wf-gi-${c.id}" value="${t.id}"><span>${escapeHtml(t.nome)}</span></label>`).join('');
      return `<tr><td><strong>${escapeHtml(curso?.nome || 'Curso')}</strong></td><td>${escapeHtml(c.ano_inicial ?? c.curriculo_label ?? 'Sem previsão')}</td><td><div class="turnos-opcoes">${opcoes || '<span class="selecao-ajuda">Nenhum turno disponível</span>'}</div></td></tr>`;
    }).join('');
    const selecao = $('#wf-gi-options');
    selecao.innerHTML = `<div class="selecao-curriculos"><h3>Seleção de currículos e turnos</h3><p class="selecao-ajuda">Selecione os turnos para os quais deseja gerar turmas ingressantes.</p>${table(['Curso','Currículo','Turnos disponíveis'], linhas || '<tr><td colspan="3">Cadastre currículos ativos antes de gerar turmas.</td></tr>')}<p class="selecao-ajuda" id="wf-gi-count" aria-live="polite">0 turno(s) selecionado(s)</p></div>`;
    const atualizarSelecao = () => {
      const total = selecao.querySelectorAll('input:checked').length;
      selecao.querySelector('#wf-gi-count').textContent = `${total} turno(s) selecionado(s)`;
      const form = selecao.closest('form');
      form.querySelector('.form-actions button').disabled = total === 0 || enviosEmAndamento.has(selecao.closest('.workflow-root'));
    };
    selecao.addEventListener('change', atualizarSelecao);
    atualizarSelecao();
    registrarEnvio($('#wf-gen-ing'), async () => {
      const year=+$('#wf-gi-year').value,type=$('#wf-gi-type').value,num=+$('#wf-gi-num').value;if(type==='ano'&&num!==1)throw Error('Para período anual, use número 1.');const selecionados=new Map(ativos.map(c=>[c.id,[...selecao.querySelectorAll(`input[name="wf-gi-${c.id}"]:checked`)].map(x=>+x.value)]));if(![...selecionados.values()].some(turnos=>turnos.length))throw Error('Selecione ao menos um turno.');const p=await periodGetOrCreate(year,type,num);let created=0;const novas=[];for(const c of currs.filter(x=>x.situacao!=='inativo')){const chosen=selecionados.get(c.id)||[];for(const tid of chosen){const same=existing.filter(x=>x.curriculo_id===c.id&&x.periodo_id===p.id).concat(novas.filter(x=>x.curriculo_id===c.id&&x.periodo_id===p.id));const next=Math.max(0,...same.map(x=>x.numero||0))+1;novas.push({curriculo_id:c.id,periodo_id:p.id,turno_id:tid,numero:next,situacao:'ativo'});created++;}}await repo().transacao(async t=>{for(const registro of novas)await t.salvar('turma_ingressante',registro);});await atualizarAposSalvar(renderGenerateIngressantes, `${created} turma(s) ingressante(s) gerada(s).`);
    });
  }
  async function renderTurmas(){
    const [items,ings,periods,currs,courses,turnos]=await Promise.all(['turma','turma_ingressante','periodo_letivo','curriculo','curso','turno'].map(all));
    const rows=items.map(x=>{const ing=ings.find(y=>y.id===x.ingressante_id),c=currs.find(y=>y.id===ing?.curriculo_id),cu=courses.find(y=>y.id===c?.curso_id),p=periods.find(y=>y.id===x.periodo_id),t=turnos.find(y=>y.id===ing?.turno_id);return `<tr><td>T${String(x.numero||1).padStart(2,'0')}</td><td>${escapeHtml(cu?.nome)}</td><td>${escapeHtml(labelPeriodo(p))}</td><td>${x.fase}</td><td>${escapeHtml(t?.nome)}</td>${action('turma',x.id)}</tr>`}).join('');
    const body=`<form id="wf-turma" class="data-form"><div class="form-grid"><div class="field"><label>Turma ingressante</label><select id="wf-t-ing" required>${opts(ings,'id',i=>`${courses.find(x=>x.id===currs.find(c=>c.id===i.curriculo_id)?.curso_id)?.nome||''} — ${turnos.find(t=>t.id===i.turno_id)?.nome||''} #${i.numero}`)}</select></div><div class="field"><label>Período letivo</label><select id="wf-t-period" required>${opts(periods,'id',labelPeriodo)}</select></div><div class="field"><label>Número da turma</label><input id="wf-t-num" type="number" min="1" value="1" required></div><div class="field"><label>Período curricular</label><input id="wf-t-phase" type="number" min="0" required></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Cadastrar turma</button></div></form>`;
    shell('turmas-periodo','Turmas em período letivo','Consulte e cadastre as turmas vinculadas a períodos letivos.',panel('Cadastrar turma',body)+panel('Turmas cadastradas',table(['Turma','Curso','Período letivo','Período curricular','Turno','Ações'],rows)));
    registrarEnvio($('#wf-turma'), async () => {
      const ingressante_id=+$('#wf-t-ing').value, fase=+$('#wf-t-phase').value, periodo_id=+$('#wf-t-period').value, numero=+$('#wf-t-num').value;await repo().add('turma',{ingressante_id,periodo_id,numero,fase});await atualizarAposSalvar(renderTurmas, 'Turma cadastrada.');
    });
  }
  async function renderGenerateTurmas(periodo_gerado = null){
    const [turmas,periods,ings,currs]=await Promise.all(['turma','periodo_letivo','turma_ingressante','curriculo'].map(all));
    const body=`<form id="wf-gen-t" class="data-form"><div class="form-grid"><div class="field"><label>Ano</label><input id="wf-gt-year" type="number" min="1900" value="${new Date().getFullYear()}" required></div><div class="field"><label>Tipo</label><select id="wf-gt-type"><option value="semestre">Semestre</option><option value="ano">Ano</option><option value="trimestre">Trimestre</option><option value="bimestre">Bimestre</option></select></div><div class="field"><label>Número</label><input id="wf-gt-num" type="number" min="1" value="1" required></div><div class="field"><label>Período anterior</label><select id="wf-gt-prev" required>${opts(periods,'id',labelPeriodo)}</select></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Gerar turmas do período</button></div></form>`;
    shell('gerar-turmas','Gerar turmas em período letivo','Avance as turmas para o período seguinte, respeitando o limite curricular.',panel('Parâmetros de geração',body)+panel('Turmas do período gerado',table(['Turma','Período letivo','Fase'],turmas.filter(t=>t.periodo_id===periodo_gerado).map(t=>`<tr><td>${escapeHtml(t.numero)}</td><td>${escapeHtml(labelPeriodo(periods.find(p=>p.id===t.periodo_id)))}</td><td>${escapeHtml(t.fase)}</td></tr>`).join(''))));
    registrarEnvio($('#wf-gen-t'), async () => {
      const prev=periods.find(p=>p.id===+$('#wf-gt-prev').value);const next=await periodGetOrCreate(+$('#wf-gt-year').value,$('#wf-gt-type').value,+$('#wf-gt-num').value);let created=0,skipped=0;const novas=[];for(const t of turmas.filter(x=>x.periodo_id===prev.id)){const ing=ings.find(x=>x.id===t.ingressante_id),cur=currs.find(x=>x.id===ing?.curriculo_id);if(!cur||t.fase>=Number(cur.total_periodos||0)){skipped++;continue;}const exists=turmas.some(x=>x.ingressante_id===t.ingressante_id&&x.periodo_id===next.id);if(exists){skipped++;continue;}novas.push({ingressante_id:t.ingressante_id,periodo_id:next.id,numero:t.numero,fase:t.fase+1});created++;}await repo().transacao(async t=>{for(const registro of novas)await t.salvar('turma',registro);});await atualizarAposSalvar(() => renderGenerateTurmas(next.id), `${created} turma(s) gerada(s); ${skipped} ignorada(s) por limite ou duplicidade.`);
    });
  }
  async function renderOffers(){
    const [turmas,ings,currs,periods,links,discs,courses,offers]=await Promise.all(['turma','turma_ingressante','curriculo','periodo_letivo','disciplina_curriculo','disciplina','curso','oferta_disciplina_turma'].map(all));
    const periodOptions=periods.map(p=>`<label class="turno-opcao"><input type="checkbox" name="wf-off-period" value="${p.id}"> ${escapeHtml(labelPeriodo(p))}</label>`).join('');
    const rows=offers.map(o=>{const t=turmas.find(x=>x.id===o.turma_id),dc=links.find(x=>x.id===o.disciplina_curriculo_id),d=discs.find(x=>x.id===dc?.disciplina_id),p=periods.find(x=>x.id===t?.periodo_id);return `<tr><td>${escapeHtml(d?.codigo)} — ${escapeHtml(d?.nome)}</td><td>${t?.numero||''}</td><td>${escapeHtml(labelPeriodo(p))}</td><td>${escapeHtml(o.situacao||'ativa')}</td>${action('oferta_disciplina_turma',o.id)}</tr>`}).join('');
    shell('ofertas','Ofertar disciplinas às turmas','Gere ofertas automaticamente para períodos curriculares regulares ou cadastre manualmente disciplinas de período 0.',panel('Gerar ofertas por período letivo',`<form id="wf-off-gen"><div class="turnos-opcoes">${periodOptions}</div><div class="form-actions"><button type="submit" class="btn btn-primary">Gerar ofertas regulares</button></div></form>`)+panel('Oferta manual — período curricular 0',`<form id="wf-off-manual"><div class="form-grid"><div class="field"><label>Turma</label><select id="wf-off-turma" required>${opts(turmas,'id',t=>{const i=ings.find(x=>x.id===t.ingressante_id),c=currs.find(x=>x.id===i?.curriculo_id),cu=courses.find(x=>x.id===c?.curso_id),p=periods.find(x=>x.id===t.periodo_id);return `${cu?.nome||''} — Turma ${t.numero} — ${labelPeriodo(p)}`})}</select></div><div class="field"><label>Disciplina de período 0</label><select id="wf-off-link" required>${opts(links.filter(x=>x.periodo===0),'id',x=>{const d=discs.find(y=>y.id===x.disciplina_id);return `${d?.codigo||''} — ${d?.nome||''}`})}</select></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Cadastrar oferta manual</button></div></form>`)+panel('Ofertas cadastradas',table(['Disciplina','Turma','Período letivo','Situação','Ações'],rows)));
    registrarEnvio($('#wf-off-gen'), async () => {
      const selected=[...document.querySelectorAll('[name="wf-off-period"]:checked')].map(x=>+x.value);if(!selected.length)throw Error('Selecione ao menos um período letivo.');let created=0;const novas=[];for(const t of turmas.filter(x=>selected.includes(x.periodo_id))){const ing=ings.find(x=>x.id===t.ingressante_id),cur=currs.find(x=>x.id===ing?.curriculo_id);for(const dc of links.filter(x=>x.curriculo_id===cur?.id&&x.periodo===t.fase&&x.periodo!==0)){if(offers.some(o=>o.turma_id===t.id&&o.disciplina_curriculo_id===dc.id))continue;novas.push({turma_id:t.id,disciplina_curriculo_id:dc.id,situacao:'ativa'});created++;}}await repo().transacao(async t=>{for(const registro of novas)await t.salvar('oferta_disciplina_turma',registro);});await atualizarAposSalvar(renderOffers, `${created} oferta(s) criada(s).`);
    });
    registrarEnvio($('#wf-off-manual'), async () => {
      const turma_id=+$('#wf-off-turma').value,disciplina_curriculo_id=+$('#wf-off-link').value,t=turmas.find(x=>x.id===turma_id),ing=ings.find(x=>x.id===t?.ingressante_id),link=links.find(x=>x.id===disciplina_curriculo_id);if(!link||link.periodo!==0||link.curriculo_id!==ing?.curriculo_id)throw Error('A disciplina precisa pertencer ao currículo da turma e estar no período 0.');if(offers.some(o=>o.turma_id===turma_id&&o.disciplina_curriculo_id===disciplina_curriculo_id))throw Error('Essa oferta já existe.');await repo().add('oferta_disciplina_turma',{turma_id,disciplina_curriculo_id,situacao:'ativa'});await atualizarAposSalvar(renderOffers, 'Oferta manual cadastrada.');
    });
  }
  async function renderAllocations(){
    const [offers,teachers,turmas,links,discs,ings,periods,allocs]=await Promise.all(['oferta_disciplina_turma','professor','turma','disciplina_curriculo','disciplina','turma_ingressante','periodo_letivo','professor_oferta_disciplina_turma'].map(all));
    const offerLabel=o=>{const t=turmas.find(x=>x.id===o.turma_id),dc=links.find(x=>x.id===o.disciplina_curriculo_id),d=discs.find(x=>x.id===dc?.disciplina_id),p=periods.find(x=>x.id===t?.periodo_id);return `${d?.codigo||''} ${d?.nome||''} — Turma ${t?.numero||''} — ${labelPeriodo(p)}`;};
    const rows=allocs.map(a=>{const p=teachers.find(x=>x.id===a.professor_id),o=offers.find(x=>x.id===a.oferta_id);return `<tr><td>${escapeHtml(p?.nome)} ${escapeHtml(p?.sobrenome)}</td><td>${escapeHtml(offerLabel(o||{}))}</td><td>${a.aulas??'—'}</td>${action('professor_oferta_disciplina_turma',a.id)}</tr>`}).join('');
    shell('alocar-professor','Alocar professores','Associe um ou mais docentes a cada oferta de disciplina.',panel('Nova alocação',`<form id="wf-alloc"><div class="form-grid"><div class="field"><label>Oferta</label><select id="wf-alloc-offer" required>${opts(offers,'id',offerLabel)}</select></div><div class="field"><label>Professor</label><select id="wf-alloc-prof" required>${opts(teachers,'id',p=>`${p.nome} ${p.sobrenome}`)}</select></div><div class="field"><label>Aulas atribuídas</label><input id="wf-alloc-hours" type="number" min="0" step="0.5" required></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Salvar alocação</button></div></form>`)+panel('Alocações atuais',table(['Professor','Oferta / turma / período','Aulas','Ações'],rows)));
    registrarEnvio($('#wf-alloc'), async () => {
      const professor_id=+$('#wf-alloc-prof').value,oferta_id=+$('#wf-alloc-offer').value,aulas=+$('#wf-alloc-hours').value;await repo().add('professor_oferta_disciplina_turma',{professor_id,oferta_id,aulas});await atualizarAposSalvar(renderAllocations, 'Professor alocado.');
    });
  }
  async function renderWorkload(){
    const [allocs,teachers,offers,turmas,links,discs,periods]=await Promise.all(['professor_oferta_disciplina_turma','professor','oferta_disciplina_turma','turma','disciplina_curriculo','disciplina','periodo_letivo'].map(all));
    const rows=teachers.map(p=>{const own=allocs.filter(a=>a.professor_id===p.id),sum=own.reduce((s,a)=>s+Number(a.aulas||0),0);return `<tr><td>${escapeHtml(p.nome)} ${escapeHtml(p.sobrenome)}</td><td>${sum}</td><td>${p.horas_min??'—'}</td><td>${p.horas_med??'—'}</td><td>${p.horas_max??'—'}</td><td>${own.length}</td></tr>`}).join('');
    const detail=allocs.map(a=>{const p=teachers.find(x=>x.id===a.professor_id),o=offers.find(x=>x.id===a.oferta_id),t=turmas.find(x=>x.id===o?.turma_id),dc=links.find(x=>x.id===o?.disciplina_curriculo_id),d=discs.find(x=>x.id===dc?.disciplina_id),period=periods.find(x=>x.id===t?.periodo_id);return `<tr><td>${escapeHtml(p?.nome)} ${escapeHtml(p?.sobrenome)}</td><td>${escapeHtml(d?.nome)}</td><td>${t?.numero||''}</td><td>${escapeHtml(labelPeriodo(period))}</td><td>${a.aulas||0}</td></tr>`}).join('');
    shell('cargas','Cargas horárias','Relatório calculado a partir das alocações efetivamente cadastradas.',panel('Resumo por professor',table(['Professor','Aulas alocadas','Mínimo','Média','Máximo','Ofertas'],rows))+panel('Detalhamento das alocações',table(['Professor','Disciplina','Turma','Período','Aulas'],detail)));
  }
  async function editarRegistroDialogo(store, id) {
    const dedicado = Object.entries(window.SistemaCrudPresenter.config).find(([,c])=>c.store===store);
    if (dedicado) { location.hash=`#${dedicado[0]}?id=${id}`; return; }
    const registro = await get(store, id); if (!registro) return;
    const meta = window.SistemaDatabase.schema[store];
    const dialog = document.createElement("dialog"); dialog.className = "modal-dialog editor-registro";
    const camposLista = [];
    for (const [campo, regra] of Object.entries(meta.campos || {})) {
      if (campo === "id") continue;
      const atual = registro[campo] ?? "";
      if (regra.tipo === "fk") { const opcoes = await all(regra.tabela); camposLista.push(`<label class="campo"><span>${escapeHtml(campo.replaceAll("_", " "))}</span><select name="${campo}" ${regra.opcional ? "" : "required"}><option value="">Selecione</option>${opcoes.map(x=>`<option value="${x.id}" ${String(x.id)===String(atual)?"selected":""}>${escapeHtml(x.nome || x.sigla || x.codigo || x.id)}</option>`).join("")}</select></label>`); continue; }
      if (regra.tipo === "lista") continue;
      if (regra.tipo === "opcao") { camposLista.push(`<label class="campo"><span>${escapeHtml(campo.replaceAll("_", " "))}</span><select name="${campo}" ${regra.opcional ? "" : "required"}><option value="">Selecione</option>${regra.valores.map(v=>`<option value="${escapeHtml(v)}" ${String(v)===String(atual)?"selected":""}>${escapeHtml(v)}</option>`).join("")}</select></label>`); continue; }
      if (regra.tipo === "numero") { camposLista.push(`<label class="campo"><span>${escapeHtml(campo.replaceAll("_", " "))}</span><input name="${campo}" type="number" ${regra.minimo!=null?`min="${regra.minimo}"`:""} ${regra.maximo!=null?`max="${regra.maximo}"`:""} step="${regra.inteiro?1:"any"}" value="${escapeHtml(atual)}" ${regra.opcional?"":"required"}></label>`); continue; }
      camposLista.push(`<label class="campo"><span>${escapeHtml(campo.replaceAll("_", " "))}</span><input name="${campo}" value="${escapeHtml(atual)}" ${regra.opcional?"":"required"}></label>`);
    }
    const campos = camposLista.join("");
    dialog.innerHTML = `<form method="dialog" class="formulario-editor"><header><h2>Editar ${escapeHtml(meta.rotulo)}</h2><button type="button" class="btn-fechar" data-fechar>×</button></header><div class="form-grid">${campos}</div><footer><button type="button" data-cancelar class="btn btn-secondary">Cancelar</button><button type="submit" value="save" class="btn btn-primary">Salvar alterações</button></footer></form>`;
    document.body.append(dialog); dialog.showModal();
    dialog.querySelector("[data-fechar]").addEventListener("click",()=>dialog.close("cancel"));
    dialog.querySelector("[data-cancelar]").addEventListener("click",()=>dialog.close());
    const form = dialog.querySelector("form");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
      try {
        const atualizado = {...registro};
        for (const [k,v] of new FormData(form)) {
          const f=meta.campos[k]; if (!f) continue;
          const valor=String(v).trim();
          if (valor==="") {
            if (!f.opcional) throw new Error(`Preencha o campo ${k.replaceAll("_", " ")}.`);
            atualizado[k]=null;
          } else if (f.tipo==="numero"||f.tipo==="fk") {
            const numero=Number(valor);
            if (!Number.isFinite(numero) || ((f.inteiro||f.tipo==="fk")&&!Number.isInteger(numero))) throw new Error(`Valor numérico inválido em ${k.replaceAll("_", " ")}.`);
            atualizado[k]=numero;
          } else atualizado[k]=valor;
        }
        await repo().update(store, atualizado); dialog.close(); await atualizarAposSalvar(navigateCurrent, "Registro atualizado.");
      } catch(err) { toast(`Não foi possível editar: ${err.message}`); } finally { submit.disabled=false; }
    });
    dialog.addEventListener("close",()=>dialog.remove());
  }
  const renderizadores = {
    'vincular-disciplina': renderAssociation,
    'ingressantes': renderIngressantes,
    'gerar-ingressantes': renderGenerateIngressantes,
    'turmas-periodo': renderTurmas,
    'gerar-turmas': renderGenerateTurmas,
    'ofertas': renderOffers,
    'alocar-professor': renderAllocations,
    'cargas': renderWorkload
  };
  const rotaAtual = () => location.hash.replace(/^#/, '').split('?')[0];
  async function handleAction(e) {
    const edit = e.target.closest('[data-wf-edit]');
    const del = e.target.closest('[data-wf-delete]');
    if (edit) {
      try { await editarRegistroDialogo(edit.dataset.wfEdit, +edit.dataset.id); }
      catch (erro) { toast(erro.message || 'Não foi possível abrir o editor.'); }
      return;
    }
    if (!del || del.disabled) return;
    const escopo = del.closest('.workflow-root') || del;
    if (enviosEmAndamento.has(escopo)) return;
    if (!confirm('Excluir este registro? As regras de integridade serão verificadas.')) return;
    const rota = rotaAtual();
    const renderizar = renderizadores[rota];
    enviosEmAndamento.add(escopo);
    del.disabled = true;
    escopo.setAttribute('aria-busy', 'true');
    try {
      const excluido = await repo().remove(del.dataset.wfDelete, +del.dataset.id);
      if (!excluido) throw new Error('Registro não encontrado.');
      await atualizarAposSalvar(async () => {
        if (rotaAtual() === rota && renderizar) await renderizar();
      }, 'Registro excluído.');
    } catch (erro) {
      toast(`Não foi possível excluir: ${erro.message || 'Verifique os vínculos do registro.'}`);
      // A transação falhou: mantém a seleção e a tela intactas.
    } finally {
      enviosEmAndamento.delete(escopo);
      escopo.removeAttribute('aria-busy');
      del.disabled = false;
      // registrarEnvio pode ter desabilitado botões novos durante a renderização.
      if (!escopo.contains(del)) {
        escopo.querySelectorAll('button[type="submit"]').forEach(botao => { botao.disabled = false; });
        escopo.querySelector('#wf-gi-options')?.dispatchEvent(new Event('change'));
      }
    }
  }
  async function navigateCurrent() {
    const renderizar = renderizadores[rotaAtual()];
    if (renderizar) await renderizar();
  }
  async function onNavigate(key) {
    try { if (renderizadores[key]) await renderizadores[key](); }
    catch (erro) { console.error(erro); toast(erro.message || 'Falha ao carregar módulo.'); }
  }
  document.addEventListener('click',handleAction);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-action="import-file"]');if(!b)return;const input=$('#import-file');if(input)input.click();});
  document.addEventListener('change',async e=>{
    if(e.target.id!=='import-file'||!e.target.files?.[0])return;
    try{
      const copy=JSON.parse(await e.target.files[0].text());
      if(!copy.data||!window.SistemaDatabase.stores.every(s=>Array.isArray(copy.data[s])))throw Error('Arquivo não corresponde a um backup completo deste sistema.');
      if(!confirm('A importação substituirá os dados atuais deste navegador. Deseja continuar?'))return;
      await repo().importarTudo(copy.data); toast('Backup importado com validação e transação única.'); location.hash='#inicio';
    }catch(err){toast(`Importação não realizada: ${err.message}`);}
    finally{e.target.value='';}
  });

  window.SistemaWorkflows={onNavigate};
})();


/* ===== Inicialização e navegação ===== */
/* Aplicação: navegação por hash, estado de tela e inicialização dos módulos. */
const pageLabels = {
    inicio: "Início", turnos: "Gerenciar Turnos", areas: "Gerenciar Áreas Acadêmicas", professores: "Gerenciar Professores",
    cursos: "Gerenciar Cursos", curriculos: "Currículos", disciplinas: "Gerenciar Disciplinas",
    "vincular-disciplina": "Alocar Disciplina ao Currículo", ingressantes: "Turmas Ingressantes",
    "gerar-ingressantes": "Gerar Turmas Ingressantes", "turmas-periodo": "Turmas em Período Letivo",
    "gerar-turmas": "Gerar Turmas em Período Letivo", ofertas: "Ofertar Disciplinas",
    "alocar-professor": "Alocar Professor à Disciplina-Turma", cargas: "Cargas Horárias", "importar-exportar": "Importação / Exportação",
    "form-turno": "Cadastrar Turno", "form-area": "Cadastrar Área Acadêmica", "form-curso": "Cadastrar Curso",
    "form-disciplina": "Cadastrar Disciplina", "form-professor": "Cadastrar Professor", "form-curriculo": "Cadastrar Currículo",
    "form-ingressante": "Cadastrar Turma Ingressante", "form-turma": "Cadastrar Turma em Período Letivo"
};
function showToast(message) {
    let toast = $("#toast");
    if (!toast) { toast = document.createElement("div"); toast.id = "toast"; toast.className = "toast"; toast.setAttribute("role", "status"); document.body.appendChild(toast); }
    toast.textContent = message; toast.classList.add("show"); clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function parseRoute() {
    const raw = location.hash.replace(/^#/, "") || "inicio";
    const [key, query = ""] = raw.split("?");
    return { key: key || "inicio", params: new URLSearchParams(query) };
}
async function navigate() {
    const { key } = parseRoute();
    const target = $(`.app-page[data-pagina="${CSS.escape(key)}"]`);
    const pageKey = target ? key : "inicio";
    // Fecha diálogos que não correspondem à rota atual antes de trocar de tela.
    $$("dialog.app-page[open]").forEach(dialog => { if (dialog !== target) dialog.close(); });
    $$(".app-page").forEach(page => {
        page.hidden = page.dataset.pagina !== pageKey;
    });
    if (target?.matches("dialog") && !target.open) target.showModal();
    $$("#main-nav [data-pagina]").forEach(link => link.classList.toggle("active", link.dataset.pagina === pageKey));
    const label = $("#breadcrumb-label"); if (label) label.textContent = pageLabels[pageKey] || "Início";
    $("#sidebar")?.classList.remove("open");
    if (window.SistemaCrudPresenter.config[pageKey]) await window.SistemaCrudPresenter.startForm(pageKey);
    else await window.SistemaCrudPresenter.startList(pageKey);
    if (window.SistemaWorkflows) await window.SistemaWorkflows.onNavigate(pageKey);
    if (pageKey === "importar-exportar") setupBackup();
    if (pageKey === "inicio") await Promise.all($$("[data-contagem]").map(async el => { el.textContent = (await window.SistemaDatabase.repository.all(el.dataset.contagem)).length; }));
}
let backupBound = false;
function setupBackup() {
    if (backupBound) return; backupBound = true;
    $("#export-button")?.addEventListener("click", async () => {
        try {
            const data = await window.SistemaDatabase.repository.exportAll();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob); const link = document.createElement("a");
            link.href = url; link.download = "backup-sistema-ifrs.json"; link.click(); URL.revokeObjectURL(url); showToast("Backup JSON exportado.");
        } catch (error) { showToast(error.message || "Não foi possível exportar o backup."); }
    });
}
$("#mobile-menu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
document.addEventListener("click", event => {
    const closeButton = event.target.closest("[data-fechar]");
    if (closeButton) {
        const dialog = closeButton.closest("dialog");
        if (dialog?.open) dialog.close();
        return;
    }
    if (event.target.matches("dialog.app-page")) {
        event.target.close();
        return;
    }
    const toggle = event.target.closest(".group-toggle");
    if (toggle) {
        const children = document.querySelector(`[data-children="${toggle.dataset.group}"]`);
        if (children) { children.classList.toggle("hidden"); const arrow = toggle.querySelector("b"); if (arrow) arrow.textContent = children.classList.contains("hidden") ? "⌄" : "⌃"; }
    }
});
function searchPages() {
    const query = $("#global-search")?.value.toLocaleLowerCase("pt-BR").trim(); if (!query) return;
    const match = Object.entries(pageLabels).find(([, label]) => label.toLocaleLowerCase("pt-BR").includes(query));
    if (!match) { showToast("Nenhuma tela encontrada com esse termo."); return; }
    location.hash = `#${match[0]}`;
}
$("#search-btn")?.addEventListener("click", searchPages);
$("#global-search")?.addEventListener("keydown", event => { if (event.key === "Enter") searchPages(); });
document.querySelectorAll("dialog.app-page").forEach(dialog => {
    dialog.addEventListener("close", () => {
        const { key } = parseRoute();
        if (key === dialog.dataset.pagina) {
            const list = window.SistemaCrudPresenter.config[dialog.dataset.pagina]?.list || "inicio";
            location.hash = `#${list}`;
        }
    });
});
window.addEventListener("hashchange", () => navigate().catch(error => { console.error(error); showToast(error.message || "Erro ao abrir a tela."); }));
(async function initializeApplication() {
    const indicadorBanco = $("#versao-banco");
    try {
        const banco = await window.SistemaDatabase.open();
        if (indicadorBanco) indicadorBanco.textContent = `IndexedDB · Versão ${banco.version}`;
        await navigate();
    }
    catch (error) {
        if (indicadorBanco && indicadorBanco.textContent === "IndexedDB · Carregando...") {
            indicadorBanco.textContent = "IndexedDB · Indisponível";
        }
        console.error(error); showToast(error.message || "Erro ao iniciar o banco local.");
        const aviso=document.createElement("p"); aviso.setAttribute("role","alert"); aviso.className="aviso-banco";
        aviso.textContent=error.message || "Erro ao iniciar o banco local."; document.body.prepend(aviso);
    }
})();
