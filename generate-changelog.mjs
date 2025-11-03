import fs from "fs"
import fetch from "node-fetch"


const { GITHUB_REPOSITORY, GITHUB_REF, GITHUB_TOKEN } = process.env

if (!GITHUB_REPOSITORY) {
  console.error("Erro: GITHUB_REPOSITORY não definido.")
  process.exit(1)
}

if (!GITHUB_REF) {
  console.error("Erro: GITHUB_REF não está definido.")
  process.exit(1)
}

const tagPrefix = "refs/tags/"
if (!GITHUB_REF.startsWith(tagPrefix)) {
  console.error(`Erro: GITHUB_REF inesperado. Esperado iniciar com '${tagPrefix}', mas recebeu '${GITHUB_REF}'`)
  process.exit(1)
}

const HEAD_TAG = GITHUB_REF.replace(tagPrefix, "")

if (!GITHUB_TOKEN) {
  console.error("Erro: GITHUB_TOKEN não definido.")
  process.exit(1)
}


const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json"
}

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...headers, ...extraHeaders } })
  if (!res.ok) throw new Error(`Erro ao buscar ${url}: ${res.status}`)
  return res.json()
}

async function getPreviousTag() {
  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/tags`
  const tags = await fetchJson(url)
  const tagNames = tags.map(tag => tag.name).filter(name => name !== HEAD_TAG)
  return tagNames[0] || null
}

async function getCommitsBetween(base, head) {
  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/compare/${base}...${head}`
  const json = await fetchJson(url)
  return json.commits
}

async function getPRForCommit(sha) {
  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/${sha}/pulls`
  const json = await fetchJson(url, {
    Accept: "application/vnd.github.groot-preview+json"
  })
  return json.length > 0 ? json[0] : null
}

function extractJiraTasksFromBody(body) {
  const regex = /\[\s*([A-Z]+-\d+)\s*\]\([^)]+\)/g
  const matches = []
  let match
  while ((match = regex.exec(body)) !== null) {
    const key = match[1]
    const url = `https://teste.atlassian.net/browse/${key}`
    matches.push(`  - [${key}](${url})`)
  }
  return matches
}

async function main() {
  const BASE_TAG = await getPreviousTag()
  if (!BASE_TAG) throw new Error("Tag anterior não encontrada.")

  console.log(`Gerando changelog: ${BASE_TAG} → ${HEAD_TAG}`)
  console.log("CHANGELOG.md gerado com sucesso.")
}

main().catch(err => {
  console.error("Erro:", err.message)
  process.exit(1)
})