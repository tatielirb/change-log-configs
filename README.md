#  Change Log Configs

Projeto de configuração e automação de **changelog** para organizar Pull Requests em tag-releases, com integração ao Jira e padronização de commits.

## Visão Geral

Este repositório demonstra duas abordagens para geração de changelog automatizado via GitHub Actions, ambas seguindo [Semantic Versioning](https://semver.org/) e convenções de commit padronizadas.

### Padrões Adotados

- **Commits**: Padronização via [git-commit-msg-linter](https://github.com/legend80s/git-commit-msg-linter#readme)
- **Pull Requests**: Validação via [PRLint Reloaded](https://github.com/maor-rozenfeld/prlint-reloaded) (app [prlint-reloaded](https://github.com/apps/prlint-reloaded))
- **Versionamento**: [Semantic Versioning](https://semver.org/) para criação de tags de release


<img width="1119" alt="Screenshot 2025-05-25 at 17 45 51" src="https://github.com/user-attachments/assets/93d6ff5b-95b6-4c13-9354-e08aeed8b501" />
---

## Abordagens de Changelog

### Opção 1 — `custom-release-notes` (Geração Customizada com Node.js)

Abordagem com script Node.js próprio (`generate-changelog.mjs`) que consulta a API do GitHub diretamente para montar o changelog. Ideal quando você precisa de controle total sobre o formato e deseja integrar tarefas do Jira automaticamente.

**Como funciona:**

1. Ao criar uma tag de release, a GitHub Action executa o script `generate-changelog.mjs`
2. O script compara a tag atual com a anterior usando a GitHub API
3. Para cada commit entre as tags, busca o PR associado
4. Extrai as tarefas do Jira do corpo do PR (via regex no formato `[PROJ-123](link)`)
5. Gera o `CHANGELOG.md` com a lista de PRs e tasks vinculadas

**Variáveis de ambiente necessárias:**

| Variável | Descrição |
|---|---|
| `GITHUB_REPOSITORY` | Ex: `org/repo` |
| `GITHUB_REF` | Ex: `refs/tags/v1.0.0` |
| `GITHUB_TOKEN` | Token do GitHub (ou `secrets.GITHUB_TOKEN`) |
| `TARGET_BRANCH` | Branch base dos PRs (padrão: `main`) |

**Executar localmente:**

```bash
npm run generate-changelog
```

**Formato de saída esperado:**

```
- feat: adiciona nova funcionalidade (#42) by @usuario
  - [PROJ-123 - Descrição da task](https://jira.empresa.com/browse/PROJ-123)
```

> **Quando usar:** Quando precisar de layout personalizado, integração com Jira ou lógica customizada de filtragem de PRs.

---

### Opção 2 — `simple-flow-release-notes` (Fluxo via Bibliotecas)

Abordagem simplificada utilizando actions e bibliotecas prontas do ecossistema GitHub. Menos código para manter, configuração via YAML.

**Bibliotecas utilizadas:**

- [release-action](https://github.com/ncipollo/release-action) — criação do release no GitHub
- [release-changelog-builder-action](https://github.com/mikepenz/release-changelog-builder-action) — geração automática do changelog entre tags
- [semantic-release](https://github.com/semantic-release/semantic-release) — automação do fluxo de versionamento

**Exemplo de workflow:**

```yaml
- name: Build Changelog
  uses: mikepenz/release-changelog-builder-action@v4
  with:
    fromTag: ${{ steps.previoustag.outputs.tag }}
    toTag: ${{ github.ref_name }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Create Release
  uses: ncipollo/release-action@v1
  with:
    tag: ${{ github.ref_name }}
    body: ${{ steps.changelog.outputs.changelog }}
```

> **Quando usar:** Quando quiser configuração rápida sem código customizado, e o formato padrão do changelog atender às necessidades do time.

---

##  Exemplo de Release

Organização por PR e task Jira:

![Exemplo de changelog organizado por PR e task Jira](./public/example-changelog.png)

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 18
- [NPM](https://www.npmjs.com/)
- [Vue 3](https://vuejs.org/)
- [Nuxt](https://nuxt.com/)

## Tecnologias

- [Node.js](https://nodejs.org/)
- [Vue 3](https://vuejs.org/)
- [Nuxt 3](https://nuxt.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [NPM](https://www.npmjs.com/)

---

##  Setup

Instale as dependências:

```bash
npm install
```

### Servidor de Desenvolvimento

Inicie o servidor em `http://localhost:3000`:

```bash
npm run dev
```

### Build para Produção

```bash
npm run build
```

Preview do build de produção:

```bash
npm run preview
```

### Gerar Changelog Manualmente

```bash
npm run generate-changelog
```

---

## Estrutura Relevante

```
.
├── .github/
│   └── workflows/          # GitHub Actions (simple-flow e custom)
├── generate-changelog.mjs  # Script Node.js para geração customizada
├── CHANGELOG.md            # Changelog gerado automaticamente
└── package.json
```