import fs from "fs"
import fetch from "node-fetch"

const REPO = process.env.GITHUB_REPOSITORY
const GITHUB_REF = process.env.GITHUB_REF
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const JIRA_BASE_URL = "https://teste.atlassian.net"

if (!REPO) {
  console.error("Erro: variável GITHUB_REPOSITORY não está definida.")
  console.error("   Exemplo: export GITHUB_REPOSITORY='omiexperience/ops-crm'")
  process.exit(1)
}

if (!GITHUB_REF || !GITHUB_REF.startsWith("refs/tags/")) {
  console.error("Erro: variável GITHUB_REF ausente ou em formato incorreto.")
  console.error("   Exemplo: export GITHUB_REF='refs/tags/v2.20251020'")
  process.exit(1)
}

if (!GITHUB_TOKEN) {
  console.error("Erro: variável GITHUB_TOKEN não está definida.")
  console.error("   Gere um token pessoal ou use o secrets.GITHUB_TOKEN do GitHub Actions.")
  console.log(`Tag anterior encontrada: ${previousTag}`)
  return previousTag
}


async function getCommitsBetween(base, head) {
  const url = `https://api.github.com/repos/${REPO}/compare/${base}...${head}`
  const json = await fetchJson(url)
  return json.commits
}

async function getPRForCommit(sha) {
  const url = `https://api.github.com/repos/${REPO}/commits/${sha}/pulls`
  const json = await fetchJson(url, {
    Accept: "application/vnd.github.groot-preview+json"
  })
  return json.length > 0 ? json[0] : null
}

function extractJiraTasksFromBody(body) {
  if (!body) return []

  const tasks = []
  const lines = body.split("\n")

  for (const line of lines) {
    const regex = /^\s*-\s*\[\s*([A-Z]+-\d+[^\]]*)\s*\]\((https?:\/\/[^)]+)\)(?:\s*[-:]\s*(.*))?/

    const match = line.match(regex)
    if (!match) continue

    const label = match[1].trim()
    const link = match[2].trim()
    const extra = match[3]?.trim()

    const finalLabel = extra ? `${label} - ${extra}` : label

    tasks.push(`  - [${finalLabel}](${link})`)
  }

  return tasks
}


async function main() {
  console.log(`Tag atual: ${HEAD_TAG}`)
  console.log(`Repositório: ${REPO}`)
  console.log("Buscando tag anterior...")

  const BASE_TAG = await getPreviousTag()
  if (!BASE_TAG) throw new Error("Tag anterior não encontrada (pode ser o primeiro release).")

  console.log(` Gerando changelog: ${BASE_TAG} → ${HEAD_TAG}`)
  const commits = await getCommitsBetween(BASE_TAG, HEAD_TAG)

  const outputLines = []
  const contributorsMap = new Map()
  const prNumbersSet = new Set()

  for (const commit of commits) {
    const sha = commit.sha
    const pr = await getPRForCommit(sha)
    if (!pr) continue

    const number = pr.number
    if (prNumbersSet.has(number)) continue
    prNumbersSet.add(number)

    const title = pr.title
    const url = pr.html_url
    const user = pr.user
    const body = pr.body || ""

    if (user) {
      contributorsMap.set(user.login, {
        login: user.login,
        avatar: user.avatar_url,
        html_url: user.html_url
      })
    }

    const line = `- ${title} ([#${number}](${url})) by @${user.login}`
    outputLines.push(line)

    const subtasks = extractJiraTasksFromBody(body)
    outputLines.push(...subtasks)
  }

  let output = `# ${HEAD_TAG}\n\n`
  output += outputLines.join("\n")
  output += "\n"

  fs.writeFileSync("CHANGELOG.md", output)
  console.log("CHANGELOG.md gerado com sucesso.")
}

main().catch(err => {
  console.error(" Erro:", err.message)
  process.exit(1)
})