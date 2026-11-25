/* Model: regras de acesso e nomes das entidades. */
(function () {
    const repo = window.SistemaDatabase.repository;
    window.SistemaRepositories = {
        areas: { store: "area_academica", all: () => repo.all("area_academica") },
        turnos: { store: "turno", all: () => repo.all("turno") },
        cursos: { store: "curso", all: () => repo.all("curso") },
        disciplinas: { store: "disciplina", all: () => repo.all("disciplina") },
        professores: { store: "professor", all: () => repo.all("professor") },
        curriculos: { store: "curriculo", all: () => repo.all("curriculo") }
    };
})();
