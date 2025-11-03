import fs from "fs"
import fetch from "node-fetch"


const REPO = process.env.GITHUB_REPOSITORY
const GITHUB_REF = process.env.GITHUB_REF
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const JIRA_BASE_URL = "https://corp.atlassian.net"

if (!REPO) {
  console.error("Erro: variável GITHUB_REPOSITORY não está definida.")
  console.error("Exemplo: export GITHUB_REPOSITORY='omiexperience/ops-crm'")
  process.exit(1)
}

if (!GITHUB_REF || !GITHUB_REF.startsWith("refs/tags/")) {
  console.error("Erro: variável GITHUB_REF ausente ou em formato incorreto.")
  process.exit(1)
}

if (!GITHUB_TOKEN) {
  console.error("Erro: variável GITHUB_TOKEN não está definida.")
  process.exit(1)
}

const HEAD_TAG = GITHUB_REF.replace("refs/tags/", "")

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json"
}

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...headers, ...extraHeaders } })
  if (!res.ok) {
    throw new Error(`Erro ao buscar ${url}: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function getPreviousTag() {
  let page = 1
  const allTags = []


  while (true) {
    const url = `https://api.github.com/repos/${REPO}/tags?per_page=100&page=${page}`
    const tags = await fetchJson(url)
    if (!tags.length) break
    allTags.push(...tags)
    page++
  }

  const tagNames = allTags.map(tag => tag.name)

  if (!tagNames.includes(HEAD_TAG)) {
    throw new Error(`Tag atual (${HEAD_TAG}) não encontrada na lista de tags do repositório.`)
  }

  const sortedTags = tagNames.sort((a, b) => {
    const pa = a.replace(/^v/, "").split(".").map(Number)
    const pb = b.replace(/^v/, "").split(".").map(Number)
    for (let i = 0;i < Math.max(pa.length, pb.length);i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0)
      if (diff !== 0) return diff
    }
    return 0
  })


  const currentIndex = sortedTags.indexOf(HEAD_TAG)
  if (currentIndex <= 0) {
    throw new Error("Não há tag anterior a esta (possivelmente é o primeiro release).")
  }

  const previousTag = sortedTags[currentIndex - 1]

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
  const regex = /\[\s*([A-Z]+-\d+)\s*\]\([^)]+\)/g
  const matches = []
  let match
  while ((match = regex.exec(body)) !== null) {
    const key = match[1]
    const url = `${JIRA_BASE_URL}/browse/${key}`
    matches.push(`  - [${key}](${url})`)
  }
  return matches
}

async function main() {
  const BASE_TAG = await getPreviousTag()
  if (!BASE_TAG) throw new Error("Tag anterior não encontrada.")

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
}

main().catch(err => {
  console.error("Erro:", err.message)
  process.exit(1)
})
