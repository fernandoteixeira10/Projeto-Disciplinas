/* Esquema declarativo do domínio acadêmico. O motor interpreta estes metadados. */
(function () {
    const texto = (opcoes = {}) => ({ tipo: "texto", ...opcoes });
    const numero = (opcoes = {}) => ({ tipo: "numero", ...opcoes });
    const data = (opcoes = {}) => ({ tipo: "data", ...opcoes });
    const opcao = (valores, opcoes = {}) => ({ tipo: "opcao", valores, ...opcoes });
    const fk = (tabela, opcoes = {}) => ({ tipo: "fk", tabela, ...opcoes });

    const esquema = {
        curso: { rotulo: "curso", campos: { codigo: texto({ unico: true }), nome: texto() } },
        turno: { rotulo: "turno", campos: { sigla: texto({ unico: true }), nome: texto(), descricao: texto({ opcional: true }) } },
        area_academica: { rotulo: "área acadêmica", campos: { sigla: texto({ unico: true }), nome: texto(), descricao: texto({ opcional: true }) } },
        curriculo: { rotulo: "currículo", campos: {
            cursoId: fk("curso"), areaId: fk("area_academica", { opcional: true }),
            anoInicial: numero({ opcional: true, inteiro: true, minimo: 1900 }), semestreInicial: numero({ opcional: true, inteiro: true, minimo: 1, maximo: 2 }),
            anoFinal: numero({ opcional: true, inteiro: true, minimo: 1900 }), semestreFinal: numero({ opcional: true, inteiro: true, minimo: 1, maximo: 2 }),
            periodicidadeIngresso: texto({ opcional: true }), periodicidadeCurricular: texto({ opcional: true }),
            totalPeriodos: numero({ opcional: true, inteiro: true, positivo: true }), duracaoAula: numero({ opcional: true, positivo: true }),
            situacao: texto({ opcional: true }), turnos: { tipo: "lista", opcional: true }
        } },
        curriculo_turno: { rotulo: "turno do currículo", campos: { curriculoId: fk("curriculo", { dono: true }), turnoId: fk("turno", { dono: true }) }, indices: [{ campos: ["curriculoId", "turnoId"], unico: true }] },
        disciplina: { rotulo: "disciplina", campos: { codigo: texto({ unico: true }), nome: texto(), aulasSemana: numero({ opcional: true, minimo: 0 }), totalAulas: numero({ opcional: true, minimo: 0 }), areaId: fk("area_academica", { opcional: true }) } },
        disciplina_curriculo: { rotulo: "disciplina do currículo", campos: { disciplinaId: fk("disciplina", { dono: true }), curriculoId: fk("curriculo", { dono: true }), periodo: numero({ opcional: true, inteiro: true, minimo: 0 }) }, indices: [{ campos: ["disciplinaId", "curriculoId", "periodo"], unico: true }] },
        periodo_letivo: { rotulo: "período letivo", campos: { ano: numero({ inteiro: true, minimo: 1900 }), tipo: opcao(["ano", "semestre", "trimestre", "bimestre"], { opcional: true }), numero: numero({ opcional: true, inteiro: true, positivo: true }) }, indices: [{ campos: ["ano", "tipo", "numero"], unico: true }] },
        turma_ingressante: { rotulo: "turma ingressante", campos: { curriculoId: fk("curriculo"), periodoId: fk("periodo_letivo", { opcional: true }), turnoId: fk("turno", { opcional: true }), numero: numero({ opcional: true, inteiro: true, positivo: true }), situacao: texto({ opcional: true }) }, indices: [{ campos: ["curriculoId", "periodoId", "turnoId", "numero"], unico: true }] },
        turma: { rotulo: "turma", campos: { ingressanteId: fk("turma_ingressante"), periodoId: fk("periodo_letivo"), numero: numero({ opcional: true, inteiro: true, positivo: true }), fase: numero({ opcional: true, inteiro: true, minimo: 0 }) }, indices: [{ campos: ["ingressanteId", "periodoId", "numero"], unico: true }] },
        oferta_disciplina_turma: { rotulo: "oferta de disciplina", campos: { turmaId: fk("turma"), disciplinaCurriculoId: fk("disciplina_curriculo"), situacao: texto({ opcional: true }) }, indices: [{ campos: ["turmaId", "disciplinaCurriculoId"], unico: true }] },
        professor: { rotulo: "professor", campos: { nome: texto(), sobrenome: texto(), nomeAbreviado: texto(), email: texto({ unico: true }), areaId: fk("area_academica", { opcional: true }), horasMin: numero({ opcional: true, minimo: 0 }), horasMax: numero({ opcional: true, minimo: 0 }), horasMed: numero({ opcional: true, minimo: 0 }), observacoes: texto({ opcional: true }) } },
        professor_oferta_disciplina_turma: { rotulo: "alocação de professor", campos: { professorId: fk("professor", { dono: true }), ofertaId: fk("oferta_disciplina_turma", { dono: true }), aulas: numero({ opcional: true, minimo: 0 }) }, indices: [{ campos: ["professorId", "ofertaId"], unico: true }] }
    };
    window.SistemaSchema = { esquema, helpers: { texto, numero, data, opcao, fk } };
})();
