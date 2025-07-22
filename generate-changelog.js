require("dotenv").config()
const fs = require("fs")
const fetch = require("node-fetch")

const REPO = process.env.GITHUB_REPOSITORY
const HEAD_TAG = process.env.GITHUB_REF.replace("refs/tags/", "")
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const jiraRegex = /\b([A-Z]+-\d+)\b/

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
  return tagNames[0] || null // Última tag antes da atual
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

async function main() {
  const BASE_TAG = await getPreviousTag()
  if (!BASE_TAG) throw new Error("Tag anterior não encontrada.")

  console.log(`🔷 Gerando changelog: ${BASE_TAG} → ${HEAD_TAG}`)
  const commits = await getCommitsBetween(BASE_TAG, HEAD_TAG)

  const groups = {}
  const noJira = []

  for (const commit of commits) {
    const sha = commit.sha
    const pr = await getPRForCommit(sha)
    if (!pr) continue

    const title = pr.title
    const url = pr.html_url
    const number = pr.number

    const match = jiraRegex.exec(title)
    if (match) {
      const key = match[1]
      if (!groups[key]) groups[key] = []
      groups[key].push(`- ${title} ([#${number}](${url}))`)
    } else {
      noJira.push(`- ${title} ([#${number}](${url}))`)
    }
  }

  let output = `# Changelog ${HEAD_TAG}\n\n`
  for (const key of Object.keys(groups).sort()) {
    output += `## ${key}\n`
    groups[key].forEach(line => output += line + "\n")
    output += "\n"
  }

  if (noJira.length > 0) {
    output += `## Outros (sem key Jira)\n`
    noJira.forEach(line => output += line + "\n")
  }

  fs.writeFileSync("CHANGELOG.md", output)
  console.log("✅ CHANGELOG.md gerado com sucesso.")
}

main().catch(err => {
  console.error("❌ Erro:", err.message)
  process.exit(1)
})
