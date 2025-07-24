import fs from "fs"
import fetch from "node-fetch"

const REPO = process.env.GITHUB_REPOSITORY
const HEAD_TAG = process.env.GITHUB_REF.replace("refs/tags/", "")
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

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
  const url = `https://api.github.com/repos/${REPO}/tags`
  const tags = await fetchJson(url)
  const tagNames = tags.map(tag => tag.name).filter(name => name !== HEAD_TAG)
  return tagNames[0] || null
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
  const regex = /- \[?([A-Z]+-\d+)\]?\s+(.+)/g
  const matches = []
  let match
  while ((match = regex.exec(body)) !== null) {
    matches.push(`- 🔗 ${match[1]} ${match[2]}`)
  }
  return matches
}

async function main() {
  const BASE_TAG = await getPreviousTag()
  if (!BASE_TAG) throw new Error("Tag anterior não encontrada.")

  console.log(`Gerando changelog: ${BASE_TAG} → ${HEAD_TAG}`)
  const commits = await getCommitsBetween(BASE_TAG, HEAD_TAG)

  const groups = {}
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
    const subtasks = extractJiraTasksFromBody(body)
    const label = pr.labels.find(l => l.name.toLowerCase().includes("squad"))?.name || "Outros"

    if (!groups[label]) groups[label] = []
    groups[label].push({ line, subtasks })
  }

  let output = `# Changelog ${HEAD_TAG}\n\n`

  const sortedLabels = Object.keys(groups).sort()
  for (const label of sortedLabels) {
    output += `## ${label}\n`
    groups[label].forEach(pr => {
      output += pr.line + "\n"
      pr.subtasks.forEach(sub => {
        output += `  ${sub}\n`
      })
    })
    output += "\n"
  }

  fs.writeFileSync("CHANGELOG.md", output)
  console.log("CHANGELOG.md gerado com sucesso.")
}

main().catch(err => {
  console.error("Erro:", err.message)
  process.exit(1)
})