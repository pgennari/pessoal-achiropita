/**
 * OpenAPI 3.0 Specification for API Achiropita
 */
export const openapiSpec = {
    openapi: "3.0.0",
    info: {
        title: "API Achiropita",
        version: "0.1.0",
        description: "API para gestão de pessoal e formações da Festa da Achiropita",
    },
    servers: [
        { url: "/api", description: "Base path da API" }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "Firebase ID Token"
            },
            publicAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "Sessão Pública JWT"
            }
        },
        schemas: {
            Pessoa: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    cracha: { type: "integer" },
                    nome: { type: "string" },
                    nascimento: { type: "string", format: "date" },
                    telefone: { type: "string" },
                    email: { type: "string" },
                    ativo: { type: "boolean" },
                    fotoUrl: { type: "string" }
                }
            },
            Edicao: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    numero: { type: "integer" },
                    ano: { type: "integer" },
                    status: { type: "string", enum: ["planejamento", "ativa", "encerrada"] }
                }
            },
            Equipe: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    edicaoId: { type: "string" },
                    nome: { type: "string" },
                    setor: { type: "string" }
                }
            },
            Erro: {
                type: "object",
                properties: {
                    erro: { type: "string" }
                }
            }
        }
    },
    paths: {
        "/pessoas": {
            get: {
                tags: ["Pessoas"],
                summary: "Lista todas as pessoas",
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: "Lista de pessoas",
                        content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Pessoa" } } } }
                    }
                }
            },
            post: {
                tags: ["Pessoas"],
                summary: "Cadastra uma nova pessoa",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: { "application/json": { schema: { $ref: "#/components/schemas/Pessoa" } } }
                },
                responses: {
                    201: { description: "Pessoa criada" },
                    403: { description: "Acesso negado" }
                }
            }
        },
        "/edicoes": {
            get: {
                tags: ["Edições"],
                summary: "Lista todas as edições",
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: "Lista de edições",
                        content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Edicao" } } } }
                    }
                }
            }
        },
        "/equipes": {
            get: {
                tags: ["Equipes"],
                summary: "Lista equipes (opcionalmente por edição)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "edicaoId", in: "query", schema: { type: "string" } }
                ],
                responses: {
                    200: { description: "Lista de equipes" }
                }
            }
        },
        "/publico/health": {
            get: {
                tags: ["Público"],
                summary: "Health check",
                responses: {
                    200: { description: "OK" }
                }
            }
        }
        // Adicionar outros caminhos conforme necessário
    }
};
